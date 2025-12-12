import { createCache } from '@yuants/cache';
import { getCredentialId } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { ISecret, listSecrets, readSecret, writeSecret } from '@yuants/secret';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { newError } from '@yuants/utils';
import { defer, firstValueFrom, map, repeat, retry, shareReplay } from 'rxjs';

interface IExchangeCredential {
  type: string;
  payload: any;
}

const terminal = Terminal.fromNodeEnv();

const credentialReader = process.env.NODE_UNIT_PUBLIC_KEY || terminal.keyPair.public_key;

/**
 * 根据 secret sign 解析出对应的 exchange credential
 * 此处可以做缓存，因为同一个 secret sign 对应的 credential 信息永远不会变化，可以节约解密和后续 SQL 查询的开销
 * 得到 credential 后，此 credential 不一定是有效的，因为可能凭证信息已经过期或被撤销
 */
const secretSignToCredentialIdCache = createCache(async (sign: string) => {
  const sql = `SELECT * FROM secret WHERE sign = ${escapeSQL(sign)} LIMIT 1;`;
  const res = await requestSQL<ISecret[]>(terminal, sql);
  if (res.length === 0) throw newError('SECRET_NOT_FOUND', { sign });
  const secret = res[0];
  const decrypted = await readSecret(terminal, secret);
  const credential = JSON.parse(new TextDecoder().decode(decrypted)) as IExchangeCredential;
  return credential;
});

/**
 * 根据 credential 信息解析出对应的 credential ID
 * 此处可以做缓存，因为同一个 credential 永远对应同一个 credential ID，可以节约后续 SQL 查询的开销
 * 但是需要注意的是，credential ID 可能会因为凭证被撤销而失效，但是可以在下游调用其他服务时感知到，因此可以永久缓存
 */
const credentialIdCache = createCache(async (credentialKey: string) => {
  const credential = JSON.parse(credentialKey) as IExchangeCredential;
  const res = await getCredentialId(terminal, credential);
  return res.data;
});

const listAllCredentials = async () => {
  const secrets = await listSecrets(terminal, {
    reader: credentialReader,
    tags: { type: 'exchange_credential' },
  });

  return Promise.allSettled(secrets.map((secret) => getCredentialBySecretId(secret.sign)));
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

// For Debugging Purpose
terminal.server.provideService('VEX/ListExchangeCredential', {}, async () => {
  return { res: { code: 0, message: 'OK', data: await listAllCredentials() } };
});

terminal.server.provideService<void, string[]>('VEX/ListCredentials', {}, async () => {
  const credentials = await firstValueFrom(validCredentials$);
  return { res: { code: 0, message: 'OK', data: [...credentials.keys()] } };
});

export const validCredentials$ = defer(() => listAllCredentials()).pipe(
  map((x) => {
    const map = new Map<string, IExchangeCredential>();
    if (!x) return map;
    for (const xx of x) {
      if (xx.status !== 'fulfilled') continue;
      if (xx.value.credentialId && xx.value.credential) {
        map.set(xx.value.credentialId, xx.value.credential);
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

/**
 * 根据 secret sign 解析出对应的 credential 以及 credential ID
 * @param sign - secret sign
 * @returns 解析得到的 credential 以及对应的 credential ID
 * @throws 如果无法解析出对应的 credential 或 credential ID，则抛出异常
 *
 * 不依赖 List Credential 服务，可以及时感知凭证的新增和变更
 */
export const getCredentialBySecretId = async (sign: string) => {
  const credential = await secretSignToCredentialIdCache.query(sign);
  if (!credential) throw newError('CREDENTIAL_NOT_RESOLVED', { sign });
  const credentialId = await credentialIdCache.query(JSON.stringify(credential));
  if (!credentialId) throw newError('CREDENTIAL_ID_NOT_RESOLVED', { sign });
  return { sign, credential, credentialId };
};
