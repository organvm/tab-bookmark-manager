const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const authMiddleware = require('../middleware/authMiddleware');
const { registerDeviceMiddleware } = require('../middleware/entitlementMiddleware');

router.get('/plan', authMiddleware, registerDeviceMiddleware, billingController.getPlan);
router.post('/checkout', authMiddleware, registerDeviceMiddleware, billingController.createCheckout);
router.post('/webhook', billingController.handleWebhook);

module.exports = router;
