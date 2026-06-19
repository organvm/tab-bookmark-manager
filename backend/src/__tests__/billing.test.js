const request = require('supertest');
const { app } = require('../index');
const db = require('../config/db');
const { pool } = require('../config/database');
const { bulkImportQueue } = require('../config/queue');

describe('Freemium billing and entitlements', () => {
  let token;
  let userId;
  let originalCheckoutProvider;
  let originalCheckoutUrl;

  beforeAll(async () => {
    originalCheckoutProvider = process.env.PRO_CHECKOUT_PROVIDER;
    originalCheckoutUrl = process.env.PRO_CHECKOUT_URL;
    process.env.PRO_CHECKOUT_PROVIDER = 'stripe';
    process.env.PRO_CHECKOUT_URL = 'https://checkout.example/pro';

    await new Promise(resolve => pool.run('DELETE FROM users WHERE email = ?', ['freemium@example.com'], resolve));

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'freemiumuser',
        email: 'freemium@example.com',
        password: 'password123',
      });

    userId = registerRes.body.userId;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'freemium@example.com',
        password: 'password123',
      });

    token = loginRes.body.token;
  });

  afterAll(() => {
    if (originalCheckoutProvider === undefined) {
      delete process.env.PRO_CHECKOUT_PROVIDER;
    } else {
      process.env.PRO_CHECKOUT_PROVIDER = originalCheckoutProvider;
    }

    if (originalCheckoutUrl === undefined) {
      delete process.env.PRO_CHECKOUT_URL;
    } else {
      process.env.PRO_CHECKOUT_URL = originalCheckoutUrl;
    }
  });

  it('returns the default free plan with Pro upgrade metadata', async () => {
    const res = await request(app)
      .get('/api/billing/plan')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.plan).toMatchObject({
      tier: 'free',
      priceDisplay: '$0/mo',
    });
    expect(res.body.upgrade).toMatchObject({
      tier: 'pro',
      priceDisplay: '$4.99/mo',
    });
    expect(res.body.limits.devices).toEqual(1);
    expect(res.body.features).toMatchObject({
      ml: false,
      sync: false,
    });
  });

  it('creates a configured provider checkout URL with user context', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.provider).toEqual('stripe');
    expect(res.body.plan).toMatchObject({
      tier: 'pro',
      priceDisplay: '$4.99/mo',
    });
    expect(res.body.url).toContain('https://checkout.example/pro');
    expect(res.body.url).toContain(`client_reference_id=${userId}`);
    expect(res.body.url).toContain('prefilled_email=freemium%40example.com');
  });

  it('gates ML and bulk sync routes for free users', async () => {
    const semanticRes = await request(app)
      .post('/api/search/semantic')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'machine learning' });

    expect(semanticRes.statusCode).toEqual(402);
    expect(semanticRes.body).toMatchObject({
      error: 'upgrade_required',
      feature: 'ml',
    });

    const suggestionsRes = await request(app)
      .get('/api/suggestions')
      .set('Authorization', `Bearer ${token}`);

    expect(suggestionsRes.statusCode).toEqual(402);
    expect(suggestionsRes.body.feature).toEqual('ml');

    const syncRes = await request(app)
      .post('/api/tabs/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ tabs: [{ url: 'https://example.com', title: 'Example' }] });

    expect(syncRes.statusCode).toEqual(402);
    expect(syncRes.body.feature).toEqual('sync');
  });

  it('enforces the free one-device limit', async () => {
    const firstDeviceRes = await request(app)
      .get('/api/billing/plan')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', 'device-one');

    expect(firstDeviceRes.statusCode).toEqual(200);

    const secondDeviceRes = await request(app)
      .get('/api/billing/plan')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', 'device-two');

    expect(secondDeviceRes.statusCode).toEqual(402);
    expect(secondDeviceRes.body).toMatchObject({
      error: 'upgrade_required',
      feature: 'devices',
    });
  });

  it('unlocks Pro features for an active subscription', async () => {
    await db.run(
      'UPDATE users SET plan_tier = $1, subscription_status = $2 WHERE id = $3',
      ['pro', 'active', userId]
    );

    const planRes = await request(app)
      .get('/api/billing/plan')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Device-Id', 'device-two');

    expect(planRes.statusCode).toEqual(200);
    expect(planRes.body.plan.tier).toEqual('pro');
    expect(planRes.body.features).toMatchObject({
      ml: true,
      sync: true,
    });

    const semanticRes = await request(app)
      .post('/api/search/semantic')
      .set('Authorization', `Bearer ${token}`)
      .send({ query: 'machine learning' });

    expect(semanticRes.statusCode).toEqual(200);
    expect(semanticRes.body).toEqual([]);

    bulkImportQueue.add.mockClear();

    const syncRes = await request(app)
      .post('/api/tabs/bulk')
      .set('Authorization', `Bearer ${token}`)
      .send({ tabs: [{ url: 'https://example.com/pro', title: 'Pro' }] });

    expect(syncRes.statusCode).toEqual(202);
    expect(bulkImportQueue.add).toHaveBeenCalledWith({
      items: [{ url: 'https://example.com/pro', title: 'Pro' }],
      userId,
      type: 'tab',
    });
  });
});
