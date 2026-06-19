const request = require('supertest');
const { app } = require('../index');
const { pool } = require('../config/database');

describe('Auth Endpoints', () => {
  let token;

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
