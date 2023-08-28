import { IAgentConf, agentConfSchema } from '@yuants/agent';
import { diffPosition } from '@yuants/kernel';
import { IAccountInfo, PromRegistry, Terminal, mergeAccountInfoPositions } from '@yuants/protocol';
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
  timer,
} from 'rxjs';
import { v4 } from 'uuid';
import { Worker } from 'worker_threads';

const workspaceRoot = path.resolve(process.env.YUAN_WORKSPACE!);
const agentConfFilename = path.join(workspaceRoot, process.env.AGENT_CONF_PATH ?? 'agent_conf.json');
const agentConf: IAgentConf = JSON.parse(fs.readFileSync(agentConfFilename, 'utf-8'));

const validator = new Ajv({ strictSchema: false });
if (!validator.validate(agentConfSchema, agentConf)) {
  console.error(`Agent Config validation failed`, validator.errors);
  process.exit(1);
}
const accountId = agentConf.account_id || v4();
const TERMINAL_ID = process.env.TERMINAL_ID || `agent/${accountId}`;

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
  accountInfo$: Observable<IAccountInfo>;
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
    map((v: any) => v.account_info as IAccountInfo),
    mergeMap((accountInfo) => mergeAccountInfoPositions(accountInfo)),
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

const run = async () => {
  let currentMainWorker = createWorker();

  if (agentConf.period_self_check_interval_in_second) {
    const interval = agentConf.period_self_check_interval_in_second * 1000;

    console.info(new Date(), 'SelfCheckConfigDetected', 'Start Worker Rotate Process, interval: ', interval);

    await firstValueFrom(currentMainWorker.accountInfo$);

    defer(() => timer(interval))
      .pipe(
        //
        delayWhen(() =>
          currentMainWorker.errorTotal$.pipe(
            //
            first((v) => v > 0),
          ),
        ),
        tap(() => {
          console.info(
            new Date(),
            'WorkerRotateStart',
            'current main Worker terminalId: ',
            currentMainWorker.terminalId,
          );
        }),
        mergeMap(() => {
          const workerInstance = createWorker();
          MetricBackupWorkerTotal.inc({ account_id: agentConf.account_id! });
          return workerInstance.accountInfo$.pipe(
            combineLatestWith(currentMainWorker.accountInfo$),
            first(),
            delayWhen(([a, b]) => {
              const positionDiff = diffPosition(a.positions, b.positions);
              for (const diff of positionDiff) {
                MetricPositionError.set(diff.error_volume, {
                  account_id: agentConf.account_id!,
                  product_id: diff.product_id,
                });
              }
              const lastMainWorker = currentMainWorker;
              currentMainWorker = workerInstance;
              console.info(
                new Date(),
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
