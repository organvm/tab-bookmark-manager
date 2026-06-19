const bcrypt = require('bcryptjs');
const db = require('../config/db');
const logger = require('../utils/logger');
const Joi = require('joi');

// Validation schemas
const updateEmailSchema = Joi.object({
  email: Joi.string().email().required()
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

const updateProfileSchema = Joi.object({
  username: Joi.string().min(3).max(50).optional()
});

/**
 * Get user profile
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT id, username, email, plan_tier, subscription_status,
              subscription_provider, subscription_current_period_end, created_at
         FROM users
        WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching user profile:', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * Update user email
 */
exports.updateEmail = async (req, res) => {
  try {
    const { error } = updateEmailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const userId = req.user.id;
    const { email } = req.body;

    // Check if email already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    await db.query(
      'UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [email, userId]
    );

    logger.info('User email updated successfully', { userId, newEmail: email });
    res.json({ message: 'Email updated successfully', email });
  } catch (error) {
    logger.error('Error updating email:', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * Update user password
 */
exports.updatePassword = async (req, res) => {
  try {
    const { error } = updatePasswordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedPassword, userId]
    );

    logger.info('User password updated successfully', { userId });
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Error updating password:', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * Update user profile (username)
 */
exports.updateProfile = async (req, res) => {
  try {
    const { error } = updateProfileSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const userId = req.user.id;
    const { username } = req.body;

    if (username) {
      // Check if username already exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ message: 'Username already in use' });
      }

      await db.query(
        'UPDATE users SET username = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [username, userId]
      );

      logger.info('User profile updated successfully', { userId, username });
      res.json({ message: 'Profile updated successfully', username });
    } else {
      res.status(400).json({ message: 'No fields to update' });
    }
  } catch (error) {
    logger.error('Error updating profile:', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

/**
 * Delete user account
 */
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete user's data
    await db.query('DELETE FROM tabs WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM bookmarks WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM suggestions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM archived_pages WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);

    logger.info('User account deleted successfully', { userId });
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Error deleting account:', { error: error.message, userId: req.user.id });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
