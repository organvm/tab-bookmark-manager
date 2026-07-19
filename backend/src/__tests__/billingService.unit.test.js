const crypto = require('crypto');

const ENV_KEYS = [
  'PRO_CHECKOUT_PROVIDER',
  'PRO_CHECKOUT_URL',
  'LEMON_SQUEEZY_CHECKOUT_URL',
  'STRIPE_CHECKOUT_URL',
  'BILLING_WEBHOOK_SECRET',
  'STRIPE_WEBHOOK_SECRET',
  'LEMON_SQUEEZY_WEBHOOK_SECRET',
  'NODE_ENV',
];

function snapshotEnv() {
  return ENV_KEYS.reduce((env, key) => {
    env[key] = process.env[key];
    return env;
  }, {});
}

function restoreEnv(snapshot) {
  ENV_KEYS.forEach(key => {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  });
}

function clearBillingEnv() {
  ENV_KEYS
    .filter(key => key !== 'NODE_ENV')
    .forEach(key => {
      delete process.env[key];
    });
  process.env.NODE_ENV = 'test';
}

function loadBillingService() {
  jest.resetModules();

  const entitlementService = {
    getUserRecord: jest.fn(),
    setSubscriptionForUser: jest.fn(),
  };

  jest.doMock('../services/entitlementService', () => entitlementService);

  return {
    billingService: require('../services/billingService'),
    entitlementService,
  };
}

function hmac(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe('billingService unit behavior', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = snapshotEnv();
    clearBillingEnv();
  });

  afterEach(() => {
    jest.dontMock('../services/entitlementService');
    jest.resetModules();
    restoreEnv(originalEnv);
  });

  describe('createCheckoutUrl', () => {
    it('infers Stripe checkout settings and appends Stripe customer context', async () => {
      const { billingService, entitlementService } = loadBillingService();
      entitlementService.getUserRecord.mockResolvedValue({
        id: 42,
        email: 'stripe-user@example.com',
      });
      process.env.STRIPE_CHECKOUT_URL = 'https://checkout.stripe.test/session?coupon=early';

      const checkout = await billingService.createCheckoutUrl(42);
      const checkoutUrl = new URL(checkout.url);

      expect(checkout.provider).toEqual('stripe');
      expect(checkoutUrl.origin + checkoutUrl.pathname).toEqual('https://checkout.stripe.test/session');
      expect(checkoutUrl.searchParams.get('coupon')).toEqual('early');
      expect(checkoutUrl.searchParams.get('client_reference_id')).toEqual('42');
      expect(checkoutUrl.searchParams.get('prefilled_email')).toEqual('stripe-user@example.com');
    });

    it('uses Lemon Squeezy checkout fields when configured explicitly', async () => {
      const { billingService, entitlementService } = loadBillingService();
      entitlementService.getUserRecord.mockResolvedValue({
        id: 7,
        email: 'lemon-user@example.com',
      });
      process.env.PRO_CHECKOUT_PROVIDER = 'lemon_squeezy';
      process.env.PRO_CHECKOUT_URL = 'https://checkout.lemonsqueezy.test/buy';

      const checkout = await billingService.createCheckoutUrl(7);
      const checkoutUrl = new URL(checkout.url);

      expect(checkout.provider).toEqual('lemon_squeezy');
      expect(checkoutUrl.searchParams.get('checkout[custom][user_id]')).toEqual('7');
      expect(checkoutUrl.searchParams.get('checkout[email]')).toEqual('lemon-user@example.com');
    });

    it('falls back to generic checkout context for external providers', async () => {
      const { billingService, entitlementService } = loadBillingService();
      entitlementService.getUserRecord.mockResolvedValue({ id: 13 });
      process.env.PRO_CHECKOUT_PROVIDER = 'external';
      process.env.PRO_CHECKOUT_URL = 'https://billing.example.test/upgrade';

      const checkout = await billingService.createCheckoutUrl(13);
      const checkoutUrl = new URL(checkout.url);

      expect(checkout.provider).toEqual('external');
      expect(checkoutUrl.searchParams.get('user_id')).toEqual('13');
      expect(checkoutUrl.searchParams.has('email')).toBe(false);
    });

    it('rejects missing users and missing checkout configuration with service errors', async () => {
      const { billingService, entitlementService } = loadBillingService();

      entitlementService.getUserRecord.mockResolvedValueOnce(null);
      await expect(billingService.createCheckoutUrl(404)).rejects.toMatchObject({
        message: 'User not found',
        statusCode: 404,
      });

      entitlementService.getUserRecord.mockResolvedValueOnce({
        id: 1,
        email: 'missing-config@example.com',
      });
      await expect(billingService.createCheckoutUrl(1)).rejects.toMatchObject({
        message: 'Pro checkout URL is not configured',
        statusCode: 503,
        details: {
          requiredEnv: expect.arrayContaining([
            'PRO_CHECKOUT_URL',
            'LEMON_SQUEEZY_CHECKOUT_URL',
            'STRIPE_CHECKOUT_URL',
          ]),
        },
      });
    });
  });

  describe('verifyWebhook', () => {
    it('allows unsigned webhooks in test mode but not production mode', () => {
      const { billingService } = loadBillingService();

      expect(billingService.verifyWebhook({
        headers: {},
        body: { type: 'checkout.session.completed' },
      })).toBe(true);

      process.env.NODE_ENV = 'production';

      expect(billingService.verifyWebhook({
        headers: {},
        body: { type: 'checkout.session.completed' },
      })).toBe(false);
    });

    it('verifies shared billing webhook secrets', () => {
      const { billingService } = loadBillingService();
      process.env.BILLING_WEBHOOK_SECRET = 'shared-secret';

      expect(billingService.verifyWebhook({
        headers: { 'x-billing-webhook-secret': 'shared-secret' },
        body: { ok: true },
      })).toBe(true);

      expect(billingService.verifyWebhook({
        headers: { 'x-billing-webhook-secret': 'wrong-secret' },
        body: { ok: true },
      })).toBe(false);
    });

    it('verifies Stripe signatures from the raw request body', () => {
      const { billingService } = loadBillingService();
      process.env.STRIPE_WEBHOOK_SECRET = 'stripe-secret';
      const rawBody = JSON.stringify({ type: 'customer.subscription.updated' });
      const timestamp = '1780000000';
      const signature = hmac('stripe-secret', `${timestamp}.${rawBody}`);

      expect(billingService.verifyWebhook({
        headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
        rawBody,
        body: JSON.parse(rawBody),
      })).toBe(true);

      expect(billingService.verifyWebhook({
        headers: { 'stripe-signature': `v1=${signature}` },
        rawBody,
        body: JSON.parse(rawBody),
      })).toBe(false);
    });

    it('verifies Lemon Squeezy signatures and rejects mismatches', () => {
      const { billingService } = loadBillingService();
      process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = 'lemon-secret';
      const rawBody = JSON.stringify({ meta: { event_name: 'subscription_created' } });
      const signature = hmac('lemon-secret', rawBody);

      expect(billingService.verifyWebhook({
        headers: { 'x-signature': signature },
        rawBody,
        body: JSON.parse(rawBody),
      })).toBe(true);

      expect(billingService.verifyWebhook({
        headers: { 'x-signature': 'invalid-signature' },
        rawBody,
        body: JSON.parse(rawBody),
      })).toBe(false);
    });
  });

  describe('applyBillingWebhook', () => {
    it('maps Stripe subscription events into entitlement updates', async () => {
      const { billingService, entitlementService } = loadBillingService();

      await expect(billingService.applyBillingWebhook({
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: '5',
            customer: 'cus_checkout',
            subscription: 'sub_checkout',
          },
        },
      })).resolves.toEqual({
        ignored: false,
        userId: 5,
        status: 'active',
        provider: 'stripe',
      });

      await billingService.applyBillingWebhook({
        type: 'customer.subscription.updated',
        data: {
          object: {
            metadata: { user_id: '6' },
            status: 'past_due',
            customer: 'cus_updated',
            id: 'sub_updated',
            current_period_end: 1780000000,
          },
        },
      });

      await billingService.applyBillingWebhook({
        type: 'customer.subscription.deleted',
        data: {
          object: {
            metadata: { user_id: '7' },
            customer: 'cus_deleted',
            id: 'sub_deleted',
          },
        },
      });

      expect(entitlementService.setSubscriptionForUser).toHaveBeenNthCalledWith(1, '5', {
        provider: 'stripe',
        status: 'active',
        customerId: 'cus_checkout',
        subscriptionId: 'sub_checkout',
      });
      expect(entitlementService.setSubscriptionForUser).toHaveBeenNthCalledWith(2, '6', {
        provider: 'stripe',
        status: 'past_due',
        customerId: 'cus_updated',
        subscriptionId: 'sub_updated',
        currentPeriodEnd: new Date(1780000000 * 1000),
      });
      expect(entitlementService.setSubscriptionForUser).toHaveBeenNthCalledWith(3, '7', {
        provider: 'stripe',
        status: 'canceled',
        customerId: 'cus_deleted',
        subscriptionId: 'sub_deleted',
      });
    });

    it('maps Lemon Squeezy subscription events from all supported user id locations', async () => {
      const { billingService, entitlementService } = loadBillingService();

      await billingService.applyBillingWebhook({
        meta: {
          event_name: 'subscription_created',
          custom_data: { user_id: '11' },
        },
        data: {
          id: 'lem_created',
          attributes: { customer_id: 'cust_created' },
        },
      });

      await expect(billingService.applyBillingWebhook({
        meta: { event_name: 'subscription_updated' },
        data: {
          id: 'lem_updated',
          attributes: {
            custom_data: { user_id: '12' },
            customer_id: 'cust_updated',
            status: 'past_due',
            renews_at: '2026-07-01T00:00:00Z',
          },
        },
      })).resolves.toEqual({
        ignored: false,
        userId: 12,
        status: 'past_due',
        provider: 'lemon_squeezy',
      });

      await billingService.applyBillingWebhook({
        meta: { event_name: 'subscription_payment_failed' },
        data: {
          id: 'lem_failed',
          attributes: {
            checkout_data: { custom: { user_id: '13' } },
            customer_id: 'cust_failed',
            ends_at: '2026-08-01T00:00:00Z',
          },
        },
      });

      expect(entitlementService.setSubscriptionForUser).toHaveBeenNthCalledWith(1, '11', {
        provider: 'lemon_squeezy',
        status: 'active',
        customerId: 'cust_created',
        subscriptionId: 'lem_created',
      });
      expect(entitlementService.setSubscriptionForUser).toHaveBeenNthCalledWith(2, '12', {
        provider: 'lemon_squeezy',
        status: 'past_due',
        customerId: 'cust_updated',
        subscriptionId: 'lem_updated',
        currentPeriodEnd: '2026-07-01T00:00:00Z',
      });
      expect(entitlementService.setSubscriptionForUser).toHaveBeenNthCalledWith(3, '13', {
        provider: 'lemon_squeezy',
        status: 'canceled',
        customerId: 'cust_failed',
        subscriptionId: 'lem_failed',
        currentPeriodEnd: '2026-08-01T00:00:00Z',
      });
    });

    it('ignores unrecognized events and recognized events without a user id', async () => {
      const { billingService, entitlementService } = loadBillingService();

      await expect(billingService.applyBillingWebhook({ type: 'invoice.created' })).resolves.toEqual({
        ignored: true,
      });

      await expect(billingService.applyBillingWebhook({
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_without_user',
            subscription: 'sub_without_user',
          },
        },
      })).resolves.toEqual({
        ignored: true,
      });

      expect(entitlementService.setSubscriptionForUser).not.toHaveBeenCalled();
    });
  });
});
