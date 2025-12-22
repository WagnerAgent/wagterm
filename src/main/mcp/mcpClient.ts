import { randomUUID } from 'crypto';

export type McpClientStatus = 'idle' | 'connected' | 'error';

export class McpClient {
  readonly id: string;
  readonly command: string;
  readonly args: string[];
  status: McpClientStatus = 'idle';
  lastError?: string;

  constructor(command: string, args: string[]) {
    this.id = randomUUID();
    this.command = command;
    this.args = args;
  }

  async connect(): Promise<void> {
    if (this.status === 'connected') {
      return;
    }

    this.status = 'connected';
    this.lastError = undefined;
  }

  async disconnect(): Promise<void> {
    if (this.status !== 'connected') {
      return;
    }

    this.status = 'idle';
  }
}
