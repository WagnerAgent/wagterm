import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export const initializeDatabase = (dbPath: string): Database.Database => {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT NOT NULL,
      auth_method TEXT NOT NULL,
      credential_id TEXT,
      key_path TEXT,
      host_key_policy TEXT,
      known_hosts_path TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      public_key TEXT,
      fingerprint TEXT,
      path TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const connectionColumns = db
    .prepare('PRAGMA table_info(connections)')
    .all()
    .map((row: { name: string }) => row.name);

  const addColumnIfMissing = (name: string, definition: string) => {
    if (!connectionColumns.includes(name)) {
      db.exec(`ALTER TABLE connections ADD COLUMN ${definition}`);
    }
  };

  addColumnIfMissing('key_path', 'key_path TEXT');
  addColumnIfMissing('host_key_policy', 'host_key_policy TEXT');
  addColumnIfMissing('known_hosts_path', 'known_hosts_path TEXT');

  return db;
};
