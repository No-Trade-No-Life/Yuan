import { AgentScene, IAgentConf } from '@yuants/agent';
import { Terminal } from '@yuants/protocol';
import { loadSecrets } from '@yuants/secret';
import { defer, of } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

defer(async () => {
  const secret_code_id = process.env.SECRET_CODE_ID!;
  const private_key = process.env.PRIVATE_KEY!;
  const agent_params = JSON.parse(process.env.AGENT_PARAMS!);
  const start_time = process.env.STARTED_AT!;
  const kernel_id = process.env.KERNEL_ID!;

  const secrets = await loadSecrets<{ bundled_code: string }>({
    terminal,
    encryption_key_base58: private_key,
    id: secret_code_id,
  });

  const theSecret = secrets.find((x) => x.decrypted_data)?.decrypted_data;

  if (!theSecret) {
    throw new Error(`Failed to load secret ${secret_code_id}: ${secrets[0].err}`);
  }

  const agent_conf: IAgentConf = {
    bundled_code: theSecret.bundled_code,
    agent_params: agent_params,
    start_time: start_time,
    kernel_id: kernel_id,
    is_real: true,
  };

  const scene = await AgentScene(terminal, agent_conf);

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
}).subscribe();
