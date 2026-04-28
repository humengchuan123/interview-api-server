class SqliteAdapter {
  constructor(db) {
    this.db = db;
    this.type = 'sqlite';
  }

  async all(query, params = []) {
    return this.db.prepare(query).all(...params);
  }

  async get(query, params = []) {
    return this.db.prepare(query).get(...params) || null;
  }

  async run(query, params = []) {
    return this.db.prepare(query).run(...params);
  }
}

class PostgresAdapter {
  constructor(pool) {
    this.pool = pool;
    this.type = 'postgres';
  }

  async all(query, params = []) {
    let i = 0;
    const pgQuery = query.replace(/\?/g, () => `$${++i}`);
    const { rows } = await this.pool.query(pgQuery, params);
    return rows;
  }

  async get(query, params = []) {
    let i = 0;
    const pgQuery = query.replace(/\?/g, () => `$${++i}`);
    const { rows } = await this.pool.query(pgQuery, params);
    return rows[0] || null;
  }

  async run(query, params = []) {
    let i = 0;
    const pgQuery = query.replace(/\?/g, () => `$${++i}`);
    return this.pool.query(pgQuery, params);
  }
}

module.exports = { SqliteAdapter, PostgresAdapter };
