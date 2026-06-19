const request = require('supertest');
const { app } = require('../index');
const db = require('../config/db');
const { suggestionQueue } = require('../config/queue');
const { createAuthedUser, deleteUsersByEmail } = require('./helpers');

describe('Suggestion routes', () => {
  let owner;
  let otherUser;

  const emails = [
    'suggestions-owner@example.com',
    'suggestions-other@example.com',
  ];

  beforeAll(async () => {
    await deleteUsersByEmail(emails);

    owner = await createAuthedUser({
      username: 'suggestionsowner',
      email: 'suggestions-owner@example.com',
      pro: true,
    });

    otherUser = await createAuthedUser({
      username: 'suggestionsother',
      email: 'suggestions-other@example.com',
      pro: true,
    });
  });

  async function createSuggestion({ type, status = 'pending', userId, confidence = 0.8 }) {
    const result = await db.run(
      `INSERT INTO suggestions (type, item_ids, reason, confidence, status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        type,
        '[1,2]',
        `${type} reason`,
        confidence,
        status,
        userId,
      ]
    );

    return result.lastID;
  }

  it('lists pending suggestions, duplicates, and stale tabs for the authenticated Pro user', async () => {
    const duplicateId = await createSuggestion({
      type: 'duplicate',
      userId: owner.userId,
      confidence: 0.95,
    });
    const staleId = await createSuggestion({
      type: 'stale',
      userId: owner.userId,
      confidence: 0.75,
    });
    await createSuggestion({
      type: 'duplicate',
      userId: otherUser.userId,
      confidence: 0.99,
    });
    await createSuggestion({
      type: 'related',
      status: 'rejected',
      userId: owner.userId,
    });

    const allRes = await request(app)
      .get('/api/suggestions')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(allRes.statusCode).toEqual(200);
    expect(allRes.body.map(suggestion => suggestion.id)).toEqual(
      expect.arrayContaining([duplicateId, staleId])
    );
    expect(allRes.body).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ confidence: 0.99 }),
        expect.objectContaining({ status: 'rejected' }),
      ])
    );

    const duplicatesRes = await request(app)
      .get('/api/suggestions/duplicates')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(duplicatesRes.statusCode).toEqual(200);
    expect(duplicatesRes.body).toEqual([
      expect.objectContaining({
        id: duplicateId,
        type: 'duplicate',
      }),
    ]);

    const staleRes = await request(app)
      .get('/api/suggestions/stale')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(staleRes.statusCode).toEqual(200);
    expect(staleRes.body).toEqual([
      expect.objectContaining({
        id: staleId,
        type: 'stale',
      }),
    ]);
  });

  it('queues suggestion generation for the authenticated user', async () => {
    suggestionQueue.add.mockResolvedValueOnce({ id: 'suggestion-job-1' });

    const res = await request(app)
      .post('/api/suggestions/generate')
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual({
      message: 'Suggestion generation queued',
      jobId: 'suggestion-job-1',
    });
    expect(suggestionQueue.add).toHaveBeenCalledWith({
      userId: owner.userId,
    });
  });

  it('accepts and rejects only the owner suggestions', async () => {
    const acceptId = await createSuggestion({
      type: 'duplicate',
      userId: owner.userId,
    });
    const rejectId = await createSuggestion({
      type: 'stale',
      userId: owner.userId,
    });

    const acceptRes = await request(app)
      .put(`/api/suggestions/${acceptId}/accept`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(acceptRes.statusCode).toEqual(200);
    expect(acceptRes.body).toMatchObject({
      id: acceptId,
      status: 'accepted',
    });

    const rejectRes = await request(app)
      .put(`/api/suggestions/${rejectId}/reject`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(rejectRes.statusCode).toEqual(200);
    expect(rejectRes.body).toMatchObject({
      id: rejectId,
      status: 'rejected',
    });

    const foreignRejectRes = await request(app)
      .put(`/api/suggestions/${acceptId}/reject`)
      .set('Authorization', `Bearer ${otherUser.token}`);

    expect(foreignRejectRes.statusCode).toEqual(404);
  });
});
