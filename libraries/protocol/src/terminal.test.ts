import { formatTime } from '@yuants/data-model';
import { lastValueFrom, map, mergeMap, range, tap, timer } from 'rxjs';
import { Terminal } from './terminal';

const HV_URL = process.env.HV_URL;
jest.setTimeout(120_000);

describe('terminal', () => {
  it('should keepalive queued requests', async () => {
    if (!HV_URL) {
      return;
    }
    const client = new Terminal(HV_URL, {
      name: 'ut/client',
      terminal_id: 'ut/client',
    });

    const server = new Terminal(HV_URL, {
      name: 'ut/server',
      terminal_id: 'ut/server',
    });

    server.provideService(
      'test',
      {},
      () => {
        return timer(5000).pipe(
          //
          tap(() => {
            console.info(formatTime(Date.now()), 'server: test');
          }),
          map(() => ({ res: { code: 0, message: 'OK' } })),
        );
      },
      { concurrent: 1 },
    );

    // all 10 requests should be response without error
    await lastValueFrom(
      range(0, 10).pipe(
        //
        mergeMap(() => client.request('test', 'ut/server', {})),
      ),
    );
  });
});
