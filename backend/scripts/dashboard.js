require('dotenv').config({ path: __dirname + '/../.env' });
const { pool } = require('../src/config/database');

async function getMetrics() {
  try {
    const isTest = process.env.NODE_ENV === 'test';
    
    // We can run simple count queries for PostgreSQL
    // Because SQLite has a different API for count, and this is for production/dev use,
    // we'll use the pool.query which is standard pg pool in non-test mode.
    
    if (isTest) {
      console.log('Dashboard is intended for development and production environments.');
      process.exit(0);
    }
    
    console.log('--- Tab & Bookmark Manager Dashboard ---');
    console.log('Connecting to database...\n');
    
    const client = await pool.connect();
    
    try {
      const tabsCount = await client.query('SELECT COUNT(*) FROM tabs');
      const bookmarksCount = await client.query('SELECT COUNT(*) FROM bookmarks');
      const archivedCount = await client.query('SELECT COUNT(*) FROM archived_pages');
      const usersCount = await client.query('SELECT COUNT(*) FROM users');
      
      const suggestionsPending = await client.query("SELECT COUNT(*) FROM suggestions WHERE status = 'pending'");
      const suggestionsAccepted = await client.query("SELECT COUNT(*) FROM suggestions WHERE status = 'accepted'");
      const suggestionsRejected = await client.query("SELECT COUNT(*) FROM suggestions WHERE status = 'rejected'");
      
      console.log(`Users:             ${usersCount.rows[0].count}`);
      console.log(`Tabs:              ${tabsCount.rows[0].count}`);
      console.log(`Bookmarks:         ${bookmarksCount.rows[0].count}`);
      console.log(`Archived Pages:    ${archivedCount.rows[0].count}`);
      console.log(`Suggestions:`);
      console.log(`  - Pending:       ${suggestionsPending.rows[0].count}`);
      console.log(`  - Accepted:      ${suggestionsAccepted.rows[0].count}`);
      console.log(`  - Rejected:      ${suggestionsRejected.rows[0].count}`);
      console.log('\n----------------------------------------');
      
    } finally {
      client.release();
    }
    
  } catch (err) {
    console.error('Error fetching metrics:', err.message);
  } finally {
    if (pool && pool.end) {
      await pool.end();
    }
    process.exit(0);
  }
}

getMetrics();
