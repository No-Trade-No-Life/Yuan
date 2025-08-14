import type { IAgentConf } from '@yuants/agent';
import { currentWorkspaceId$ } from '../FileSystem/workspaces';
import { hostUrl$ } from '../Terminals/create-connection';
import { runBatchBackTestWorkItem } from './utils';

addEventListener('message', (event) => {
  try {
    const { agentConf, hostUrl, workspaceId } = event.data as {
      agentConf: IAgentConf;
      hostUrl: string;
      workspaceId: string;
    };
    currentWorkspaceId$.next(workspaceId || '');
    hostUrl$.next(hostUrl || null);
    runBatchBackTestWorkItem(agentConf).then((x) => postMessage(x));
  } catch (e) {
    console.error('AgentBatchBackTest worker error', e);
  }
});
