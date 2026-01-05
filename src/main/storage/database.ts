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
      jump_host TEXT,
      jump_port INTEGER,
      jump_username TEXT,
      jump_auth_method TEXT,
      jump_credential_id TEXT,
      jump_key_path TEXT,
      jump_host_key_policy TEXT,
      jump_known_hosts_path TEXT,
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
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
  addColumnIfMissing('jump_host', 'jump_host TEXT');
  addColumnIfMissing('jump_port', 'jump_port INTEGER');
  addColumnIfMissing('jump_username', 'jump_username TEXT');
  addColumnIfMissing('jump_auth_method', 'jump_auth_method TEXT');
  addColumnIfMissing('jump_credential_id', 'jump_credential_id TEXT');
  addColumnIfMissing('jump_key_path', 'jump_key_path TEXT');
  addColumnIfMissing('jump_host_key_policy', 'jump_host_key_policy TEXT');
  addColumnIfMissing('jump_known_hosts_path', 'jump_known_hosts_path TEXT');

  return db;
};
