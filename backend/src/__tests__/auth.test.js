const request = require('supertest');
const { app } = require('../index');
const { pool } = require('../config/database');
const { API_KEY_PREFIX } = require('../services/apiKeyService');

describe('Auth Endpoints', () => {
  let token;
  let apiKey;
  let apiKeyId;

  beforeAll(async () => {
    // a user for testing
    await new Promise(resolve => pool.run('DELETE FROM users WHERE email = ?', ['test@example.com'], resolve));
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });
  });

  it('should login a user and return a token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  it('should not access a protected route without a token', async () => {
    const res = await request(app).post('/api/tabs').send({ url: 'http://example.com' });
    expect(res.statusCode).toEqual(401);
  });

  it('should access a protected route with a token', async () => {
    const res = await request(app)
      .post('/api/tabs')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com', title: 'Test Tab' });
    expect(res.statusCode).toEqual(201);
  });

  it('should issue an API key for an authenticated user', async () => {
    const res = await request(app)
      .post('/api/auth/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'test cli' });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toMatchObject({
      name: 'test cli',
      message: 'Store this API key now. It will not be shown again.',
    });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('key');
    expect(res.body).toHaveProperty('keyPrefix');
    expect(res.body.key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(res.body.key).toHaveLength(API_KEY_PREFIX.length + 64);
    expect(res.body).not.toHaveProperty('keyHash');

    apiKey = res.body.key;
    apiKeyId = res.body.id;
  });

  it('should verify an API key from the X-API-Key header', async () => {
    const res = await request(app)
      .get('/api/auth/verify')
      .set('X-API-Key', apiKey);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toMatchObject({
      authenticated: true,
      authType: 'api_key',
    });
  });

  it('should access a protected route with an API key header', async () => {
    const res = await request(app)
      .post('/api/bookmarks')
      .set('X-API-Key', apiKey)
      .send({ url: 'http://example.com/docs', title: 'Docs' });

    expect(res.statusCode).toEqual(201);
  });

  it('should access a protected route with an API key bearer token', async () => {
    const res = await request(app)
      .post('/api/tabs')
      .set('Authorization', `Bearer ${apiKey}`)
      .send({ url: 'http://example.com/api-key', title: 'API Key Tab' });

    expect(res.statusCode).toEqual(201);
  });

  it('should not issue an API key using an API key credential', async () => {
    const res = await request(app)
      .post('/api/auth/api-keys')
      .set('X-API-Key', apiKey)
      .send({ name: 'chained key' });

    expect(res.statusCode).toEqual(403);
  });

  it('should list API keys without exposing raw keys or hashes', async () => {
    const res = await request(app)
      .get('/api/auth/api-keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: apiKeyId,
          name: 'test cli',
          keyPrefix: expect.any(String),
        }),
      ])
    );
    expect(res.body[0]).not.toHaveProperty('key');
    expect(res.body[0]).not.toHaveProperty('keyHash');
  });

  it('should revoke an API key', async () => {
    const res = await request(app)
      .delete(`/api/auth/api-keys/${apiKeyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
  });

  it('should not access a protected route with a revoked API key', async () => {
    const res = await request(app)
      .post('/api/tabs')
      .set('X-API-Key', apiKey)
      .send({ url: 'http://example.com/revoked', title: 'Revoked Key Tab' });

    expect(res.statusCode).toEqual(401);
  });

  it('should logout a user', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toEqual(200);
  });

  it('should not access a protected route with a revoked token', async () => {
    const res = await request(app)
      .post('/api/tabs')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'http://example.com', title: 'Test Tab 2' });
    expect(res.statusCode).toEqual(401);
  });
});
