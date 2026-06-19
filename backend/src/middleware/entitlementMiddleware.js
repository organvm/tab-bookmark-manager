const {
  getUserEntitlements,
  getUsage,
  registerDevice,
} = require('../services/entitlementService');

function upgradeResponse(res, message, entitlements, feature) {
  return res.status(402).json({
    error: 'upgrade_required',
    message,
    feature,
    upgrade: entitlements?.upgrade || {
      tier: 'pro',
      priceDisplay: '$4.99/mo',
    },
    limits: entitlements?.limits,
    usage: entitlements?.usage,
  });
}

async function registerDeviceMiddleware(req, res, next) {
  try {
    const deviceId = req.headers['x-device-id'];
    const deviceLabel = req.headers['x-device-label'];

    if (!deviceId) {
      return next();
    }

    const result = await registerDevice(req.user.id, deviceId, deviceLabel);

    if (result.reason === 'device_limit') {
      return upgradeResponse(
        res,
        'Free accounts are limited to one device. Upgrade to Pro to sync across devices.',
        result.entitlement,
        'devices'
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const entitlements = await getUserEntitlements(req.user.id);

      if (!entitlements?.features?.[feature]) {
        const messages = {
          ml: 'AI suggestions, semantic search, and similarity features require Pro.',
          sync: 'Bulk tab and bookmark sync requires Pro.',
        };

        return upgradeResponse(
          res,
          messages[feature] || 'This feature requires Pro.',
          entitlements,
          feature
        );
      }

      req.entitlements = entitlements;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

async function enforceBookmarkLimit(req, res, next) {
  try {
    const entitlements = await getUserEntitlements(req.user.id);
    const limit = entitlements?.limits?.bookmarks;

    if (limit === null || limit === undefined) {
      req.entitlements = entitlements;
      return next();
    }

    const incomingCount = Array.isArray(req.body?.bookmarks) ? req.body.bookmarks.length : 1;
    const usage = await getUsage(req.user.id);

    if (usage.bookmarks + incomingCount > limit) {
      return upgradeResponse(
        res,
        `Free accounts can save up to ${limit} bookmarks. Upgrade to Pro for unlimited bookmarks.`,
        { ...entitlements, usage },
        'bookmarks'
      );
    }

    req.entitlements = { ...entitlements, usage };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  enforceBookmarkLimit,
  registerDeviceMiddleware,
  requireFeature,
};
