import { getCredentialId } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { ISecret, readSecret, writeSecret } from '@yuants/secret';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { defer, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';

export interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

interface ICredentialResolvedStatus {
  secret: ISecret;
  credential?: IExchangeCredential;
  credentialId?: string;
  reason?: string;
}

export const listAllCredentials = async () => {
  const secrets = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret where tags->>'type' = 'exchange_credential' and reader = ${escapeSQL(
      terminal.keyPair.public_key,
    )}`,
  );

  const results = secrets.map((secret): ICredentialResolvedStatus => ({ secret }));

  await Promise.all(
    results.map(async (result) => {
      try {
        const decrypted = await readSecret(terminal, result.secret);
        const credential = JSON.parse(new TextDecoder().decode(decrypted)) as IExchangeCredential;
        result.credential = credential;

        const res = await getCredentialId(terminal, credential);
        const credentialId = res.data;
        result.credentialId = credentialId;
      } catch (e) {
        result.reason = `${e}`;
      }
    }),
  );

  return results;
};

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

terminal.server.provideService<void, ICredentialResolvedStatus[]>(
  'VEX/ListExchangeCredential',
  {},
  async () => {
    return { res: { code: 0, message: 'OK', data: await listAllCredentials() } };
  },
);

terminal.server.provideService<void, string[]>('VEX/ListCredentials', {}, async () => {
  const credentials = await firstValueFrom(validCredentials$);
  return { res: { code: 0, message: 'OK', data: [...credentials.keys()] } };
});

export const validCredentials$ = defer(() => listAllCredentials()).pipe(
  map((x) => {
    const map = new Map<string, IExchangeCredential>();
    for (const xx of x) {
      if (xx.credentialId && xx.credential) {
        map.set(xx.credentialId, xx.credential);
      }
    }
    return map;
  }),
  repeat({ delay: 10000 }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

export const getCredentialById = async (credential_id: string) => {
  const credentials = await firstValueFrom(validCredentials$);
  return credentials.get(credential_id);
};
