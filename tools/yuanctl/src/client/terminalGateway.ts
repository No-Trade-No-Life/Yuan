import { Terminal } from '@yuants/protocol';
import type { ResolvedHostConfig } from '../config/types';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';
import { DEFAULT_CONNECT_TIMEOUT_MS } from '../constants';

interface GatewayKey {
  hostUrl: string;
  terminalId: string;
}

const makeKey = (ctx: GatewayKey) => `${ctx.hostUrl}::${ctx.terminalId}`;

export class TerminalGateway {
  private static cache = new Map<string, TerminalGateway>();

  static async ensure(config: ResolvedHostConfig): Promise<TerminalGateway> {
    const key = makeKey({ hostUrl: config.hostUrl, terminalId: config.terminalId });
    const existing = this.cache.get(key);
    if (existing) {
      return existing;
    }
    const gateway = new TerminalGateway(config);
    this.cache.set(key, gateway);
    await gateway.waitUntilReady();
    return gateway;
  }

  public readonly terminal: Terminal;

  private constructor(private readonly hostConfig: ResolvedHostConfig) {
    this.terminal = new Terminal(
      hostConfig.hostUrl,
      {
        terminal_id: hostConfig.terminalId,
        name: '@yuants/yuanctl',
      },
      {
        verbose: false,
      },
    );
  }

  private async waitUntilReady(): Promise<void> {
    try {
      await firstValueFrom(
        this.terminal.isConnected$.pipe(
          timeout(this.hostConfig.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS),
        ),
      );
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new Error(
          `Timed out while connecting to host ${this.hostConfig.hostUrl} as terminal ${this.hostConfig.terminalId}`,
        );
      }
      throw err;
    }
  }

  dispose(): void {
    this.terminal.dispose();
  }
}
