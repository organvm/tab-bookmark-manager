const request = require('supertest');
const { app } = require('../index');
const { archivalQueue, contentAnalysisQueue } = require('../config/queue');
const { createAuthedUser, deleteUsersByEmail } = require('./helpers');

describe('Tab, bookmark, and search routes', () => {
  let freeUser;
  let proUser;
  let otherUser;

  const emails = [
    'resources-free@example.com',
    'resources-pro@example.com',
    'resources-other@example.com',
  ];

  beforeAll(async () => {
    await deleteUsersByEmail(emails);

    freeUser = await createAuthedUser({
      username: 'resourcesfree',
      email: 'resources-free@example.com',
    });

    proUser = await createAuthedUser({
      username: 'resourcespro',
      email: 'resources-pro@example.com',
      pro: true,
    });

    otherUser = await createAuthedUser({
      username: 'resourcesother',
      email: 'resources-other@example.com',
    });
  });

  describe('tabs', () => {
    it('creates, reads, updates, lists, and deletes tabs for the owner only', async () => {
      const createRes = await request(app)
        .post('/api/tabs')
        .set('Authorization', `Bearer ${freeUser.token}`)
        .send({
          url: 'https://example.com/owned-tab',
          title: 'Owned Tab',
          content: 'owned tab content',
        });

      expect(createRes.statusCode).toEqual(201);
      expect(createRes.body).toMatchObject({
        url: 'https://example.com/owned-tab',
        title: 'Owned Tab',
        user_id: freeUser.userId,
      });
      expect(contentAnalysisQueue.add).not.toHaveBeenCalled();

      const tabId = createRes.body.id;

      const foreignReadRes = await request(app)
        .get(`/api/tabs/${tabId}`)
        .set('Authorization', `Bearer ${otherUser.token}`);

      expect(foreignReadRes.statusCode).toEqual(404);

      const readRes = await request(app)
        .get(`/api/tabs/${tabId}`)
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(readRes.statusCode).toEqual(200);
      expect(readRes.body.access_count).toEqual(1);
      expect(readRes.body.last_accessed).toBeTruthy();

      const updateRes = await request(app)
        .put(`/api/tabs/${tabId}`)
        .set('Authorization', `Bearer ${freeUser.token}`)
        .send({ title: 'Updated Tab', category: 'research' });

      expect(updateRes.statusCode).toEqual(200);
      expect(updateRes.body).toMatchObject({
        id: tabId,
        title: 'Updated Tab',
        category: 'research',
      });

      const listRes = await request(app)
        .get('/api/tabs')
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(listRes.statusCode).toEqual(200);
      expect(listRes.body.map(tab => tab.id)).toContain(tabId);

      const foreignDeleteRes = await request(app)
        .delete(`/api/tabs/${tabId}`)
        .set('Authorization', `Bearer ${otherUser.token}`);

      expect(foreignDeleteRes.statusCode).toEqual(404);

      const deleteRes = await request(app)
        .delete(`/api/tabs/${tabId}`)
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(deleteRes.statusCode).toEqual(200);
      expect(deleteRes.body.message).toEqual('Tab deleted successfully');

      const missingRes = await request(app)
        .get(`/api/tabs/${tabId}`)
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(missingRes.statusCode).toEqual(404);
    });

    it('queues content analysis for Pro tabs with content', async () => {
      const content = 'pro tab content for ML analysis';
      const createRes = await request(app)
        .post('/api/tabs')
        .set('Authorization', `Bearer ${proUser.token}`)
        .send({
          url: 'https://example.com/pro-tab',
          title: 'Pro Tab',
          content,
        });

      expect(createRes.statusCode).toEqual(201);
      expect(contentAnalysisQueue.add).toHaveBeenCalledWith({
        itemId: createRes.body.id,
        itemType: 'tab',
        url: 'https://example.com/pro-tab',
        content,
      });
    });

    it('archives tabs by queueing the page and hiding it from the default list', async () => {
      const createRes = await request(app)
        .post('/api/tabs')
        .set('Authorization', `Bearer ${freeUser.token}`)
        .send({
          url: 'https://example.com/archive-tab',
          title: 'Archive Tab',
        });

      const tabId = createRes.body.id;
      const archiveRes = await request(app)
        .post(`/api/tabs/${tabId}/archive`)
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(archiveRes.statusCode).toEqual(200);
      expect(archivalQueue.add).toHaveBeenCalledWith({
        url: 'https://example.com/archive-tab',
        itemId: String(tabId),
        itemType: 'tab',
      });

      const listRes = await request(app)
        .get('/api/tabs')
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(listRes.body.map(tab => tab.id)).not.toContain(tabId);
    });
  });

  describe('bookmarks', () => {
    it('creates, filters, reads, updates, and deletes bookmarks for the owner only', async () => {
      const createRes = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${freeUser.token}`)
        .send({
          url: 'https://example.com/owned-bookmark',
          title: 'Owned Bookmark',
          folder: 'reading',
          content: 'owned bookmark content',
        });

      expect(createRes.statusCode).toEqual(201);
      expect(createRes.body).toMatchObject({
        url: 'https://example.com/owned-bookmark',
        title: 'Owned Bookmark',
        folder: 'reading',
        user_id: freeUser.userId,
      });
      expect(contentAnalysisQueue.add).not.toHaveBeenCalled();

      const bookmarkId = createRes.body.id;

      const foreignReadRes = await request(app)
        .get(`/api/bookmarks/${bookmarkId}`)
        .set('Authorization', `Bearer ${otherUser.token}`);

      expect(foreignReadRes.statusCode).toEqual(404);

      const filteredRes = await request(app)
        .get('/api/bookmarks')
        .query({ folder: 'reading' })
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(filteredRes.statusCode).toEqual(200);
      expect(filteredRes.body.map(bookmark => bookmark.id)).toContain(bookmarkId);

      const updateRes = await request(app)
        .put(`/api/bookmarks/${bookmarkId}`)
        .set('Authorization', `Bearer ${freeUser.token}`)
        .send({ title: 'Updated Bookmark', folder: 'reference' });

      expect(updateRes.statusCode).toEqual(200);
      expect(updateRes.body).toMatchObject({
        id: bookmarkId,
        title: 'Updated Bookmark',
        folder: 'reference',
      });

      const foreignDeleteRes = await request(app)
        .delete(`/api/bookmarks/${bookmarkId}`)
        .set('Authorization', `Bearer ${otherUser.token}`);

      expect(foreignDeleteRes.statusCode).toEqual(404);

      const deleteRes = await request(app)
        .delete(`/api/bookmarks/${bookmarkId}`)
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(deleteRes.statusCode).toEqual(200);
      expect(deleteRes.body.message).toEqual('Bookmark deleted successfully');
    });

    it('queues content analysis for Pro bookmarks with content', async () => {
      const content = 'pro bookmark content for ML analysis';
      const createRes = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${proUser.token}`)
        .send({
          url: 'https://example.com/pro-bookmark',
          title: 'Pro Bookmark',
          folder: 'ml',
          content,
        });

      expect(createRes.statusCode).toEqual(201);
      expect(contentAnalysisQueue.add).toHaveBeenCalledWith({
        itemId: createRes.body.id,
        itemType: 'bookmark',
        url: 'https://example.com/pro-bookmark',
        content,
      });
    });

    it('archives bookmarks by queueing the page and hiding it from the default list', async () => {
      const createRes = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${freeUser.token}`)
        .send({
          url: 'https://example.com/archive-bookmark',
          title: 'Archive Bookmark',
        });

      const bookmarkId = createRes.body.id;
      const archiveRes = await request(app)
        .post(`/api/bookmarks/${bookmarkId}/archive`)
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(archiveRes.statusCode).toEqual(200);
      expect(archivalQueue.add).toHaveBeenCalledWith({
        url: 'https://example.com/archive-bookmark',
        itemId: String(bookmarkId),
        itemType: 'bookmark',
      });

      const listRes = await request(app)
        .get('/api/bookmarks')
        .set('Authorization', `Bearer ${freeUser.token}`);

      expect(listRes.body.map(bookmark => bookmark.id)).not.toContain(bookmarkId);
    });
  });

  it('returns text search matches for the authenticated user only', async () => {
    await request(app)
      .post('/api/tabs')
      .set('Authorization', `Bearer ${freeUser.token}`)
      .send({
        url: 'https://example.com/search-tab',
        title: 'Needle Tab Result',
        content: 'findable text',
      });

    await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${freeUser.token}`)
      .send({
        url: 'https://example.com/search-bookmark',
        title: 'Needle Bookmark Result',
        folder: 'search',
      });

    await request(app)
      .post('/api/tabs')
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        url: 'https://example.com/other-search-tab',
        title: 'Needle Other Result',
      });

    const res = await request(app)
      .get('/api/search/text')
      .query({ query: 'Needle', type: 'both' })
      .set('Authorization', `Bearer ${freeUser.token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Needle Tab Result',
          type: 'tab',
        }),
        expect.objectContaining({
          title: 'Needle Bookmark Result',
          type: 'bookmark',
        }),
      ])
    );
    expect(res.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Needle Other Result' }),
      ])
    );
  });
});
