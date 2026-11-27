// A small in-memory stand-in for Cloudflare D1, backed by node:sqlite, so Worker data code
// can be tested against the real migrations without wrangler.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

function returnsRows(sql) {
  return /^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql);
}

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Statement(this.db, this.sql, params);
  }
  execute() {
    const statement = this.db.prepare(this.sql);
    if (returnsRows(this.sql)) return { results: statement.all(...this.params), meta: { changes: 0 } };
    const info = statement.run(...this.params);
    return { results: [], meta: { changes: Number(info.changes) } };
  }
  async first(column) {
    const row = this.db.prepare(this.sql).get(...this.params) ?? null;
    return column && row ? row[column] : row;
  }
  async all() {
    return this.execute();
  }
  async run() {
    return this.execute();
  }
}

export function createTestD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const migrationsDir = new URL('../../worker/migrations/', import.meta.url);
  for (const file of readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(file, migrationsDir), 'utf8'));
  }
  return {
    raw: db,
    prepare: (sql) => new Statement(db, sql),
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map((statement) => statement.execute());
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
