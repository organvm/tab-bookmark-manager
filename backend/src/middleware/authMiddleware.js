const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { hashApiKey } = require('../services/apiKeyService');
const logger = require('../utils/logger');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

const JWT_SECRET = process.env.JWT_SECRET;

async function verifyJwtToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const revokedResult = await db.query('SELECT 1 FROM revoked_tokens WHERE token = $1', [token]);
    if (revokedResult.rows.length > 0) {
      return { ok: false, status: 401, message: 'Token has been revoked', terminal: true };
    }

    return {
      ok: true,
      userId: decoded.userId,
      auth: { type: 'jwt', token },
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { ok: false, status: 401, message: 'Token has expired', terminal: true };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return { ok: false, terminal: false };
    }

    logger.error('Error verifying token:', error);
    return { ok: false, status: 401, message: 'Invalid token', terminal: true };
  }
}

async function verifyApiKey(apiKey) {
  const keyHash = hashApiKey(apiKey);
  const result = await db.query(
    `SELECT id, user_id, key_prefix
     FROM api_keys
     WHERE key_hash = $1 AND revoked_at IS NULL`,
    [keyHash]
  );

  const record = result.rows[0];
  if (!record) {
    return null;
  }

  await db.run('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [record.id]);

  return {
    userId: record.user_id,
    auth: {
      type: 'api_key',
      apiKeyId: record.id,
      keyPrefix: record.key_prefix,
    },
  };
}

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const headerApiKey = req.headers['x-api-key'];

  if ((!authHeader || !authHeader.startsWith('Bearer ')) && !headerApiKey) {
    return res.status(401).json({ message: 'Authorization token or API key is required' });
  }

  try {
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (bearerToken) {
      const jwtResult = await verifyJwtToken(bearerToken);

      if (jwtResult.ok) {
        req.user = { id: jwtResult.userId };
        req.auth = jwtResult.auth;
        return next();
      }

      if (jwtResult.terminal) {
        return res.status(jwtResult.status).json({ message: jwtResult.message });
      }

      const apiKeyResult = await verifyApiKey(bearerToken);
      if (apiKeyResult) {
        req.user = { id: apiKeyResult.userId };
        req.auth = apiKeyResult.auth;
        return next();
      }
    }

    if (headerApiKey) {
      const apiKeyResult = await verifyApiKey(headerApiKey);
      if (apiKeyResult) {
        req.user = { id: apiKeyResult.userId };
        req.auth = apiKeyResult.auth;
        return next();
      }
    }

    return res.status(401).json({ message: 'Invalid token or API key' });
  } catch (error) {
    logger.error('Error verifying authorization credentials:', error);
    return res.status(401).json({ message: 'Invalid token or API key' });
  }
};

module.exports = authMiddleware;
