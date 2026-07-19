const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const {
  generateApiKey,
  getKeyPrefix,
  hashApiKey,
} = require('../services/apiKeyService');
const logger = require('../utils/logger');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

function requireJwtSession(req, res) {
  if (req.auth?.type !== 'jwt') {
    res.status(403).json({ message: 'JWT session is required for API key management' });
    return false;
  }

  return true;
}

exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please provide all required fields.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [username, email, hashedPassword]
    );
    res.status(201).json({ message: 'User registered successfully', userId: result.rows[0].id });
  } catch (error) {
    logger.error('Error registering user:', error);
    if (error.constraint === 'users_username_key' || error.constraint === 'users_email_key') {
      return res.status(409).json({ message: 'Username or email already exists.' });
    }
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Please provide email and password.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({ token });
  } catch (error) {
    logger.error('Error logging in user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.logout = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token is required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    await db.run(
      'INSERT INTO revoked_tokens (token, expires_at) VALUES ($1, $2)',
      [token, new Date(decoded.exp * 1000)]
    );

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    logger.error('Error logging out user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.verify = async (req, res) => {
  res.json({
    authenticated: true,
    userId: req.user.id,
    authType: req.auth?.type || 'unknown',
  });
};

exports.createApiKey = async (req, res) => {
  if (!requireJwtSession(req, res)) {
    return;
  }

  const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const name = rawName || 'Default API key';

  if (name.length > 100) {
    return res.status(400).json({ message: 'API key name must be 100 characters or fewer.' });
  }

  try {
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = getKeyPrefix(apiKey);

    const result = await db.query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, key_prefix, created_at`,
      [req.user.id, name, keyHash, keyPrefix]
    );

    const record = result.rows[0];

    res.status(201).json({
      id: record.id,
      name: record.name,
      key: apiKey,
      keyPrefix: record.key_prefix,
      createdAt: record.created_at,
      message: 'Store this API key now. It will not be shown again.',
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.listApiKeys = async (req, res) => {
  if (!requireJwtSession(req, res)) {
    return;
  }

  try {
    const result = await db.query(
      `SELECT id, name, key_prefix, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows.map((record) => ({
      id: record.id,
      name: record.name,
      keyPrefix: record.key_prefix,
      createdAt: record.created_at,
      lastUsedAt: record.last_used_at,
      revokedAt: record.revoked_at,
    })));
  } catch (error) {
    logger.error('Error listing API keys:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.revokeApiKey = async (req, res) => {
  if (!requireJwtSession(req, res)) {
    return;
  }

  try {
    const result = await db.run(
      `UPDATE api_keys
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'API key not found' });
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    logger.error('Error revoking API key:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
