import type Database from 'better-sqlite3';
import keytar from 'keytar';
import { isAbsolute } from 'path';
import type {
  AddConnectionRequest,
  AddConnectionResponse,
  AddKeyRequest,
  AddKeyResponse,
  ConnectionProfile,
  DeleteConnectionRequest,
  DeleteConnectionResponse,
  DeleteKeyRequest,
  DeleteKeyResponse,
  KeyRecord,
  ListConnectionProfilesResponse,
  ListKeysResponse,
  UpdateConnectionRequest,
  UpdateConnectionResponse
} from '../../shared/ssh';

const SERVICE_NAME = 'wagterm';

const validateConnectionProfile = (profile: ConnectionProfile): string[] => {
  const errors: string[] = [];

  if (!profile.id.trim()) {
    errors.push('Connection id is required.');
  }

  if (!profile.name.trim()) {
    errors.push('Connection name is required.');
  }

  if (!profile.host.trim()) {
    errors.push('Host is required.');
  }

  if (!profile.username.trim()) {
    errors.push('Username is required.');
  }

  if (!profile.port || profile.port <= 0 || profile.port > 65535) {
    errors.push('Port must be 1-65535.');
  }

  return errors;
};

const validateKeyRecord = (key: KeyRecord): string[] => {
  const errors: string[] = [];

  if (!key.id.trim()) {
    errors.push('Key id is required.');
  }

  if (!key.name.trim()) {
    errors.push('Key name is required.');
  }

  if (key.type === 'pem' && key.path && !isAbsolute(key.path)) {
    errors.push('PEM file path must be absolute.');
  }

  return errors;
};

export class StorageService {
  constructor(private readonly db: Database.Database) {}

  addConnection(request: AddConnectionRequest): AddConnectionResponse {
    const errors = validateConnectionProfile(request.profile);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const profile = request.profile;
    const statement = this.db.prepare(`
      INSERT INTO connections (id, name, host, port, username, auth_method, credential_id, created_at)
      VALUES (@id, @name, @host, @port, @username, @authMethod, @credentialId, @createdAt)
    `);

    statement.run({
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authMethod: profile.authMethod,
      credentialId: profile.credentialId ?? null,
      createdAt: new Date().toISOString()
    });

    return { profile };
  }

  updateConnection(request: UpdateConnectionRequest): UpdateConnectionResponse {
    const errors = validateConnectionProfile(request.profile);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const profile = request.profile;
    const statement = this.db.prepare(`
      UPDATE connections
      SET name = @name,
          host = @host,
          port = @port,
          username = @username,
          auth_method = @authMethod,
          credential_id = @credentialId
      WHERE id = @id
    `);

    statement.run({
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authMethod: profile.authMethod,
      credentialId: profile.credentialId ?? null
    });

    return { profile };
  }

  deleteConnection(request: DeleteConnectionRequest): DeleteConnectionResponse {
    this.db.prepare('DELETE FROM connections WHERE id = ?').run(request.id);
    return { id: request.id };
  }

  listConnections(): ListConnectionProfilesResponse {
    const rows = this.db
      .prepare(
        `SELECT id, name, host, port, username, auth_method as authMethod, credential_id as credentialId FROM connections`
      )
      .all();

    return { profiles: rows } as ListConnectionProfilesResponse;
  }

  async addKey(request: AddKeyRequest): Promise<AddKeyResponse> {
    const errors = validateKeyRecord(request.key);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const key = request.key;
    const statement = this.db.prepare(`
      INSERT INTO keys (id, name, type, public_key, fingerprint, path, created_at)
      VALUES (@id, @name, @type, @publicKey, @fingerprint, @path, @createdAt)
    `);

    statement.run({
      id: key.id,
      name: key.name,
      type: key.type,
      publicKey: key.publicKey ?? null,
      fingerprint: key.fingerprint ?? null,
      path: key.path ?? null,
      createdAt: new Date().toISOString()
    });

    if (request.secret) {
      await keytar.setPassword(SERVICE_NAME, key.id, request.secret);
    }

    return { key };
  }

  async deleteKey(request: DeleteKeyRequest): Promise<DeleteKeyResponse> {
    this.db.prepare('DELETE FROM keys WHERE id = ?').run(request.id);
    await keytar.deletePassword(SERVICE_NAME, request.id);
    return { id: request.id };
  }

  listKeys(): ListKeysResponse {
    const rows = this.db
      .prepare(`SELECT id, name, type, public_key as publicKey, fingerprint, path FROM keys`)
      .all();

    return { keys: rows } as ListKeysResponse;
  }
}
