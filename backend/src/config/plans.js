const parseLimit = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const FREE_BOOKMARK_LIMIT = parseLimit(process.env.FREE_BOOKMARK_LIMIT, 100);
const FREE_DEVICE_LIMIT = parseLimit(process.env.FREE_DEVICE_LIMIT, 1);

const PRO_PRICE_CENTS = 499;
const PRO_PRICE_DISPLAY = '$4.99/mo';

const PLAN_TIERS = {
  free: {
    tier: 'free',
    name: 'Free',
    priceCents: 0,
    priceDisplay: '$0/mo',
    limits: {
      bookmarks: FREE_BOOKMARK_LIMIT,
      devices: FREE_DEVICE_LIMIT,
    },
    features: {
      ml: false,
      sync: false,
    },
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceCents: PRO_PRICE_CENTS,
    priceDisplay: PRO_PRICE_DISPLAY,
    limits: {
      bookmarks: null,
      devices: null,
    },
    features: {
      ml: true,
      sync: true,
    },
  },
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

module.exports = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  FREE_BOOKMARK_LIMIT,
  FREE_DEVICE_LIMIT,
  PLAN_TIERS,
  PRO_PRICE_CENTS,
  PRO_PRICE_DISPLAY,
};
