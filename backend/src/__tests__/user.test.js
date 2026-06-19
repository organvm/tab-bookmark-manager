const request = require('supertest');
const { app } = require('../index');
const { pool } = require('../config/database');

describe('User Profile Management', () => {
  let token;
  let userId;

  beforeAll(async () => {
    // Create a test user
    await new Promise(resolve => pool.run('DELETE FROM users WHERE email = ?', ['profiletest@example.com'], resolve));
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'profiletestuser',
        email: 'profiletest@example.com',
        password: 'testpassword123',
      });
    
    // Login to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'profiletest@example.com',
        password: 'testpassword123',
      });
    
    token = loginRes.body.token;
  });

  describe('GET /api/user/profile', () => {
    it('should get user profile', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('username', 'profiletestuser');
      expect(res.body).toHaveProperty('email', 'profiletest@example.com');
      expect(res.body).toHaveProperty('created_at');
      expect(res.body).not.toHaveProperty('password_hash');
      userId = res.body.id;
    });

    it('should not get profile without token', async () => {
      const res = await request(app).get('/api/user/profile');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update username', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'newusername' });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Profile updated successfully');
      expect(res.body).toHaveProperty('username', 'newusername');
    });

    it('should reject duplicate username', async () => {
      // Create another user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'duplicateuser',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'duplicateuser' });
      
      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Username already in use');

      // Cleanup
      await new Promise(resolve => pool.run('DELETE FROM users WHERE email = ?', ['duplicate@example.com'], resolve));
    });

    it('should reject invalid username', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'ab' }); // Too short
      
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('PUT /api/user/email', () => {
    it('should update email', async () => {
      const res = await request(app)
        .put('/api/user/email')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'newemail@example.com' });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Email updated successfully');
      expect(res.body).toHaveProperty('email', 'newemail@example.com');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .put('/api/user/email')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'invalidemail' });
      
      expect(res.statusCode).toEqual(400);
    });

    it('should reject duplicate email', async () => {
      // Create another user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'emailduplicate',
          email: 'existing@example.com',
          password: 'password123',
        });

      const res = await request(app)
        .put('/api/user/email')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'existing@example.com' });
      
      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Email already in use');

      // Cleanup
      await new Promise(resolve => pool.run('DELETE FROM users WHERE email = ?', ['existing@example.com'], resolve));
    });
  });

  describe('PUT /api/user/password', () => {
    it('should update password', async () => {
      const res = await request(app)
        .put('/api/user/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'testpassword123',
          newPassword: 'newpassword123'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Password updated successfully');

      // Verify can login with new password
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newemail@example.com',
          password: 'newpassword123',
        });
      
      expect(loginRes.statusCode).toEqual(200);
      expect(loginRes.body).toHaveProperty('token');
      token = loginRes.body.token; // Update token for remaining tests
    });

    it('should reject incorrect current password', async () => {
      const res = await request(app)
        .put('/api/user/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword456'
        });
      
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Current password is incorrect');
    });

    it('should reject weak new password', async () => {
      const res = await request(app)
        .put('/api/user/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'newpassword123',
          newPassword: 'weak'
        });
      
      expect(res.statusCode).toEqual(400);
    });
  });

  describe('DELETE /api/user/account', () => {
    it('should delete user account', async () => {
      const res = await request(app)
        .delete('/api/user/account')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message', 'Account deleted successfully');

      // Verify cannot login after deletion
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'newemail@example.com',
          password: 'newpassword123',
        });
      
      expect(loginRes.statusCode).toEqual(401);
    });
  });
});
