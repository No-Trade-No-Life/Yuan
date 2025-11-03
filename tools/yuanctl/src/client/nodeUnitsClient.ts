import type { TerminalGateway } from './terminalGateway';
import { firstValueFrom, map, timeout, TimeoutError } from 'rxjs';

export interface NodeUnitInfo {
  address: string;
  name: string;
  version: string;
}

export class NodeUnitsClient {
  constructor(private readonly gateway: TerminalGateway) {}

  async list(timeoutMs = 5_000): Promise<NodeUnitInfo[]> {
    try {
      const infos = await firstValueFrom(
        this.gateway.terminal.terminalInfos$.pipe(
          timeout(timeoutMs),
          map((terminalInfos) =>
            terminalInfos
              .map((info) => info.tags || {})
              .filter((tags) => tags.node_unit === 'true')
              .map((tags) => ({
                address: tags.node_unit_address || '',
                name: tags.node_unit_name || '',
                version: tags.node_unit_version || '',
              })),
          ),
        ),
      );
      return infos;
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new Error('Timed out while retrieving node unit information from terminal gateway');
      }
      throw err;
    }
  }
}
