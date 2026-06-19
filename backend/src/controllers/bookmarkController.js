const db = require('../config/db');
const { contentAnalysisQueue } = require('../config/queue');
const { getUserEntitlements } = require('../services/entitlementService');
const logger = require('../utils/logger');

exports.createBookmark = async (req, res) => {
  try {
    const { url, title, favicon, folder, content } = req.body;
    const userId = req.user.id;
    
    const result = await db.query(
      'INSERT INTO bookmarks (url, title, favicon, folder, content, user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [url, title, favicon, folder, content, userId]
    );
    
    const bookmark = result.rows[0];
    
    const entitlements = req.entitlements || await getUserEntitlements(userId);

    // Queue content analysis for Pro users only.
    if (content && entitlements?.features?.ml) {
      await contentAnalysisQueue.add({
        itemId: bookmark.id,
        itemType: 'bookmark',
        url,
        content
      });
    }
    
    res.status(201).json(bookmark);
  } catch (error) {
    logger.error('Error creating bookmark:', error);
    res.status(500).json({ error: 'Failed to create bookmark' });
  }
};

exports.getAllBookmarks = async (req, res) => {
  try {
    const { limit = 100, offset = 0, folder, archived = false } = req.query;
    const userId = req.user.id;
    
    let query = 'SELECT * FROM bookmarks WHERE is_archived = $1 AND user_id = $2';
    const params = [archived, userId];
    
    if (folder) {
      query += ' AND folder = $3';
      params.push(folder);
    }
    
    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);
    
    const result = await db.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching bookmarks:', error);
    res.status(500).json({ error: 'Failed to fetch bookmarks' });
  }
};

exports.getBookmarkById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await db.query('SELECT * FROM bookmarks WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching bookmark:', error);
    res.status(500).json({ error: 'Failed to fetch bookmark' });
  }
};

exports.updateBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, folder, content, tags, category } = req.body;
    const userId = req.user.id;
    
    await db.run(
      'UPDATE bookmarks SET title = COALESCE($1, title), folder = COALESCE($2, folder), content = COALESCE($3, content), tags = COALESCE($4, tags), category = COALESCE($5, category), updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7',
      [title, folder, content, tags, category, id, userId]
    );
    
    const bookmark = await db.get('SELECT * FROM bookmarks WHERE id = $1 AND user_id = $2', [id, userId]);

    if (!bookmark) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }
    
    res.json(bookmark);
  } catch (error) {
    logger.error('Error updating bookmark:', error);
    res.status(500).json({ error: 'Failed to update bookmark' });
  }
};

exports.deleteBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await db.run('DELETE FROM bookmarks WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }
    
    res.json({ message: 'Bookmark deleted successfully' });
  } catch (error) {
    logger.error('Error deleting bookmark:', error);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
};

exports.archiveBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const { archivalQueue } = require('../config/queue');
    const userId = req.user.id;
    
    const result = await db.query('SELECT * FROM bookmarks WHERE id = $1 AND user_id = $2', [id, userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bookmark not found' });
    }
    
    const bookmark = result.rows[0];
    
    // Queue archival job
    await archivalQueue.add({ url: bookmark.url, itemId: id, itemType: 'bookmark' });
    
    // Mark as archived
    await db.run('UPDATE bookmarks SET is_archived = TRUE WHERE id = $1', [id]);
    
    res.json({ message: 'Bookmark queued for archival' });
  } catch (error) {
    logger.error('Error archiving bookmark:', error);
    res.status(500).json({ error: 'Failed to archive bookmark' });
  }
};

exports.bulkCreateBookmarks = async (req, res) => {
  try {
    const { bookmarks } = req.body;
    const userId = req.user.id;
    const { bulkImportQueue } = require('../config/queue');

    await bulkImportQueue.add({ items: bookmarks, userId, type: 'bookmark' });

    res.status(202).json({ message: 'Bookmark import process started' });
  } catch (error) {
    logger.error('Error bulk creating bookmarks:', error);
    res.status(500).json({ error: 'Failed to bulk create bookmarks' });
  }
};
