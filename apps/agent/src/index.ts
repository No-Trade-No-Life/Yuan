import { AgentScene, IAgentConf } from '@yuants/agent';
import { Terminal } from '@yuants/protocol';
import { ISecret, readSecret } from '@yuants/secret';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { newError } from '@yuants/utils';
import { defer, of } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

defer(async () => {
  const code_secret_id = process.env.CODE_SECRET_ID;
  if (!code_secret_id) throw newError(`CODE_SECRET_ID_NOT_SET`, { terminal_id: terminal.terminal_id });
  const agent_params = JSON.parse(process.env.AGENT_PARAMS!);
  const start_time = process.env.STARTED_AT!;
  const kernel_id = process.env.KERNEL_ID!;

  const [secret] = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret where sign = ${escapeSQL(code_secret_id)}`,
  );

  const decrypted_data = await readSecret(terminal, secret);
  const code = new TextDecoder().decode(decrypted_data);

  const agent_conf: IAgentConf = {
    bundled_code: code,
    agent_params: agent_params,
    start_time: start_time,
    kernel_id: kernel_id,
    is_real: true,
  };

  const scene = await AgentScene(terminal, agent_conf);

  terminal.server.provideService(
    'KernelDump',
    {
      required: ['kernel_id'],
      properties: {
        kernel_id: { const: scene.kernel.id },
      },
    },
    () => of({ res: { code: 0, message: 'OK', data: scene.kernel.dump() } }),
  );

  terminal.server.provideService(
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
