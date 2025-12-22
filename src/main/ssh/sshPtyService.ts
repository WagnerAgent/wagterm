import { randomUUID } from 'crypto';
import { isAbsolute } from 'path';
import type { WebContents } from 'electron';
import { spawn } from 'node-pty';
import { IpcChannels } from '../../shared/ipc';
import type {
  ConnectionProfile,
  HostKeyPolicy,
  SshSessionCloseRequest,
  SshSessionDataEvent,
  SshSessionExitEvent,
  SshSessionInputRequest,
  SshSessionResizeRequest,
  SshSessionStartRequest,
  SshSessionStartResponse
} from '../../shared/ssh';

type SessionRecord = {
  id: string;
  pty: ReturnType<typeof spawn>;
};

const isValidHost = (host: string): boolean => {
  if (host.includes('://')) {
    return false;
  }
  return host.trim().length > 0;
};

const isValidPort = (port: number): boolean => port > 0 && port <= 65535;

const resolveHostKeyPolicy = (policy?: HostKeyPolicy): HostKeyPolicy => policy ?? 'strict';

const buildSshArgs = (profile: ConnectionProfile, policy: HostKeyPolicy, knownHostsPath?: string) => {
  const args: string[] = [];

  if (profile.port) {
    args.push('-p', String(profile.port));
  }

  if (policy === 'accept-new') {
    args.push('-o', 'StrictHostKeyChecking=accept-new');
  }

  if (knownHostsPath) {
    args.push('-o', `UserKnownHostsFile=${knownHostsPath}`);
  }

  args.push(`${profile.username}@${profile.host}`);

  return args;
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

  return errors;
};

const isLocalKnownHostsPath = (pathValue?: string): boolean => {
  if (!pathValue) {
    return true;
  }

  return isAbsolute(pathValue);
};

export class SshPtyService {
  private readonly sessions = new Map<string, SessionRecord>();

  startSession(request: SshSessionStartRequest, sender: WebContents): SshSessionStartResponse {
    const validationErrors = validateProfile(request.profile);

    if (!isLocalKnownHostsPath(request.knownHostsPath)) {
      validationErrors.push('Known hosts path must be absolute.');
    }

    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join(' '));
    }

    const policy = resolveHostKeyPolicy(request.hostKeyPolicy);
    const args = buildSshArgs(request.profile, policy, request.knownHostsPath);

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
      pty
    };

    this.sessions.set(sessionId, record);

    pty.onData((data) => {
      const payload: SshSessionDataEvent = { sessionId, data };
      sender.send(IpcChannels.sshSessionData, payload);
    });

    pty.onExit(({ exitCode, signal }) => {
      const payload: SshSessionExitEvent = { sessionId, exitCode, signal };
      sender.send(IpcChannels.sshSessionExit, payload);
      this.sessions.delete(sessionId);
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
    this.sessions.delete(request.sessionId);
  }
}
