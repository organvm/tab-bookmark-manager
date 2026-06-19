const request = require('supertest');
const { app } = require('../index');
const db = require('../config/db');

async function createAuthedUser({
  username,
  email,
  password = 'password123',
  pro = false,
}) {
  const registerRes = await request(app)
    .post('/api/auth/register')
    .send({ username, email, password });

  if (![201, 409].includes(registerRes.statusCode)) {
    throw new Error(`Failed to register test user ${email}: ${registerRes.statusCode}`);
  }

  const userId = registerRes.body.userId || await getUserIdByEmail(email);

  if (pro) {
    await db.run(
      'UPDATE users SET plan_tier = $1, subscription_status = $2 WHERE id = $3',
      ['pro', 'active', userId]
    );
  }

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (loginRes.statusCode !== 200) {
    throw new Error(`Failed to log in test user ${email}: ${loginRes.statusCode}`);
  }

  return {
    token: loginRes.body.token,
    userId,
    email,
    username,
  };
}

async function getUserIdByEmail(email) {
  const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  return result.rows[0]?.id;
}

async function deleteUsersByEmail(emails) {
  for (const email of emails) {
    await db.run('DELETE FROM users WHERE email = $1', [email]);
  }
}

module.exports = {
  createAuthedUser,
  deleteUsersByEmail,
};
