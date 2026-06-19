const express = require('express');
const router = express.Router();
const suggestionController = require('../controllers/suggestionController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  registerDeviceMiddleware,
  requireFeature,
} = require('../middleware/entitlementMiddleware');

const proOnly = [authMiddleware, registerDeviceMiddleware, requireFeature('ml')];

/**
 * @swagger
 * /api/suggestions:
 *   get:
 *     summary: Get all suggestions
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of suggestions
 */
router.get('/', proOnly, suggestionController.getAllSuggestions);

/**
 * @swagger
 * /api/suggestions/duplicates:
 *   get:
 *     summary: Get duplicate suggestions
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of duplicate suggestions
 */
router.get('/duplicates', proOnly, suggestionController.getDuplicates);

/**
 * @swagger
 * /api/suggestions/stale:
 *   get:
 *     summary: Get stale tab suggestions
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stale tab suggestions
 */
router.get('/stale', proOnly, suggestionController.getStaleTabs);

/**
 * @swagger
 * /api/suggestions/related/{id}:
 *   get:
 *     summary: Get related content suggestions
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of related content suggestions
 */
router.get('/related/:id', proOnly, suggestionController.getRelatedContent);

/**
 * @swagger
 * /api/suggestions/generate:
 *   post:
 *     summary: Generate new suggestions
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Suggestions generated successfully
 */
router.post('/generate', proOnly, suggestionController.generateSuggestions);

/**
 * @swagger
 * /api/suggestions/{id}/accept:
 *   put:
 *     summary: Accept a suggestion
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Suggestion accepted successfully
 */
router.put('/:id/accept', proOnly, suggestionController.acceptSuggestion);

/**
 * @swagger
 * /api/suggestions/{id}/reject:
 *   put:
 *     summary: Reject a suggestion
 *     tags: [Suggestions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Suggestion rejected successfully
 */
router.put('/:id/reject', proOnly, suggestionController.rejectSuggestion);

module.exports = router;
