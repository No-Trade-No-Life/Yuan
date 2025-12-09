import { createCache } from '@yuants/cache';
import { getCredentialId } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { ISecret, readSecret, writeSecret } from '@yuants/secret';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { newError } from '@yuants/utils';
import { defer, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';

export interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const credentialReader = process.env.NODE_UNIT_PUBLIC_KEY || terminal.keyPair.public_key;

interface ICredentialResolvedStatus {
  secret: ISecret;
  credential?: IExchangeCredential;
  credentialId?: string;
  reason?: string;
}

const credentialIdCache = createCache(async (credentialKey: string) => {
  const credential = JSON.parse(credentialKey) as IExchangeCredential;
  const res = await getCredentialId(terminal, credential);
  return res.data;
});

export const listAllCredentials = async () => {
  const secrets = await requestSQL<ISecret[]>(
    terminal,
    `select * from secret where tags->>'type' = 'exchange_credential' and reader = ${escapeSQL(
      credentialReader,
    )}`,
  );

  const results = secrets.map((secret): ICredentialResolvedStatus => ({ secret }));

  await Promise.all(
    results.map(async (result) => {
      try {
        const decrypted = await readSecret(terminal, result.secret);
        const credential = JSON.parse(new TextDecoder().decode(decrypted)) as IExchangeCredential;
        result.credential = credential;

        const res = await credentialIdCache.query(JSON.stringify(credential));
        if (res) {
          result.credentialId = res;
        }
      } catch (e) {
        result.reason = `${e}`;
      }
    }),
  );

  return results;
};

terminal.server.provideService<IExchangeCredential, ISecret>(
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
    const secret = await writeSecret(terminal, credentialReader, { type: 'exchange_credential' }, secretData);
    return { res: { code: 0, message: 'OK', data: secret } };
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

const credentialCache = createCache(() => listAllCredentials(), { swrAfter: 10_000, expire: 3600_000 });

export const validCredentials$ = defer(() => credentialCache.query('')).pipe(
  map((x) => {
    const map = new Map<string, IExchangeCredential>();
    if (!x) return map;
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

export const validCredentialTypes$ = validCredentials$.pipe(
  map((credentials) => {
    const types = new Set<string>();
    credentials.forEach((credential) => {
      types.add(credential.type);
    });
    return Array.from(types);
  }),
);

export const getCredentialById = async (credential_id: string) => {
  const credentials = await firstValueFrom(validCredentials$);
  return credentials.get(credential_id);
};

export const getCredentialBySecretId = async (
  secret_id: string,
): Promise<Required<Pick<ICredentialResolvedStatus, 'secret' | 'credential' | 'credentialId'>>> => {
  const allCredentials = await credentialCache.query('');
  const theCredential = allCredentials?.find((x) => x.secret.sign === secret_id);
  if (!theCredential) {
    throw newError('CREDENTIAL_NOT_FOUND', { secret_id });
  }
  if (!theCredential.credential) {
    throw newError('CREDENTIAL_NOT_RESOLVED', { secret_id });
  }
  if (!theCredential.credentialId) {
    throw newError('CREDENTIAL_ID_NOT_RESOLVED', { secret_id });
  }

  return {
    secret: theCredential.secret,
    credential: theCredential.credential,
    credentialId: theCredential.credentialId,
  };
};
