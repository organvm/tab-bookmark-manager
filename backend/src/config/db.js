const { pool } = require('./database');

function prepareSqliteStatement(text, params = []) {
  const values = [];
  const sql = text.replace(/\$(\d+)/g, (_, index) => {
    values.push(params[Number(index) - 1]);
    return '?';
  });

  return { sql, params: values };
}

const db = {
  query: (text, params) => {
    if (process.env.NODE_ENV === 'test') {
      const statement = prepareSqliteStatement(text, params);
      return new Promise((resolve, reject) => {
        pool.all(statement.sql, statement.params, (err, rows) => {
          if (err) {
            return reject(err);
          }
          resolve({ rows });
        });
      });
    }
    return pool.query(text, params);
  },
  run: (text, params) => {
    if (process.env.NODE_ENV === 'test') {
      const statement = prepareSqliteStatement(text, params);
      return new Promise((resolve, reject) => {
        pool.run(statement.sql, statement.params, function (err) {
          if (err) {
            return reject(err);
          }
          resolve({ rowCount: this.changes, lastID: this.lastID });
        });
      });
    }
    return pool.query(text, params);
  },
  get: (text, params) => {
    if (process.env.NODE_ENV === 'test') {
      const statement = prepareSqliteStatement(text, params);
      return new Promise((resolve, reject) => {
        pool.get(statement.sql, statement.params, (err, row) => {
          if (err) {
            return reject(err);
          }
          resolve(row);
        });
      });
    }
    return pool.query(text, params).then(res => res.rows[0]);
  }
};

module.exports = db;
