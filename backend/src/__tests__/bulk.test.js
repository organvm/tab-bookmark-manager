const request = require('supertest');
const { app } = require('../index');
const db = require('../config/db');
const { pool } = require('../config/database');
const { bulkImportQueue } = require('../config/queue');

describe('Bulk Import Endpoints', () => {
  let token;
  let userId;

  beforeAll(async () => {
    // a user for testing
    await new Promise(resolve => pool.run('DELETE FROM users WHERE email = ?', ['test@example.com'], resolve));
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });
    userId = registerRes.body.userId;
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });
    token = loginRes.body.token;

    await db.run(
      'UPDATE users SET plan_tier = $1, subscription_status = $2 WHERE id = $3',
      ['pro', 'active', userId]
    );
  });

  it('should queue a bulk import job for tabs', async () => {
    const tabs = [
      { url: 'http://example.com/1', title: 'Tab 1' },
      { url: 'http://example.com/2', title: 'Tab 2' },
    ];
    const res = await request(app)
      .post('/api/tabs/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ tabs });
    expect(res.statusCode).toEqual(202);
    expect(bulkImportQueue.add).toHaveBeenCalledWith({ items: tabs, userId, type: 'tab' });
  });

  it('should queue a bulk import job for bookmarks', async () => {
    const bookmarks = [
      { url: 'http://example.com/3', title: 'Bookmark 1' },
      { url: 'http://example.com/4', title: 'Bookmark 2' },
    ];
    const res = await request(app)
      .post('/api/bookmarks/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ bookmarks });
    expect(res.statusCode).toEqual(202);
    expect(bulkImportQueue.add).toHaveBeenCalledWith({ items: bookmarks, userId, type: 'bookmark' });
  });
});
