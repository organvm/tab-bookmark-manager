const db = require('../config/db');
const {
  getUsage,
  getUserEntitlements,
  registerDevice,
  setSubscriptionForUser,
} = require('../services/entitlementService');
const { FREE_BOOKMARK_LIMIT, FREE_DEVICE_LIMIT } = require('../config/plans');
const { createAuthedUser, deleteUsersByEmail } = require('./helpers');

describe('entitlementService', () => {
  let freeUser;
  let proUser;

  const emails = [
    'entitlements-free@example.com',
    'entitlements-pro@example.com',
  ];

  beforeAll(async () => {
    await deleteUsersByEmail(emails);

    freeUser = await createAuthedUser({
      username: 'entitlementsfree',
      email: 'entitlements-free@example.com',
    });

    proUser = await createAuthedUser({
      username: 'entitlementspro',
      email: 'entitlements-pro@example.com',
      pro: true,
    });
  });

  it('returns null entitlements for a missing user', async () => {
    await expect(getUserEntitlements(999999)).resolves.toBeNull();
  });

  it('counts active bookmarks, tabs, and registered devices', async () => {
    await db.run(
      'INSERT INTO bookmarks (url, title, is_archived, user_id) VALUES ($1, $2, $3, $4)',
      ['https://example.com/bookmark-active', 'Active Bookmark', false, freeUser.userId]
    );
    await db.run(
      'INSERT INTO bookmarks (url, title, is_archived, user_id) VALUES ($1, $2, $3, $4)',
      ['https://example.com/bookmark-archived', 'Archived Bookmark', true, freeUser.userId]
    );
    await db.run(
      'INSERT INTO tabs (url, title, is_archived, user_id) VALUES ($1, $2, $3, $4)',
      ['https://example.com/tab-active', 'Active Tab', false, freeUser.userId]
    );
    await registerDevice(freeUser.userId, 'entitlements-device-one', 'Laptop');

    const usage = await getUsage(freeUser.userId);

    expect(usage).toMatchObject({
      bookmarks: 1,
      tabs: 1,
      devices: 1,
    });
  });

  it('returns free-plan limits and disabled Pro features by default', async () => {
    const entitlements = await getUserEntitlements(freeUser.userId);

    expect(entitlements.plan).toMatchObject({
      tier: 'free',
      priceDisplay: '$0/mo',
    });
    expect(entitlements.limits).toMatchObject({
      bookmarks: FREE_BOOKMARK_LIMIT,
      devices: FREE_DEVICE_LIMIT,
    });
    expect(entitlements.features).toMatchObject({
      ml: false,
      sync: false,
    });
  });

  it('enforces the free one-device limit and allows Pro unlimited devices', async () => {
    const missingDevice = await registerDevice(freeUser.userId, null);
    expect(missingDevice).toEqual({
      registered: false,
      reason: 'missing_device_id',
    });

    const usageBeforeLimitCheck = await getUsage(freeUser.userId);
    for (let index = usageBeforeLimitCheck.devices; index < FREE_DEVICE_LIMIT; index += 1) {
      await registerDevice(freeUser.userId, `entitlements-device-fill-${index}`, 'Extra');
    }

    const freeSecondDevice = await registerDevice(
      freeUser.userId,
      'entitlements-device-over-limit',
      'Phone'
    );

    expect(freeSecondDevice).toMatchObject({
      registered: false,
      reason: 'device_limit',
    });
    expect(freeSecondDevice.entitlement.plan.tier).toEqual('free');

    await expect(registerDevice(proUser.userId, 'pro-device-one')).resolves.toEqual({
      registered: true,
    });
    await expect(registerDevice(proUser.userId, 'pro-device-two')).resolves.toEqual({
      registered: true,
    });
  });

  it('updates subscription state and derives the matching plan', async () => {
    await setSubscriptionForUser(freeUser.userId, {
      provider: 'stripe',
      status: 'active',
      customerId: 'cus_test',
      subscriptionId: 'sub_test',
      currentPeriodEnd: new Date('2026-07-01T00:00:00.000Z'),
    });

    const activeEntitlements = await getUserEntitlements(freeUser.userId);
    expect(activeEntitlements.plan.tier).toEqual('pro');
    expect(activeEntitlements.subscription).toMatchObject({
      status: 'active',
      provider: 'stripe',
    });
    expect(activeEntitlements.features).toMatchObject({
      ml: true,
      sync: true,
    });

    await setSubscriptionForUser(freeUser.userId, {
      status: 'canceled',
    });

    const canceledEntitlements = await getUserEntitlements(freeUser.userId);
    expect(canceledEntitlements.plan.tier).toEqual('free');
    expect(canceledEntitlements.subscription.status).toEqual('canceled');
  });
});
