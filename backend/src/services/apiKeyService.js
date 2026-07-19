const crypto = require('crypto');

const API_KEY_PREFIX = process.env.API_KEY_PREFIX || 'tbm_';
const API_KEY_BYTES = 32;
const MAX_KEY_PREFIX_LENGTH = 64;

function generateApiKey() {
  return `${API_KEY_PREFIX}${crypto.randomBytes(API_KEY_BYTES).toString('hex')}`;
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

function getKeyPrefix(apiKey) {
  return apiKey.slice(0, Math.min(apiKey.length, API_KEY_PREFIX.length + 8, MAX_KEY_PREFIX_LENGTH));
}

module.exports = {
  API_KEY_PREFIX,
  generateApiKey,
  getKeyPrefix,
  hashApiKey,
};
