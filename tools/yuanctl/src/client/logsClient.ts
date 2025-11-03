import type { TerminalGateway } from './terminalGateway';
import { encodePath } from '@yuants/utils';
import { firstValueFrom, map } from 'rxjs';

interface ReadSliceResult {
  content: string;
  start: number;
  end: number;
  file_size: number;
}

export interface ReadSliceOptions {
  deploymentId: string;
  start: number;
  fileIndex?: number;
}

export interface FollowOptions {
  deploymentId: string;
  nodeUnit: string;
}

export class LogsClient {
  constructor(private readonly gateway: TerminalGateway) {}

  async readSlice(options: ReadSliceOptions): Promise<ReadSliceResult> {
    const payload: any = {
      deployment_id: options.deploymentId,
      start: options.start,
    };
    if (typeof options.fileIndex === 'number') {
      payload.file_index = options.fileIndex;
    }
    const observable = this.gateway.terminal.client.requestService<typeof payload, ReadSliceResult>(
      'Deployment/ReadLogSlice',
      payload,
    );
    const response = await firstValueFrom(
      observable.pipe(
        map((msg) => {
          if (!msg.res) {
            return undefined;
          }
          if (msg.res.code !== 0 || !msg.res.data) {
            throw new Error(msg.res.message || 'Unknown error when reading log slice');
          }
          return msg.res.data;
        }),
      ),
    );
    if (!response) {
      throw new Error('Empty response when reading log slice');
    }
    return response;
  }

  follow(options: FollowOptions) {
    const channelId = encodePath('Deployment', 'RealtimeLog', options.nodeUnit);
    return this.gateway.terminal.channel.subscribeChannel<string>(channelId, options.deploymentId);
  }
}
