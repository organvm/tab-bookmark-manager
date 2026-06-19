const express = require('express');
const router = express.Router();
const tabController = require('../controllers/tabController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  registerDeviceMiddleware,
  requireFeature,
} = require('../middleware/entitlementMiddleware');

/**
 * @swagger
 * /api/tabs:
 *   post:
 *     summary: Create a new tab
 *     tags: [Tabs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *               title:
 *                 type: string
 *               favicon:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tab created successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/', authMiddleware, registerDeviceMiddleware, tabController.createTab);

/**
 * @swagger
 * /api/tabs/bulk:
 *   post:
 *     summary: Create multiple tabs in bulk
 *     tags: [Tabs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tabs:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     url:
 *                       type: string
 *                     title:
 *                       type: string
 *     responses:
 *       201:
 *         description: Tabs created successfully
 */
router.post('/bulk', authMiddleware, registerDeviceMiddleware, requireFeature('sync'), tabController.bulkCreateTabs);

/**
 * @swagger
 * /api/tabs:
 *   get:
 *     summary: Get all tabs for the authenticated user
 *     tags: [Tabs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tabs
 */
router.get('/', authMiddleware, registerDeviceMiddleware, tabController.getAllTabs);

/**
 * @swagger
 * /api/tabs/stale/detect:
 *   get:
 *     summary: Detect stale tabs
 *     tags: [Tabs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stale tabs
 */
router.get('/stale/detect', authMiddleware, registerDeviceMiddleware, requireFeature('ml'), tabController.detectStaleTabs);

/**
 * @swagger
 * /api/tabs/{id}:
 *   get:
 *     summary: Get a tab by ID
 *     tags: [Tabs]
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
 *         description: Tab details
 *       404:
 *         description: Tab not found
 */
router.get('/:id', authMiddleware, registerDeviceMiddleware, tabController.getTabById);

/**
 * @swagger
 * /api/tabs/{id}:
 *   put:
 *     summary: Update a tab
 *     tags: [Tabs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tab updated successfully
 */
router.put('/:id', authMiddleware, registerDeviceMiddleware, tabController.updateTab);

/**
 * @swagger
 * /api/tabs/{id}:
 *   delete:
 *     summary: Delete a tab
 *     tags: [Tabs]
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
 *         description: Tab deleted successfully
 */
router.delete('/:id', authMiddleware, registerDeviceMiddleware, tabController.deleteTab);

/**
 * @swagger
 * /api/tabs/{id}/archive:
 *   post:
 *     summary: Archive a tab
 *     tags: [Tabs]
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
 *         description: Tab archived successfully
 */
router.post('/:id/archive', authMiddleware, registerDeviceMiddleware, tabController.archiveTab);

module.exports = router;
