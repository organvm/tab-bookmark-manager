const { Pool } = require('pg');
const logger = require('../utils/logger');
const sqlite3 = require('sqlite3');

let pool;

if (process.env.NODE_ENV === 'test') {
  pool = new sqlite3.Database(':memory:');
} else {
  pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'tab_bookmark_manager',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
}

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Initialize database schema
async function initializeDatabase() {
  if (process.env.NODE_ENV === 'test') {
    return initializeTestDatabase();
  }
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tabs (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT,
        favicon TEXT,
        content TEXT,
        summary TEXT,
        category TEXT,
        tags TEXT[],
        entities JSONB,
        embedding vector(384),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP,
        access_count INTEGER DEFAULT 0,
        is_archived BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS bookmarks (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        title TEXT,
        favicon TEXT,
        folder TEXT,
        content TEXT,
        summary TEXT,
        category TEXT,
        tags TEXT[],
        entities JSONB,
        embedding vector(384),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_archived BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS archived_pages (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        html_content TEXT,
        screenshot_path TEXT,
        pdf_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS suggestions (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        item_ids INTEGER[],
        reason TEXT,
        confidence FLOAT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tabs_url ON tabs(url);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
      CREATE INDEX IF NOT EXISTS idx_tabs_category ON tabs(category);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category);
      CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);

      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        plan_tier VARCHAR(20) DEFAULT 'free',
        subscription_status VARCHAR(50) DEFAULT 'inactive',
        subscription_provider VARCHAR(50),
        subscription_customer_id VARCHAR(255),
        subscription_id VARCHAR(255),
        subscription_current_period_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_id VARCHAR(255) NOT NULL,
        label VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, device_id)
      );

      CREATE TABLE IF NOT EXISTS revoked_tokens (
        id SERIAL PRIMARY KEY,
        token VARCHAR(500) NOT NULL,
        revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );

      ALTER TABLE tabs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
      ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
      ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
      ALTER TABLE archived_pages ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_tier VARCHAR(20) DEFAULT 'free';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'inactive';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_provider VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_customer_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMP;
    `);
    logger.info('Database schema initialized successfully');
  } catch (err) {
    logger.error('Error initializing database schema:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function initializeTestDatabase() {
  return new Promise((resolve, reject) => {
    pool.serialize(() => {
      pool.run(`
        CREATE TABLE tabs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          title TEXT,
          favicon TEXT,
          content TEXT,
          summary TEXT,
          category TEXT,
          tags TEXT,
          entities TEXT,
          embedding BLOB,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_accessed DATETIME,
          access_count INTEGER DEFAULT 0,
          is_archived BOOLEAN DEFAULT FALSE,
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);

      pool.run(`
        CREATE TABLE bookmarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          title TEXT,
          favicon TEXT,
          folder TEXT,
          content TEXT,
          summary TEXT,
          category TEXT,
          tags TEXT,
          entities TEXT,
          embedding BLOB,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_archived BOOLEAN DEFAULT FALSE,
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);

      pool.run(`
        CREATE TABLE archived_pages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          html_content TEXT,
          screenshot_path TEXT,
          pdf_path TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);

      pool.run(`
        CREATE TABLE suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          item_ids TEXT,
          reason TEXT,
          confidence REAL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          user_id INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);

      pool.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          plan_tier TEXT DEFAULT 'free',
          subscription_status TEXT DEFAULT 'inactive',
          subscription_provider TEXT,
          subscription_customer_id TEXT,
          subscription_id TEXT,
          subscription_current_period_end DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      pool.run(`
        CREATE TABLE user_devices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          device_id TEXT NOT NULL,
          label TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, device_id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `);

      pool.run(`
        CREATE TABLE revoked_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token TEXT NOT NULL,
          revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL
        );
      `, (err) => {
        if (err) {
          logger.error('Error initializing test database schema:', err);
          return reject(err);
        }
        logger.info('Test database schema initialized successfully');
        resolve();
      });
    });
  });
}

module.exports = { pool, initializeDatabase };
