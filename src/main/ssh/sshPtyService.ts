import { randomUUID } from 'crypto';
import { dirname, isAbsolute, join } from 'path';
import type { WebContents } from 'electron';
import { spawn } from 'node-pty';
import keytar from 'keytar';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import { IpcChannels } from '../../shared/ipc';
import type {
  ConnectionProfile,
  HostKeyPolicy,
  JumpHostConfig,
  SshAuthMethod,
  SshSessionCloseRequest,
  SshSessionDataEvent,
  SshSessionExitEvent,
  SshSessionInputRequest,
  SshSessionOutputRequest,
  SshSessionOutputResponse,
  SshSessionResizeRequest,
  SshSessionStartRequest,
  SshSessionStartResponse
} from '../../shared/ssh';

type SessionRecord = {
  id: string;
  profile: ConnectionProfile;
  pty: ReturnType<typeof spawn>;
  tempKeyPath?: string;
  tempJumpKeyPath?: string;
};

const OUTPUT_BUFFER_LIMIT = 20000;

const redactOutput = (value: string): string => {
  // Hook for future redaction (tokens, secrets, etc).
  return value;
};

class OutputBuffer {
  private buffer = '';
  private truncated = false;

  constructor(private readonly maxChars: number) {}

  append(value: string) {
    const sanitized = redactOutput(value);
    this.buffer += sanitized;
    if (this.buffer.length > this.maxChars) {
      this.buffer = this.buffer.slice(-this.maxChars);
      this.truncated = true;
    }
  }

  getRecent(limit?: number): { output: string; truncated: boolean } {
    if (!limit || limit >= this.buffer.length) {
      return { output: this.buffer, truncated: this.truncated };
    }
    return {
      output: this.buffer.slice(-limit),
      truncated: true
    };
  }
}

const isValidHost = (host: string): boolean => {
  if (host.includes('://')) {
    return false;
  }
  return host.trim().length > 0;
};

const isValidPort = (port: number): boolean => port > 0 && port <= 65535;

const resolveHostKeyPolicy = (policy?: HostKeyPolicy): HostKeyPolicy => policy ?? 'strict';

const buildSshArgs = (
  profile: ConnectionProfile,
  policy: HostKeyPolicy,
  knownHostsPath?: string,
  keyPathOverride?: string,
  jumpHost?: JumpHostConfig,
  jumpKeyPath?: string
) => {
  const args: string[] = [];

  if (profile.port) {
    args.push('-p', String(profile.port));
  }

  if (keyPathOverride) {
    args.push('-i', keyPathOverride);
  }

  if (policy === 'accept-new') {
    args.push('-o', 'StrictHostKeyChecking=accept-new');
  } else if (policy === 'strict') {
    args.push('-o', 'StrictHostKeyChecking=yes');
  }

  if (knownHostsPath) {
    args.push('-o', `UserKnownHostsFile=${knownHostsPath}`);
  } else if (profile.knownHostsPath) {
    args.push('-o', `UserKnownHostsFile=${profile.knownHostsPath}`);
  }

  if (jumpHost) {
    const proxyParts = ['ssh', '-W', '%h:%p'];
    if (jumpHost.port) {
      proxyParts.push('-p', String(jumpHost.port));
    }
    if (jumpKeyPath) {
      proxyParts.push('-i', jumpKeyPath);
    }
    const jumpPolicy = resolveHostKeyPolicy(jumpHost.hostKeyPolicy);
    if (jumpPolicy === 'accept-new') {
      proxyParts.push('-o', 'StrictHostKeyChecking=accept-new');
    } else if (jumpPolicy === 'strict') {
      proxyParts.push('-o', 'StrictHostKeyChecking=yes');
    }
    if (jumpHost.knownHostsPath) {
      proxyParts.push('-o', `UserKnownHostsFile=${jumpHost.knownHostsPath}`);
    }
    proxyParts.push(`${jumpHost.username}@${jumpHost.host}`);
    args.push('-o', `ProxyCommand=${proxyParts.join(' ')}`);
  }

  args.push(`${profile.username}@${profile.host}`);

  return args;
};

const normalizePrivateKey = (value: string): string => {
  const trimmed = value.replace(/\r\n/g, '\n').trim();
  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return `${lines.join('\n')}\n`;
};

const isPrivateKeyFormatValid = (value: string): boolean => {
  const lines = value.trim().split('\n');
  if (lines.length < 3) {
    return false;
  }

  const header = lines[0];
  const footer = lines[lines.length - 1];
  if (!header.startsWith('-----BEGIN ') || !header.endsWith('PRIVATE KEY-----')) {
    return false;
  }

  if (!footer.startsWith('-----END ') || !footer.endsWith('PRIVATE KEY-----')) {
    return false;
  }

  return true;
};

const validateProfile = (profile: ConnectionProfile): string[] => {
  const errors: string[] = [];

  if (!profile.id.trim()) {
    errors.push('Connection id is required.');
  }

  if (!profile.name.trim()) {
    errors.push('Connection name is required.');
  }

  if (!profile.username.trim()) {
    errors.push('Username is required.');
  }

  if (!isValidHost(profile.host)) {
    errors.push('Host must be a hostname or IP.');
  }

  if (!isValidPort(profile.port)) {
    errors.push('Port must be 1-65535.');
  }

  if (profile.authMethod === 'pem' && !profile.keyPath && !profile.credentialId) {
    errors.push('SSH key is required.');
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
      errors.push('Jump host must be a hostname or IP.');
    }
    if (!jump.username.trim()) {
      errors.push('Jump host username is required.');
    }
    if (!isValidPort(jump.port)) {
      errors.push('Jump host port must be 1-65535.');
    }
    if (jump.authMethod === 'pem' && !jump.keyPath && !jump.credentialId) {
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

const isLocalKnownHostsPath = (pathValue?: string): boolean => {
  if (!pathValue) {
    return true;
  }

  return isAbsolute(pathValue);
};

const isPemAuth = (authMethod: SshAuthMethod): boolean => authMethod === 'pem';

export class SshPtyService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly outputBuffers = new Map<string, OutputBuffer>();
  private readonly serviceName = 'wagterm';

  async startSession(
    request: SshSessionStartRequest,
    sender: WebContents
  ): Promise<SshSessionStartResponse> {
    const validationErrors = validateProfile(request.profile);

    if (!isLocalKnownHostsPath(request.knownHostsPath)) {
      validationErrors.push('Known hosts path must be absolute.');
    }

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(' '));
    }

    const policy = resolveHostKeyPolicy(request.hostKeyPolicy ?? request.profile.hostKeyPolicy);
    const { keyPath, tempKeyPath } = await this.resolveKeyPath({
      authMethod: request.profile.authMethod,
      keyPath: request.profile.keyPath,
      credentialId: request.profile.credentialId
    });
    const jumpHost = request.profile.jumpHost;
    const { keyPath: jumpKeyPath, tempKeyPath: tempJumpKeyPath } = jumpHost
      ? await this.resolveKeyPath({
          authMethod: jumpHost.authMethod,
          keyPath: jumpHost.keyPath,
          credentialId: jumpHost.credentialId
        })
      : { keyPath: undefined, tempKeyPath: undefined };
    const args = buildSshArgs(
      request.profile,
      policy,
      request.knownHostsPath,
      keyPath,
      jumpHost,
      jumpKeyPath
    );

    const sessionId = randomUUID();
    const pty = spawn('ssh', args, {
      name: 'xterm-256color',
      cols: request.cols,
      rows: request.rows,
      cwd: process.cwd(),
      env: {
        ...process.env
      }
    });

    const record: SessionRecord = {
      id: sessionId,
      profile: request.profile,
      pty,
      tempKeyPath,
      tempJumpKeyPath
    };

    this.sessions.set(sessionId, record);
    this.outputBuffers.set(sessionId, new OutputBuffer(OUTPUT_BUFFER_LIMIT));

    pty.onData((data) => {
      const buffer = this.outputBuffers.get(sessionId);
      buffer?.append(data);
      const payload: SshSessionDataEvent = { sessionId, data };
      sender.send(IpcChannels.sshSessionData, payload);
    });

    pty.onExit(({ exitCode, signal }) => {
      const payload: SshSessionExitEvent = { sessionId, exitCode, signal };
      sender.send(IpcChannels.sshSessionExit, payload);
      this.sessions.delete(sessionId);
      this.outputBuffers.delete(sessionId);
      void this.cleanupTempKey(tempKeyPath);
      void this.cleanupTempKey(tempJumpKeyPath);
    });

    return { sessionId };
  }

  sendInput(request: SshSessionInputRequest): void {
    const record = this.sessions.get(request.sessionId);
    if (!record) {
      throw new Error('SSH session not found.');
    }

    record.pty.write(request.data);
  }

  resize(request: SshSessionResizeRequest): void {
    const record = this.sessions.get(request.sessionId);
    if (!record) {
      throw new Error('SSH session not found.');
    }

    record.pty.resize(request.cols, request.rows);
  }

  close(request: SshSessionCloseRequest): void {
    const record = this.sessions.get(request.sessionId);
    if (!record) {
      return;
    }

    record.pty.kill();
    void this.cleanupTempKey(record.tempKeyPath);
    void this.cleanupTempKey(record.tempJumpKeyPath);
    this.sessions.delete(request.sessionId);
    this.outputBuffers.delete(request.sessionId);
  }

  getRecentOutput(request: SshSessionOutputRequest): SshSessionOutputResponse {
    const buffer = this.outputBuffers.get(request.sessionId);
    if (!buffer) {
      throw new Error('SSH session not found.');
    }

    const { output, truncated } = buffer.getRecent(request.limit);
    return { sessionId: request.sessionId, output, truncated };
  }

  getSessionContext(sessionId: string) {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return undefined;
    }
    return {
      id: record.id,
      name: record.profile.name,
      host: record.profile.host,
      username: record.profile.username,
      port: record.profile.port
    };
  }

  private async resolveKeyPath(source: {
    authMethod: SshAuthMethod;
    keyPath?: string;
    credentialId?: string;
  }): Promise<{ keyPath?: string; tempKeyPath?: string }> {
    if (!isPemAuth(source.authMethod)) {
      return {};
    }

    if (source.keyPath) {
      return { keyPath: source.keyPath };
    }

    if (!source.credentialId) {
      return {};
    }

    const privateKey = await keytar.getPassword(this.serviceName, `${source.credentialId}:private`);
    if (!privateKey) {
      throw new Error('No private key found for this credential. Re-add the SSH key.');
    }

    const dir = await mkdtemp(join(os.tmpdir(), 'wagterm-key-'));
    const tempKeyPath = join(dir, 'id_key');
    const normalized = normalizePrivateKey(privateKey);
    if (!isPrivateKeyFormatValid(normalized)) {
      await rm(dir, { recursive: true, force: true });
      throw new Error('Stored private key has invalid format. Re-add the SSH key.');
    }
    await writeFile(tempKeyPath, normalized, { mode: 0o600 });

    return { keyPath: tempKeyPath, tempKeyPath };
  }

  private async cleanupTempKey(tempKeyPath?: string): Promise<void> {
    if (!tempKeyPath) {
      return;
    }
    try {
      await rm(dirname(tempKeyPath), { recursive: true, force: true });
    } catch {
      // Best-effort cleanup.
    }
  }
}
