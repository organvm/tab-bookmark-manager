const crypto = require('crypto');
const db = require('../config/db');
const {
  applyBillingWebhook,
  createCheckoutUrl,
  verifyWebhook,
} = require('../services/billingService');
const { createAuthedUser, deleteUsersByEmail } = require('./helpers');

describe('billingService', () => {
  let user;

  const email = 'billing-service@example.com';
  const envKeys = [
    'PRO_CHECKOUT_PROVIDER',
    'PRO_CHECKOUT_URL',
    'LEMON_SQUEEZY_CHECKOUT_URL',
    'STRIPE_CHECKOUT_URL',
    'BILLING_WEBHOOK_SECRET',
    'STRIPE_WEBHOOK_SECRET',
    'LEMON_SQUEEZY_WEBHOOK_SECRET',
  ];
  let originalEnv;

  beforeAll(async () => {
    await deleteUsersByEmail([email]);
    user = await createAuthedUser({
      username: 'billingservice',
      email,
    });
  });

  beforeEach(() => {
    originalEnv = envKeys.reduce((env, key) => {
      env[key] = process.env[key];
      return env;
    }, {});

    envKeys.forEach(key => {
      delete process.env[key];
    });
  });

  afterEach(() => {
    envKeys.forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
  });

  it('creates a Lemon Squeezy checkout URL with user context', async () => {
    process.env.PRO_CHECKOUT_PROVIDER = 'lemon_squeezy';
    process.env.PRO_CHECKOUT_URL = 'https://checkout.example/lemon';

    const checkout = await createCheckoutUrl(user.userId);
    const checkoutUrl = new URL(checkout.url);

    expect(checkout.provider).toEqual('lemon_squeezy');
    expect(checkoutUrl.origin + checkoutUrl.pathname).toEqual('https://checkout.example/lemon');
    expect(checkoutUrl.searchParams.get('checkout[custom][user_id]')).toEqual(String(user.userId));
    expect(checkoutUrl.searchParams.get('checkout[email]')).toEqual(email);
  });

  it('throws a service error when checkout is not configured', async () => {
    await expect(createCheckoutUrl(user.userId)).rejects.toMatchObject({
      message: 'Pro checkout URL is not configured',
      statusCode: 503,
      details: expect.objectContaining({
        requiredEnv: expect.arrayContaining(['PRO_CHECKOUT_URL']),
      }),
    });
  });

  it('verifies webhook requests with a shared billing secret', () => {
    process.env.BILLING_WEBHOOK_SECRET = 'shared-secret';

    expect(verifyWebhook({
      headers: { 'x-billing-webhook-secret': 'shared-secret' },
      body: { ok: true },
    })).toBe(true);

    expect(verifyWebhook({
      headers: { 'x-billing-webhook-secret': 'wrong-secret' },
      body: { ok: true },
    })).toBe(false);
  });

  it('verifies Stripe webhook signatures using the raw request body', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'stripe-secret';

    const rawBody = JSON.stringify({ type: 'checkout.session.completed' });
    const timestamp = '1780000000';
    const signature = crypto
      .createHmac('sha256', 'stripe-secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    expect(verifyWebhook({
      headers: {
        'stripe-signature': `t=${timestamp},v1=${signature}`,
      },
      rawBody,
      body: JSON.parse(rawBody),
    })).toBe(true);
  });

  it('applies Stripe subscription webhooks to the user entitlement record', async () => {
    const result = await applyBillingWebhook({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: String(user.userId),
          customer: 'cus_service_test',
          subscription: 'sub_service_test',
        },
      },
    });

    expect(result).toEqual({
      ignored: false,
      userId: user.userId,
      status: 'active',
      provider: 'stripe',
    });

    const userResult = await db.query(
      `SELECT plan_tier, subscription_status, subscription_provider,
              subscription_customer_id, subscription_id
         FROM users
        WHERE id = $1`,
      [user.userId]
    );

    expect(userResult.rows[0]).toMatchObject({
      plan_tier: 'pro',
      subscription_status: 'active',
      subscription_provider: 'stripe',
      subscription_customer_id: 'cus_service_test',
      subscription_id: 'sub_service_test',
    });
  });

  it('ignores billing webhooks that do not include a recognized subscription event', async () => {
    await expect(applyBillingWebhook({ type: 'invoice.created' })).resolves.toEqual({
      ignored: true,
    });
  });
});
