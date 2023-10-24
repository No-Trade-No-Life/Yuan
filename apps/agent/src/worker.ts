import { AgentScene } from '@yuants/agent';
import { formatTime } from '@yuants/data-model';
import { BasicUnit, PeriodDataCheckingUnit } from '@yuants/kernel';
import { Terminal } from '@yuants/protocol';
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

  await scene.kernel.start();
};

run();
