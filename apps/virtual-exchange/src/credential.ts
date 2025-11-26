import { getCredentialId } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { ISecret, readSecret, writeSecret } from '@yuants/secret';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime, scopeError } from '@yuants/utils';
import { defer, firstValueFrom, repeat, retry, shareReplay } from 'rxjs';

export interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<IExchangeCredential, void>(
  'VEX/RegisterExchangeCredential',
  {
    type: 'object',
    required: ['type', 'payload'],
    properties: {
      type: { type: 'string' },
      payload: { type: 'object' },
    },
  },
  async (msg) => {
    const credential = msg.req;
    const secretData = new TextEncoder().encode(JSON.stringify(credential));
    await writeSecret(terminal, terminal.keyPair.public_key, { type: 'exchange_credential' }, secretData);
    return { res: { code: 0, message: 'OK' } };
  },
);
terminal.server.provideService<void, IExchangeCredential[]>('VEX/ListExchangeCredential', {}, async () => {
  const secrets = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret where tags->>'type' = 'exchange_credential' and reader = ${escapeSQL(
      terminal.keyPair.public_key,
    )}`,
  );
  const credentials: IExchangeCredential[] = [];
  for (const secret of secrets) {
    try {
      const decrypted = await readSecret(terminal, secret);
      const credential = JSON.parse(new TextDecoder().decode(decrypted));
      credentials.push(credential);
    } catch (e) {
      console.error('Failed to decrypt secret', e);
    }
  }
  return { res: { code: 0, message: 'OK', data: credentials } };
});

terminal.server.provideService<void, string[]>('VEX/ListCredentials', {}, async () => {
  const credentials = await firstValueFrom(validCredentials$);
  return { res: { code: 0, message: 'OK', data: [...credentials.keys()] } };
});

export const listValidCredentials = async () => {
  const credentials = new Map<string, IExchangeCredential>();
  const secrets = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret where tags->>'type' = 'exchange_credential' and reader = ${escapeSQL(
      terminal.keyPair.public_key,
    )}`,
  );
  console.info(formatTime(Date.now()), `Found ${secrets.length} exchange credential secrets`);
  for (const secret of secrets) {
    try {
      const decrypted = await readSecret(terminal, secret);
      const credential = JSON.parse(new TextDecoder().decode(decrypted)) as IExchangeCredential;

      // Call GetCredentialId to get credential id
      const res = await getCredentialId(terminal, credential);

      scopeError('GET_CREDENTIAL_ID_FAILED', { res }, () => {
        const credentialId = res.data;
        if (!credentialId) throw new Error('Credential ID is empty');
        credentials.set(credentialId, credential);
        console.info(formatTime(Date.now()), `Valid credential found: ${credentialId}`);
      });
    } catch (e) {
      console.info(formatTime(Date.now()), 'Failed to process secret', e);
    }
  }
  return credentials;
};

export const validCredentials$ = defer(() => listValidCredentials()).pipe(
  repeat({ delay: 60000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

export const getCredentialById = async (credential_id: string) => {
  const credentials = await firstValueFrom(validCredentials$);
  return credentials.get(credential_id);
};
