import { AgentScene } from '@yuants/agent';
import { BasicUnit, PeriodDataCheckingUnit } from '@yuants/kernel';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { of } from 'rxjs';
import { parentPort, workerData } from 'worker_threads';

const { agent_conf, terminal_id } = workerData;
const terminal = new Terminal(process.env.HV_URL!, { terminal_id, name: 'Agent Worker' });

console.info(formatTime(Date.now()), 'Agent CLI App', terminal.terminalInfo.terminal_id, 'started');

const run = async () => {
  const scene = await AgentScene(terminal, agent_conf);
  new BasicUnit(scene.kernel).onIdle = () => {
    terminal.terminalInfo.status = 'OK';
    // postCurrentAccountInfo();
    parentPort?.postMessage({
      channel: 'account_info',
      account_info: Object.fromEntries(scene.accountInfoUnit.mapAccountIdToAccountInfo.entries()),
    });
    const periodDataCheckingUnit = scene.kernel.units.find((v) => v instanceof PeriodDataCheckingUnit);
    if (periodDataCheckingUnit) {
      parentPort?.postMessage({
        channel: 'period_data_checking_error_total',
        period_data_checking_error_total: (periodDataCheckingUnit as PeriodDataCheckingUnit).errorTotal,
      });
    }
  };

  terminal.provideService(
    'KernelDump',
    {
      required: ['kernel_id'],
      properties: {
        kernel_id: { const: scene.kernel.id },
      },
    },
    () => of({ res: { code: 0, message: 'OK', data: scene.kernel.dump() } }),
  );

  terminal.provideService(
    'KernelRestore',
    {
      required: ['kernel_id'],
      properties: {
        kernel_id: { const: scene.kernel.id },
      },
    },
    (msg) => {
      scene.kernel.terminate();
      scene.kernel.restore((msg.req as any)!.data);
      scene.kernel.start();
      return of({ res: { code: 0, message: 'OK' } });
    },
  );

  await scene.kernel.start();
};

run();
