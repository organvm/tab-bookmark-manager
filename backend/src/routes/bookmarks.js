const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  enforceBookmarkLimit,
  registerDeviceMiddleware,
  requireFeature,
} = require('../middleware/entitlementMiddleware');

/**
 * @swagger
 * /api/bookmarks:
 *   post:
 *     summary: Create a new bookmark
 *     tags: [Bookmarks]
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
 *               folder:
 *                 type: string
 *     responses:
 *       201:
 *         description: Bookmark created successfully
 */
router.post('/', authMiddleware, registerDeviceMiddleware, enforceBookmarkLimit, bookmarkController.createBookmark);

/**
 * @swagger
 * /api/bookmarks/bulk:
 *   post:
 *     summary: Create multiple bookmarks in bulk
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Bookmarks created successfully
 */
router.post('/bulk', authMiddleware, registerDeviceMiddleware, requireFeature('sync'), bookmarkController.bulkCreateBookmarks);

/**
 * @swagger
 * /api/bookmarks:
 *   get:
 *     summary: Get all bookmarks for the authenticated user
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of bookmarks
 */
router.get('/', authMiddleware, registerDeviceMiddleware, bookmarkController.getAllBookmarks);

/**
 * @swagger
 * /api/bookmarks/{id}:
 *   get:
 *     summary: Get a bookmark by ID
 *     tags: [Bookmarks]
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
 *         description: Bookmark details
 */
router.get('/:id', authMiddleware, registerDeviceMiddleware, bookmarkController.getBookmarkById);

/**
 * @swagger
 * /api/bookmarks/{id}:
 *   put:
 *     summary: Update a bookmark
 *     tags: [Bookmarks]
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
 *         description: Bookmark updated successfully
 */
router.put('/:id', authMiddleware, registerDeviceMiddleware, bookmarkController.updateBookmark);

/**
 * @swagger
 * /api/bookmarks/{id}:
 *   delete:
 *     summary: Delete a bookmark
 *     tags: [Bookmarks]
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
 *         description: Bookmark deleted successfully
 */
router.delete('/:id', authMiddleware, registerDeviceMiddleware, bookmarkController.deleteBookmark);

/**
 * @swagger
 * /api/bookmarks/{id}/archive:
 *   post:
 *     summary: Archive a bookmark
 *     tags: [Bookmarks]
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
 *         description: Bookmark archived successfully
 */
router.post('/:id/archive', authMiddleware, registerDeviceMiddleware, bookmarkController.archiveBookmark);

module.exports = router;
