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
  UpdateConnectionResponse,
  UpdateKeyRequest,
  UpdateKeyResponse
} from '../../shared/ssh';
import type { AppSettings, AutoApprovalThreshold } from '../../shared/settings';

const SERVICE_NAME = 'wagterm';
const privateKeyAccount = (id: string) => `${id}:private`;
const passphraseAccount = (id: string) => `${id}:passphrase`;
const connectionPasswordAccount = (id: string) => `${id}:password`;

const SETTINGS_DEFAULTS: AppSettings = {
  defaultModel: 'gpt-5.2',
  autoApprovalEnabled: false,
  autoApprovalThreshold: 'low',
  showPlanPanel: true
};

const SETTINGS_KEYS = {
  defaultModel: 'default_model',
  autoApprovalEnabled: 'auto_approval_enabled',
  autoApprovalThreshold: 'auto_approval_threshold',
  showPlanPanel: 'show_plan_panel'
} as const;

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }
  return value === 'true';
};

const parseThreshold = (value: string | undefined, fallback: AutoApprovalThreshold) => {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return fallback;
};

const parseModel = (value: string | undefined, fallback: AppSettings['defaultModel']) => {
  if (
    value === 'gpt-5.2' ||
    value === 'gpt-5-mini' ||
    value === 'claude-sonnet-4.5' ||
    value === 'claude-opus-4.5' ||
    value === 'claude-haiku-4.5'
  ) {
    return value;
  }
  return fallback;
};

const validateConnectionProfile = (
  profile: ConnectionProfile,
  password?: string,
  requirePassword = false
): string[] => {
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

  if (profile.authMethod === 'pem' && !profile.credentialId) {
    errors.push('SSH key is required.');
  }

  if (profile.authMethod === 'password' && requirePassword && !password) {
    errors.push('Password is required.');
  }

  if (profile.keyPath && !isAbsolute(profile.keyPath)) {
    errors.push('Key path must be absolute.');
  }

  if (profile.knownHostsPath && !isAbsolute(profile.knownHostsPath)) {
    errors.push('Known hosts path must be absolute.');
  }

  if (profile.jumpHost) {
    const jump = profile.jumpHost;
    if (!jump.host.trim()) {
      errors.push('Jump host is required.');
    }
    if (!jump.username.trim()) {
      errors.push('Jump host username is required.');
    }
    if (!jump.port || jump.port <= 0 || jump.port > 65535) {
      errors.push('Jump host port must be 1-65535.');
    }
    if (jump.authMethod === 'pem' && !jump.credentialId && !jump.keyPath) {
      errors.push('Jump host SSH key is required.');
    }
    if (jump.keyPath && !isAbsolute(jump.keyPath)) {
      errors.push('Jump host key path must be absolute.');
    }
    if (jump.knownHostsPath && !isAbsolute(jump.knownHostsPath)) {
      errors.push('Jump host known hosts path must be absolute.');
    }
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

  getAppSettings(): AppSettings {
    const rows = this.db
      .prepare('SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?)')
      .all(
        SETTINGS_KEYS.defaultModel,
        SETTINGS_KEYS.autoApprovalEnabled,
        SETTINGS_KEYS.autoApprovalThreshold,
        SETTINGS_KEYS.showPlanPanel
      ) as Array<{ key: string; value: string }>;

    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    return {
      defaultModel: parseModel(
        byKey.get(SETTINGS_KEYS.defaultModel),
        SETTINGS_DEFAULTS.defaultModel
      ),
      autoApprovalEnabled: parseBoolean(
        byKey.get(SETTINGS_KEYS.autoApprovalEnabled),
        SETTINGS_DEFAULTS.autoApprovalEnabled
      ),
      autoApprovalThreshold: parseThreshold(
        byKey.get(SETTINGS_KEYS.autoApprovalThreshold),
        SETTINGS_DEFAULTS.autoApprovalThreshold
      ),
      showPlanPanel: parseBoolean(
        byKey.get(SETTINGS_KEYS.showPlanPanel),
        SETTINGS_DEFAULTS.showPlanPanel
      )
    };
  }

  updateAppSettings(settings: Partial<AppSettings>): AppSettings {
    const entries: Array<[string, string]> = [];

    if (settings.defaultModel) {
      entries.push([SETTINGS_KEYS.defaultModel, settings.defaultModel]);
    }
    if (settings.autoApprovalEnabled !== undefined) {
      entries.push([SETTINGS_KEYS.autoApprovalEnabled, String(settings.autoApprovalEnabled)]);
    }
    if (settings.autoApprovalThreshold) {
      entries.push([SETTINGS_KEYS.autoApprovalThreshold, settings.autoApprovalThreshold]);
    }
    if (settings.showPlanPanel !== undefined) {
      entries.push([SETTINGS_KEYS.showPlanPanel, String(settings.showPlanPanel)]);
    }

    if (entries.length > 0) {
      const statement = this.db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);
      const transaction = this.db.transaction(() => {
        for (const entry of entries) {
          statement.run(entry[0], entry[1]);
        }
      });
      transaction();
    }

    return this.getAppSettings();
  }

  addConnection(request: AddConnectionRequest): AddConnectionResponse {
    const errors = validateConnectionProfile(request.profile, request.password, true);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const profile = request.profile;
    const statement = this.db.prepare(`
      INSERT INTO connections (
        id,
        name,
        host,
        port,
        username,
        auth_method,
        credential_id,
        key_path,
        host_key_policy,
        known_hosts_path,
        jump_host,
        jump_port,
        jump_username,
        jump_auth_method,
        jump_credential_id,
        jump_key_path,
        jump_host_key_policy,
        jump_known_hosts_path,
        created_at
      )
      VALUES (
        @id,
        @name,
        @host,
        @port,
        @username,
        @authMethod,
        @credentialId,
        @keyPath,
        @hostKeyPolicy,
        @knownHostsPath,
        @jumpHost,
        @jumpPort,
        @jumpUsername,
        @jumpAuthMethod,
        @jumpCredentialId,
        @jumpKeyPath,
        @jumpHostKeyPolicy,
        @jumpKnownHostsPath,
        @createdAt
      )
    `);

    statement.run({
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authMethod: profile.authMethod,
      credentialId: profile.credentialId ?? null,
      keyPath: profile.keyPath ?? null,
      hostKeyPolicy: profile.hostKeyPolicy ?? null,
      knownHostsPath: profile.knownHostsPath ?? null,
      jumpHost: profile.jumpHost?.host ?? null,
      jumpPort: profile.jumpHost?.port ?? null,
      jumpUsername: profile.jumpHost?.username ?? null,
      jumpAuthMethod: profile.jumpHost?.authMethod ?? null,
      jumpCredentialId: profile.jumpHost?.credentialId ?? null,
      jumpKeyPath: profile.jumpHost?.keyPath ?? null,
      jumpHostKeyPolicy: profile.jumpHost?.hostKeyPolicy ?? null,
      jumpKnownHostsPath: profile.jumpHost?.knownHostsPath ?? null,
      createdAt: new Date().toISOString()
    });

    if (request.password) {
      void keytar.setPassword(SERVICE_NAME, connectionPasswordAccount(profile.id), request.password);
    }

    return { profile };
  }

  updateConnection(request: UpdateConnectionRequest): UpdateConnectionResponse {
    const errors = validateConnectionProfile(request.profile, request.password, false);
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
          credential_id = @credentialId,
          key_path = @keyPath,
          host_key_policy = @hostKeyPolicy,
          known_hosts_path = @knownHostsPath,
          jump_host = @jumpHost,
          jump_port = @jumpPort,
          jump_username = @jumpUsername,
          jump_auth_method = @jumpAuthMethod,
          jump_credential_id = @jumpCredentialId,
          jump_key_path = @jumpKeyPath,
          jump_host_key_policy = @jumpHostKeyPolicy,
          jump_known_hosts_path = @jumpKnownHostsPath
      WHERE id = @id
    `);

    statement.run({
      id: profile.id,
      name: profile.name,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      authMethod: profile.authMethod,
      credentialId: profile.credentialId ?? null,
      keyPath: profile.keyPath ?? null,
      hostKeyPolicy: profile.hostKeyPolicy ?? null,
      knownHostsPath: profile.knownHostsPath ?? null,
      jumpHost: profile.jumpHost?.host ?? null,
      jumpPort: profile.jumpHost?.port ?? null,
      jumpUsername: profile.jumpHost?.username ?? null,
      jumpAuthMethod: profile.jumpHost?.authMethod ?? null,
      jumpCredentialId: profile.jumpHost?.credentialId ?? null,
      jumpKeyPath: profile.jumpHost?.keyPath ?? null,
      jumpHostKeyPolicy: profile.jumpHost?.hostKeyPolicy ?? null,
      jumpKnownHostsPath: profile.jumpHost?.knownHostsPath ?? null
    });

    if (profile.authMethod === 'password') {
      if (request.password) {
        void keytar.setPassword(SERVICE_NAME, connectionPasswordAccount(profile.id), request.password);
      }
    } else {
      void keytar.deletePassword(SERVICE_NAME, connectionPasswordAccount(profile.id));
    }

    return { profile };
  }

  deleteConnection(request: DeleteConnectionRequest): DeleteConnectionResponse {
    this.db.prepare('DELETE FROM connections WHERE id = ?').run(request.id);
    void keytar.deletePassword(SERVICE_NAME, connectionPasswordAccount(request.id));
    return { id: request.id };
  }

  listConnections(): ListConnectionProfilesResponse {
    const rows = this.db
      .prepare(
        `SELECT id,
                name,
                host,
                port,
                username,
                auth_method as authMethod,
                credential_id as credentialId,
                key_path as keyPath,
                host_key_policy as hostKeyPolicy,
                known_hosts_path as knownHostsPath,
                jump_host as jumpHost,
                jump_port as jumpPort,
                jump_username as jumpUsername,
                jump_auth_method as jumpAuthMethod,
                jump_credential_id as jumpCredentialId,
                jump_key_path as jumpKeyPath,
                jump_host_key_policy as jumpHostKeyPolicy,
                jump_known_hosts_path as jumpKnownHostsPath
         FROM connections`
      )
      .all();

    const profiles = rows.map((row) => {
      const hasJumpHost = Boolean(row.jumpHost || row.jumpUsername || row.jumpPort);
      return {
        ...row,
        jumpHost: hasJumpHost
          ? {
              host: row.jumpHost ?? '',
              port: row.jumpPort ?? 22,
              username: row.jumpUsername ?? '',
              authMethod: row.jumpAuthMethod ?? 'pem',
              credentialId: row.jumpCredentialId ?? undefined,
              keyPath: row.jumpKeyPath ?? undefined,
              hostKeyPolicy: row.jumpHostKeyPolicy ?? undefined,
              knownHostsPath: row.jumpKnownHostsPath ?? undefined
            }
          : undefined
      };
    });

    return { profiles } as ListConnectionProfilesResponse;
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

    if (request.privateKey) {
      await keytar.setPassword(SERVICE_NAME, privateKeyAccount(key.id), request.privateKey);
    }

    if (request.passphrase) {
      await keytar.setPassword(SERVICE_NAME, passphraseAccount(key.id), request.passphrase);
    }

    return { key };
  }

  async updateKey(request: UpdateKeyRequest): Promise<UpdateKeyResponse> {
    const errors = validateKeyRecord(request.key);
    if (errors.length > 0) {
      throw new Error(errors.join(' '));
    }

    const key = request.key;
    const statement = this.db.prepare(`
      UPDATE keys
      SET name = @name,
          type = @type,
          public_key = @publicKey,
          fingerprint = @fingerprint,
          path = @path
      WHERE id = @id
    `);

    statement.run({
      id: key.id,
      name: key.name,
      type: key.type,
      publicKey: key.publicKey ?? null,
      fingerprint: key.fingerprint ?? null,
      path: key.path ?? null
    });

    if (request.clearPrivateKey) {
      await keytar.deletePassword(SERVICE_NAME, privateKeyAccount(key.id));
    } else if (request.privateKey) {
      await keytar.setPassword(SERVICE_NAME, privateKeyAccount(key.id), request.privateKey);
    }

    if (request.clearPassphrase) {
      await keytar.deletePassword(SERVICE_NAME, passphraseAccount(key.id));
    } else if (request.passphrase) {
      await keytar.setPassword(SERVICE_NAME, passphraseAccount(key.id), request.passphrase);
    }

    return { key };
  }

  async deleteKey(request: DeleteKeyRequest): Promise<DeleteKeyResponse> {
    this.db.prepare('DELETE FROM keys WHERE id = ?').run(request.id);
    await keytar.deletePassword(SERVICE_NAME, privateKeyAccount(request.id));
    await keytar.deletePassword(SERVICE_NAME, passphraseAccount(request.id));
    return { id: request.id };
  }

  listKeys(): ListKeysResponse {
    const rows = this.db
      .prepare(`SELECT id, name, type, public_key as publicKey, fingerprint, path FROM keys`)
      .all();

    return { keys: rows } as ListKeysResponse;
  }
}
