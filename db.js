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

class SupabaseAdapter {
  constructor(client) {
    this.client = client;
    this.type = 'supabase';
  }

  _parseTable(sql) {
    const m = sql.match(/\bfrom\s+(\w+)/i);
    return m ? m[1] : null;
  }

  _parseInsertTable(sql) {
    const m = sql.match(/\binto\s+(\w+)/i);
    return m ? m[1] : null;
  }

  _parseWhere(sql, params) {
    const whereIdx = sql.toLowerCase().indexOf(' where ');
    if (whereIdx === -1) return { table: this._parseTable(sql), conditions: [] };
    const table = this._parseTable(sql.substring(0, whereIdx));
    const whereClause = sql.substring(whereIdx + 7);
    const parts = whereClause.split(/\s+and\s+/i);
    const conditions = [];
    for (let i = 0; i < parts.length; i++) {
      const pm = parts[i].match(/(\w+)\s*=\s*\?/i);
      if (pm && params[i] !== undefined) {
        conditions.push({ column: pm[1], value: params[i] });
      }
    }
    return { table, conditions };
  }

  async all(query, params = []) {
    const upper = query.trim().toUpperCase();
    if (upper.startsWith('SELECT')) {
      const { table, conditions } = this._parseWhere(query, params);
      let q = this.client.from(table).select('*');
      for (const c of conditions) {
        q = q.eq(c.column, c.value);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }
    throw new Error(`Unsupported query: ${query}`);
  }

  async get(query, params = []) {
    const rows = await this.all(query, params);
    return rows[0] || null;
  }

  async run(query, params = []) {
    const upper = query.trim().toUpperCase();
    if (upper.startsWith('INSERT')) {
      const table = this._parseInsertTable(query);
      const colsMatch = query.match(/\(([^)]+)\)\s*values/i);
      if (!colsMatch) throw new Error('Cannot parse INSERT columns');
      const cols = colsMatch[1].split(',').map(c => c.trim());
      const row = {};
      for (let i = 0; i < cols.length; i++) {
        row[cols[i]] = params[i];
      }
      const { data, error } = await this.client.from(table).insert(row).select();
      if (error) throw error;
      return data;
    }
    if (upper.startsWith('UPDATE')) {
      const tableMatch = query.match(/\bupdate\s+(\w+)/i);
      const table = tableMatch[1];
      const setMatch = query.match(/\bset\s+(.+?)\s+where/i);
      if (!setMatch) throw new Error('Cannot parse UPDATE');
      const setParts = setMatch[1].split(',');
      const { conditions } = this._parseWhere(query, params.slice(setParts.length));
      const updateData = {};
      let pi = 0;
      for (const part of setParts) {
        const cm = part.match(/(\w+)\s*=\s*\?/i);
        if (cm) { updateData[cm[1]] = params[pi]; pi++; }
      }
      let q = this.client.from(table).update(updateData);
      for (const c of conditions) {
        q = q.eq(c.column, c.value);
      }
      const { data, error } = await q.select();
      if (error) throw error;
      return data;
    }
    if (upper.startsWith('DELETE')) {
      const tableMatch = query.match(/\bdelete\s+from\s+(\w+)/i);
      const table = tableMatch[1];
      const { conditions } = this._parseWhere(query, params);
      let q = this.client.from(table).delete();
      for (const c of conditions) {
        q = q.eq(c.column, c.value);
      }
      const { error } = await q;
      if (error) throw error;
      return [];
    }
    if (upper.startsWith('CREATE') || upper.startsWith('ALTER')) {
      return { rowCount: 0 };
    }
    throw new Error(`Unsupported query: ${query}`);
  }
}

module.exports = { SqliteAdapter, SupabaseAdapter };
