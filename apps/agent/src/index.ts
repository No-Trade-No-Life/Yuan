import { IAgentConf, agentConfSchema } from '@yuants/agent';
import { IAccountInfo } from '@yuants/data-model';
import { IPositionDiff, diffPosition } from '@yuants/kernel';
import { PromRegistry, Terminal } from '@yuants/protocol';
import { UUID, formatTime } from '@yuants/utils';
import Ajv from 'ajv';
import fs from 'fs-extra';
import path from 'path';
import {
  Observable,
  combineLatestWith,
  defer,
  delayWhen,
  filter,
  first,
  firstValueFrom,
  from,
  fromEvent,
  map,
  mergeMap,
  repeat,
  tap,
} from 'rxjs';
import { Worker } from 'worker_threads';

const workspaceRoot = path.resolve(process.env.YUAN_WORKSPACE!);
const agentConfFilename = path.join(workspaceRoot, process.env.AGENT_CONF_PATH ?? 'agent_conf.json');
const agentConf: IAgentConf = JSON.parse(fs.readFileSync(agentConfFilename, 'utf-8'));

const validator = new Ajv({ strictSchema: false });
if (!validator.validate(agentConfSchema, agentConf)) {
  console.error(`Agent Config validation failed`, validator.errors);
  process.exit(1);
}
const kernelId = agentConf.kernel_id || UUID();
const TERMINAL_ID = process.env.TERMINAL_ID || `agent/${kernelId}`;

const MetricPositionError = PromRegistry.create(
  'gauge',
  'agent_position_error_volume',
  'Agent Position Error Volume',
);

const MetricBackupWorkerTotal = PromRegistry.create(
  'counter',
  'agent_backup_worker_total',
  'Agent Backup Worker Total',
);

// ISSUE: Terminal ID is Unique in HOST
const nextTerminalID = (() => {
  let currentSuffix: 'yin' | 'yang' = 'yin';
  return (): string => {
    if (currentSuffix === 'yin') {
      currentSuffix = 'yang';
    } else {
      currentSuffix = 'yin';
    }
    return `${TERMINAL_ID}-${currentSuffix}`;
  };
})();

interface IWorkerInstance {
  terminalId: string;
  worker: Worker;
  accountInfo$: Observable<Record<string, IAccountInfo>>;
  errorTotal$: Observable<number>;
}

// Terminal for metrics collecting
const terminal = new Terminal(process.env.HV_URL!, { terminal_id: TERMINAL_ID, name: 'Main Agent Terminal' });

const mapTerminalIdToWorker: Record<string, IWorkerInstance | undefined> = {};

const createWorker = () => {
  const terminalId = nextTerminalID();
  const worker = new Worker('./lib/worker.js', {
    workerData: {
      agent_conf: agentConf,
      terminal_id: terminalId,
    },
  });
  worker.on('exit', () => {
    mapTerminalIdToWorker[terminalId] = undefined;
  });
  const accountInfo$ = fromEvent(worker, 'message').pipe(
    //
    filter((v: any) => v.channel === 'account_info'),
    map((v: any) => v.account_info as Record<string, IAccountInfo>),
  );

  const errorTotal$ = fromEvent(worker, 'message').pipe(
    //
    filter((v: any) => v.channel === 'period_data_checking_error_total'),
    map((v: any) => v.period_data_checking_error_total as number),
  );

  const workerInstance = { terminalId, worker, accountInfo$, errorTotal$ };
  mapTerminalIdToWorker[terminalId] = workerInstance;
  return workerInstance;
};

const alertingSet = new Set<{ account_id: string; product_id: string }>();

// dewit (this is from Palpatine's line in Star Wars, meaning "do it")
const run = async () => {
  let currentMainWorker = createWorker();

  if (agentConf.is_real) {
    console.info(formatTime(Date.now()), 'SelfCheckConfigDetected', 'Start Worker Rotate Process');

    await firstValueFrom(currentMainWorker.accountInfo$);

    defer(() =>
      currentMainWorker.errorTotal$.pipe(
        //
        tap(() => {
          for (const alert of alertingSet) {
            MetricPositionError.set(0, {
              account_id: alert.account_id,
              product_id: alert.product_id,
            });
          }
          alertingSet.clear();
        }),
        first((v) => v > 0),
      ),
    )
      .pipe(
        tap(() => {
          console.info(
            formatTime(Date.now()),
            'WorkerRotateStart',
            'current main Worker terminalId: ',
            currentMainWorker.terminalId,
          );
        }),
        mergeMap(() => {
          const workerInstance = createWorker();
          MetricBackupWorkerTotal.inc({ kernel_id: agentConf.kernel_id! });
          return workerInstance.accountInfo$.pipe(
            combineLatestWith(currentMainWorker.accountInfo$),
            first(),
            delayWhen(([a, b]) => {
              const accountIds = new Set([...Object.keys(a), ...Object.keys(b)]);
              const positionDiff: IPositionDiff[] = [];
              // check all accounts if any of abrupt
              for (const accountId of accountIds) {
                const thePositionDiff = diffPosition(
                  a[accountId]?.positions ?? [],
                  b[accountId]?.positions ?? [],
                );
                positionDiff.push(...thePositionDiff);
                for (const diff of thePositionDiff) {
                  MetricPositionError.set(diff.error_volume, {
                    account_id: accountId,
                    product_id: diff.product_id,
                  });
                  alertingSet.add({ account_id: accountId, product_id: diff.product_id });
                }
              }
              const lastMainWorker = currentMainWorker;
              currentMainWorker = workerInstance;
              console.info(
                formatTime(Date.now()),
                'WorkerRotateEnd',
                'killing previous main worker, new main worker terminalId: ',
                currentMainWorker.terminalId,
                JSON.stringify(positionDiff),
              );
              return from(lastMainWorker.worker.terminate());
            }),
          );
        }),
        repeat(),
      )
      .subscribe();
  }
};

run();
