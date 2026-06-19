const request = require('supertest');
const { app } = require('../index');
const db = require('../config/db');
const { archivalQueue } = require('../config/queue');
const { createAuthedUser, deleteUsersByEmail } = require('./helpers');

describe('Archive routes', () => {
  let owner;
  let otherUser;

  const emails = [
    'archive-owner@example.com',
    'archive-other@example.com',
  ];

  beforeAll(async () => {
    await deleteUsersByEmail(emails);

    owner = await createAuthedUser({
      username: 'archiveowner',
      email: 'archive-owner@example.com',
    });

    otherUser = await createAuthedUser({
      username: 'archiveother',
      email: 'archive-other@example.com',
    });
  });

  it('queues a page archive for the authenticated user', async () => {
    archivalQueue.add.mockResolvedValueOnce({ id: 'archive-job-1' });

    const res = await request(app)
      .post('/api/archive')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ url: 'https://example.com/archive-me' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({
      message: 'Page queued for archival',
      jobId: 'archive-job-1',
    });
    expect(archivalQueue.add).toHaveBeenCalledWith({
      url: 'https://example.com/archive-me',
      userId: owner.userId,
    });
  });

  it('returns archived pages only to their owner', async () => {
    const ownerArchive = await db.run(
      `INSERT INTO archived_pages (url, html_content, screenshot_path, pdf_path, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'https://example.com/owned-archive',
        '<html>owner</html>',
        '/tmp/owner.png',
        '/tmp/owner.pdf',
        owner.userId,
      ]
    );

    await db.run(
      `INSERT INTO archived_pages (url, html_content, screenshot_path, pdf_path, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'https://example.com/other-archive',
        '<html>other</html>',
        '/tmp/other.png',
        '/tmp/other.pdf',
        otherUser.userId,
      ]
    );

    const listRes = await request(app)
      .get('/api/archive')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(listRes.statusCode).toEqual(200);
    expect(listRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ownerArchive.lastID,
          url: 'https://example.com/owned-archive',
        }),
      ])
    );
    expect(listRes.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ url: 'https://example.com/other-archive' }),
      ])
    );

    const readRes = await request(app)
      .get(`/api/archive/${ownerArchive.lastID}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(readRes.statusCode).toEqual(200);
    expect(readRes.body).toMatchObject({
      id: ownerArchive.lastID,
      html_content: '<html>owner</html>',
    });

    const foreignReadRes = await request(app)
      .get(`/api/archive/${ownerArchive.lastID}`)
      .set('Authorization', `Bearer ${otherUser.token}`);

    expect(foreignReadRes.statusCode).toEqual(404);
  });
});
