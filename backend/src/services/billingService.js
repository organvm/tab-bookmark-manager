const crypto = require('crypto');
const { getUserRecord, setSubscriptionForUser } = require('./entitlementService');

function configuredCheckout() {
  const provider = process.env.PRO_CHECKOUT_PROVIDER ||
    (process.env.LEMON_SQUEEZY_CHECKOUT_URL ? 'lemon_squeezy' : undefined) ||
    (process.env.STRIPE_CHECKOUT_URL ? 'stripe' : undefined) ||
    'external';

  const url = process.env.PRO_CHECKOUT_URL ||
    process.env.LEMON_SQUEEZY_CHECKOUT_URL ||
    process.env.STRIPE_CHECKOUT_URL;

  return { provider, url };
}

function appendCheckoutContext(checkoutUrl, provider, user) {
  const url = new URL(checkoutUrl);

  if (provider === 'stripe') {
    url.searchParams.set('client_reference_id', String(user.id));
    if (user.email) {
      url.searchParams.set('prefilled_email', user.email);
    }
  } else if (provider === 'lemon_squeezy') {
    url.searchParams.set('checkout[custom][user_id]', String(user.id));
    if (user.email) {
      url.searchParams.set('checkout[email]', user.email);
    }
  } else {
    url.searchParams.set('user_id', String(user.id));
    if (user.email) {
      url.searchParams.set('email', user.email);
    }
  }

  return url.toString();
}

async function createCheckoutUrl(userId) {
  const user = await getUserRecord(userId);
  const checkout = configuredCheckout();

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  if (!checkout.url) {
    const error = new Error('Pro checkout URL is not configured');
    error.statusCode = 503;
    error.details = {
      requiredEnv: [
        'PRO_CHECKOUT_URL',
        'LEMON_SQUEEZY_CHECKOUT_URL',
        'STRIPE_CHECKOUT_URL',
      ],
    };
    throw error;
  }

  return {
    provider: checkout.provider,
    url: appendCheckoutContext(checkout.url, checkout.provider, user),
  };
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyLemonSignature(req) {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const signature = req.headers['x-signature'];

  if (!secret) {
    return null;
  }

  const digest = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || JSON.stringify(req.body || {}))
    .digest('hex');

  return timingSafeEqual(digest, signature);
}

function verifyStripeSignature(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  if (!secret) {
    return null;
  }

  const parts = String(signature || '').split(',').reduce((acc, pair) => {
    const [key, value] = pair.split('=');
    if (key && value) {
      acc[key] = value;
    }
    return acc;
  }, {});

  if (!parts.t || !parts.v1) {
    return false;
  }

  const signedPayload = `${parts.t}.${req.rawBody || JSON.stringify(req.body || {})}`;
  const digest = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  return timingSafeEqual(digest, parts.v1);
}

function verifySharedWebhookSecret(req) {
  const secret = process.env.BILLING_WEBHOOK_SECRET;

  if (!secret) {
    return null;
  }

  return timingSafeEqual(secret, req.headers['x-billing-webhook-secret']);
}

function verifyWebhook(req) {
  const checks = [
    verifyStripeSignature(req),
    verifyLemonSignature(req),
    verifySharedWebhookSecret(req),
  ].filter(result => result !== null);

  if (checks.length === 0) {
    return process.env.NODE_ENV !== 'production';
  }

  return checks.some(Boolean);
}

function statusFromStripe(event) {
  const type = event.type;
  const object = event.data?.object || {};

  if (type === 'checkout.session.completed') {
    return {
      status: 'active',
      customerId: object.customer,
      subscriptionId: object.subscription,
    };
  }

  if (type === 'customer.subscription.deleted') {
    return {
      status: 'canceled',
      customerId: object.customer,
      subscriptionId: object.id,
    };
  }

  if (type === 'customer.subscription.updated') {
    return {
      status: object.status || 'inactive',
      customerId: object.customer,
      subscriptionId: object.id,
      currentPeriodEnd: object.current_period_end
        ? new Date(object.current_period_end * 1000)
        : null,
    };
  }

  return null;
}

function userIdFromStripe(event) {
  const object = event.data?.object || {};
  return object.client_reference_id || object.metadata?.user_id;
}

function statusFromLemon(event) {
  const eventName = event.meta?.event_name;
  const attributes = event.data?.attributes || {};

  if (['subscription_created', 'subscription_resumed', 'subscription_payment_success'].includes(eventName)) {
    return {
      status: 'active',
      customerId: attributes.customer_id,
      subscriptionId: event.data?.id,
    };
  }

  if (eventName === 'subscription_updated') {
    return {
      status: attributes.status || 'inactive',
      customerId: attributes.customer_id,
      subscriptionId: event.data?.id,
      currentPeriodEnd: attributes.renews_at || attributes.ends_at || null,
    };
  }

  if (['subscription_cancelled', 'subscription_expired', 'subscription_paused', 'subscription_payment_failed'].includes(eventName)) {
    return {
      status: attributes.status || 'canceled',
      customerId: attributes.customer_id,
      subscriptionId: event.data?.id,
      currentPeriodEnd: attributes.ends_at || null,
    };
  }

  return null;
}

function userIdFromLemon(event) {
  return event.meta?.custom_data?.user_id ||
    event.data?.attributes?.custom_data?.user_id ||
    event.data?.attributes?.checkout_data?.custom?.user_id;
}

async function applyBillingWebhook(event) {
  const stripeSubscription = statusFromStripe(event);
  const lemonSubscription = statusFromLemon(event);
  const subscription = stripeSubscription || lemonSubscription;
  const provider = stripeSubscription ? 'stripe' : 'lemon_squeezy';
  const userId = stripeSubscription ? userIdFromStripe(event) : userIdFromLemon(event);

  if (!subscription || !userId) {
    return { ignored: true };
  }

  await setSubscriptionForUser(userId, {
    provider,
    ...subscription,
  });

  return {
    ignored: false,
    userId: Number(userId),
    status: subscription.status,
    provider,
  };
}

module.exports = {
  applyBillingWebhook,
  createCheckoutUrl,
  verifyWebhook,
};
