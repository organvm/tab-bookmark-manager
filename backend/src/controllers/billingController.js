const { getUserEntitlements } = require('../services/entitlementService');
const {
  applyBillingWebhook,
  createCheckoutUrl,
  verifyWebhook,
} = require('../services/billingService');
const logger = require('../utils/logger');

exports.getPlan = async (req, res) => {
  try {
    const entitlements = await getUserEntitlements(req.user.id);

    if (!entitlements) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(entitlements);
  } catch (error) {
    logger.error('Error fetching billing plan:', error);
    res.status(500).json({ error: 'Failed to fetch billing plan' });
  }
};

exports.createCheckout = async (req, res) => {
  try {
    const entitlements = await getUserEntitlements(req.user.id);

    if (entitlements?.plan?.tier === 'pro') {
      return res.json({
        alreadyPro: true,
        plan: entitlements.plan,
      });
    }

    const checkout = await createCheckoutUrl(req.user.id);

    res.json({
      ...checkout,
      plan: {
        tier: 'pro',
        priceDisplay: '$4.99/mo',
      },
    });
  } catch (error) {
    logger.error('Error creating checkout:', error);
    res.status(error.statusCode || 500).json({
      error: 'checkout_unavailable',
      message: error.message || 'Failed to create checkout',
      details: error.details,
    });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    if (!verifyWebhook(req)) {
      return res.status(401).json({ error: 'invalid_signature' });
    }

    const result = await applyBillingWebhook(req.body);

    res.json(result);
  } catch (error) {
    logger.error('Error handling billing webhook:', error);
    res.status(500).json({ error: 'Failed to handle billing webhook' });
  }
};
