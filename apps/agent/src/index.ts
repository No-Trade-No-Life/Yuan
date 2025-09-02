import { AgentScene, IAgentConf } from '@yuants/agent';
import { Terminal } from '@yuants/protocol';
import { ISecret } from '@yuants/secret';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodeBase58, decryptByPrivateKey, fromPrivateKey } from '@yuants/utils';
import { defer, of } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

defer(async () => {
  const secret_code_id = process.env.SECRET_CODE_ID;
  if (!secret_code_id) throw new Error(`SECRET_CODE_ID is not set`);
  const PRIVATE_KEY = process.env.DEPLOYMENT_PRIVATE_KEY;
  if (!PRIVATE_KEY) throw new Error(`DEPLOYMENT_PRIVATE_KEY is not set`);
  const DEPLOYMENT_NODE_UNIT_ADDRESS = process.env.DEPLOYMENT_NODE_UNIT_ADDRESS;
  if (!DEPLOYMENT_NODE_UNIT_ADDRESS) throw new Error(`DEPLOYMENT_NODE_UNIT_ADDRESS is not set`);
  const keyPair = fromPrivateKey(PRIVATE_KEY);
  const agent_params = JSON.parse(process.env.AGENT_PARAMS!);
  const start_time = process.env.STARTED_AT!;
  const kernel_id = process.env.KERNEL_ID!;

  const secrets = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret where id = ${escapeSQL(secret_code_id)}`,
  );

  const theSecret = secrets[0];

  if (!theSecret) {
    throw new Error(`Failed to load secret ${secret_code_id}`);
  }

  const res = await terminal.client.requestForResponse('NodeUnit/DecryptForChild', {
    node_unit_address: DEPLOYMENT_NODE_UNIT_ADDRESS,
    encrypted_data_base58: theSecret.encrypted_data_base58,
    child_public_key: keyPair.public_key,
  });

  const resData = res.data as { data: string };
  if (!resData) throw new Error(`Failed to decrypt secret ${secret_code_id}`);
  const decrypted_data_base58 = decryptByPrivateKey(decodeBase58(resData.data), PRIVATE_KEY);
  const code = new TextDecoder().decode(decrypted_data_base58);

  const agent_conf: IAgentConf = {
    bundled_code: code,
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
