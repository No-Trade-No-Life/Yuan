import type { IAgentConf } from '@yuants/agent';
import { runBatchBackTestWorkItem } from './utils';

addEventListener('message', (event) => {
  try {
    const { agentConf } = event.data as { agentConf: IAgentConf };
    runBatchBackTestWorkItem(agentConf).then((x) => postMessage(x));
  } catch (e) {}
});
