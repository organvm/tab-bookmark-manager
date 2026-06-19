const db = require('../config/db');
const {
  ACTIVE_SUBSCRIPTION_STATUSES,
  PLAN_TIERS,
  PRO_PRICE_DISPLAY,
} = require('../config/plans');

function normalizeSubscriptionStatus(status) {
  return status || 'inactive';
}

function isProSubscription(user) {
  return (
    user?.plan_tier === 'pro' &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(normalizeSubscriptionStatus(user.subscription_status))
  );
}

function planForUser(user) {
  return isProSubscription(user) ? PLAN_TIERS.pro : PLAN_TIERS.free;
}

async function getUserRecord(userId) {
  const result = await db.query(
    `SELECT id, email, plan_tier, subscription_status, subscription_provider,
            subscription_customer_id, subscription_id, subscription_current_period_end
       FROM users
      WHERE id = $1`,
    [userId]
  );

  return result.rows[0];
}

async function getUsage(userId) {
  const [bookmarksResult, tabsResult, devicesResult] = await Promise.all([
    db.query('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = $1 AND is_archived = $2', [userId, false]),
    db.query('SELECT COUNT(*) as count FROM tabs WHERE user_id = $1 AND is_archived = $2', [userId, false]),
    db.query('SELECT COUNT(*) as count FROM user_devices WHERE user_id = $1', [userId]),
  ]);

  return {
    bookmarks: Number(bookmarksResult.rows[0]?.count || 0),
    tabs: Number(tabsResult.rows[0]?.count || 0),
    devices: Number(devicesResult.rows[0]?.count || 0),
  };
}

async function getUserEntitlements(userId) {
  const user = await getUserRecord(userId);

  if (!user) {
    return null;
  }

  const plan = planForUser(user);
  const usage = await getUsage(userId);

  return {
    plan: {
      tier: plan.tier,
      name: plan.name,
      priceCents: plan.priceCents,
      priceDisplay: plan.priceDisplay,
    },
    subscription: {
      status: normalizeSubscriptionStatus(user.subscription_status),
      provider: user.subscription_provider || null,
      currentPeriodEnd: user.subscription_current_period_end || null,
    },
    limits: plan.limits,
    features: plan.features,
    usage,
    upgrade: {
      tier: PLAN_TIERS.pro.tier,
      priceDisplay: PRO_PRICE_DISPLAY,
    },
  };
}

async function registerDevice(userId, deviceId, label) {
  if (!deviceId) {
    return { registered: false, reason: 'missing_device_id' };
  }

  const entitlements = await getUserEntitlements(userId);
  if (!entitlements) {
    return { registered: false, reason: 'user_not_found' };
  }

  const existing = await db.query(
    'SELECT id FROM user_devices WHERE user_id = $1 AND device_id = $2',
    [userId, deviceId]
  );

  if (existing.rows.length === 0 && entitlements.limits.devices !== null) {
    const usage = await getUsage(userId);
    if (usage.devices >= entitlements.limits.devices) {
      return {
        registered: false,
        reason: 'device_limit',
        entitlement: entitlements,
      };
    }
  }

  await db.run(
    `INSERT INTO user_devices (user_id, device_id, label)
     VALUES ($1, $2, $3)
     ON CONFLICT(user_id, device_id)
     DO UPDATE SET last_seen = CURRENT_TIMESTAMP,
                   label = COALESCE(excluded.label, user_devices.label)`,
    [userId, deviceId, label || null]
  );

  return { registered: true };
}

async function setSubscriptionForUser(userId, subscription) {
  const status = normalizeSubscriptionStatus(subscription.status);
  const planTier = ACTIVE_SUBSCRIPTION_STATUSES.has(status) ? 'pro' : 'free';

  await db.run(
    `UPDATE users
        SET plan_tier = $1,
            subscription_status = $2,
            subscription_provider = COALESCE($3, subscription_provider),
            subscription_customer_id = COALESCE($4, subscription_customer_id),
            subscription_id = COALESCE($5, subscription_id),
            subscription_current_period_end = COALESCE($6, subscription_current_period_end),
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $7`,
    [
      planTier,
      status,
      subscription.provider || null,
      subscription.customerId || null,
      subscription.subscriptionId || null,
      subscription.currentPeriodEnd || null,
      userId,
    ]
  );
}

module.exports = {
  getUsage,
  getUserEntitlements,
  getUserRecord,
  isProSubscription,
  registerDevice,
  setSubscriptionForUser,
};
