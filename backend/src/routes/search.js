const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  registerDeviceMiddleware,
  requireFeature,
} = require('../middleware/entitlementMiddleware');

/**
 * @swagger
 * /api/search/semantic:
 *   post:
 *     summary: Semantic search using embeddings
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               query:
 *                 type: string
 *               limit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Search results
 */
router.post('/semantic', authMiddleware, registerDeviceMiddleware, requireFeature('ml'), searchController.semanticSearch);

/**
 * @swagger
 * /api/search/text:
 *   get:
 *     summary: Text-based search
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/text', authMiddleware, registerDeviceMiddleware, searchController.textSearch);

/**
 * @swagger
 * /api/search/similar/{id}:
 *   get:
 *     summary: Find similar items
 *     tags: [Search]
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
 *         description: Similar items
 */
router.get('/similar/:id', authMiddleware, registerDeviceMiddleware, requireFeature('ml'), searchController.findSimilar);

module.exports = router;
