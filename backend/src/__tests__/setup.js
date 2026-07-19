process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

if (process.env.CODEX_SANDBOX_NETWORK_DISABLED === '1') {
  jest.mock('supertest', () => require('./testClient'));
}

const { initializeDatabase, pool } = require('../config/database');
const { redisClient } = require('../config/redis');

beforeAll(async () => {
  await initializeDatabase();
});

afterEach(() => {
  jest.clearAllMocks();
});

afterAll(async () => {
  await new Promise((resolve) => {
    if (process.env.NODE_ENV === 'test') {
      pool.close(() => resolve());
      return;
    }

    pool.end().then(resolve).catch(resolve);
  });

  if (redisClient?.disconnect) {
    redisClient.disconnect();
  }
});
