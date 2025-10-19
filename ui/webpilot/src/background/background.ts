import { setupHandShakeService, Terminal } from '@yuants/protocol';
import {
  decodeBase64,
  decodePath,
  decrypt,
  encodeBase64,
  encodePath,
  encrypt,
  formatTime,
  fromPrivateKey,
  listWatch,
  verifyMessage,
} from '@yuants/utils';
import { concatMap, defer, map, Observable, repeat, retry, share } from 'rxjs';
import { getConfig } from '../storage/storage.js';

// 初始化后台脚本
chrome.runtime.onInstalled.addListener(() => {
  console.log('WebPilot installed');
});

defer(() => getConfig())
  .pipe(
    retry({ delay: 5000 }),
    repeat({ delay: 5000 }),
    map((config) => [config]),
    listWatch(
      (config) => encodePath(config.hostUrl, config.privateKey),
      (config) =>
        new Observable((sub) => {
          console.info(formatTime(Date.now()), 'Applying new config in background script', config);
          if (!config.hostUrl) {
            console.warn('No hostUrl configured, skipping setup');
            return;
          }
          const url = new URL(config.hostUrl);
          const trusted_public_key = url.searchParams.get('trusted_public_key') || '';
          if (!trusted_public_key) {
            console.warn('No trusted_public_key found in hostUrl, skipping setup');
            return;
          }

          const keyPair = fromPrivateKey(config.privateKey);
          const terminal = new Terminal(config.hostUrl, {
            terminal_id: `WebPilot/${keyPair.public_key}`,
            name: 'WebPilot Extension Background Script',
          });

          const mapX25519PublicKeyToSharedKey = setupHandShakeService(terminal, keyPair.private_key);

          Object.assign(globalThis, { mapX25519PublicKeyToSharedKey });

          let ack_seq_id = '';

          terminal.server.provideService<
            {
              public_key: string;
              seq_id: string;
              signature: string;
              x25519_public_key: string;
            },
            string
          >(
            'ListTabs',
            {
              type: 'object',
              required: ['public_key', 'seq_id', 'signature', 'x25519_public_key'],
              properties: {
                public_key: { type: 'string', const: keyPair.public_key },
                x25519_public_key: { type: 'string' },
                seq_id: { type: 'string' },
                signature: { type: 'string' },
              },
            },
            async ({ req }) => {
              const shared_key = mapX25519PublicKeyToSharedKey.get(req.x25519_public_key);

              if (!shared_key) {
                return {
                  res: {
                    code: 400,
                    message: 'No shared key found for the provided x25519_public_key',
                  },
                };
              }

              const t1 = Date.now();
              // 验证请求签名
              const isValid = verifyMessage(req.seq_id, req.signature, trusted_public_key);
              if (!isValid) {
                return {
                  res: {
                    code: 400,
                    message: 'Invalid signature',
                  },
                };
              }

              // 新请求的 seq_id 必须大于上次处理的 ack_seq_id
              if (ack_seq_id && req.seq_id <= ack_seq_id) {
                return {
                  res: {
                    code: 400,
                    message: 'seq_id must be greater than previous ack_seq_id',
                  },
                };
              }
              ack_seq_id = req.seq_id;

              const t2 = Date.now();
              const tabs = await chrome.tabs.query({});
              const data = new TextEncoder().encode(JSON.stringify(tabs));
              const t3 = Date.now();
              const _t = await encrypt(data, shared_key);
              const t4 = Date.now();
              const encrypted_data = encodeBase64(_t);

              const t5 = Date.now();

              console.info(
                formatTime(Date.now()),
                'ListTabs processed',
                `timing: verifySig=${t2 - t1}ms, queryTabs=${t3 - t2}ms, encrypt=${t4 - t3}ms, encodeBase64=${
                  t5 - t4
                }ms`,
              );

              return {
                res: {
                  code: 0,
                  message: 'OK',
                  data: encrypted_data,
                },
              };
            },
          );

          const userScriptsAPI = (chrome as any).userScripts;

          terminal.server.provideService<
            {
              public_key: string;
              x25519_public_key: string;
              signature: string;
              encrypted_data: string;
              seq_id: string;
            },
            any
          >(
            'ExecuteUserScript',
            {
              type: 'object',
              required: ['public_key', 'encrypted_data', 'seq_id', 'signature', 'x25519_public_key'],
              properties: {
                public_key: { type: 'string', const: keyPair.public_key },
                x25519_public_key: { type: 'string' },
                seq_id: { type: 'string' },
                signature: { type: 'string' },
                encrypted_data: { type: 'string' },
              },
            },
            async ({ req }) => {
              const shared_key = mapX25519PublicKeyToSharedKey.get(req.x25519_public_key);

              if (!shared_key) {
                return {
                  res: {
                    code: 400,
                    message: 'No shared key found for the provided x25519_public_key',
                  },
                };
              }

              // 验证请求签名
              const isValid = verifyMessage(req.seq_id, req.signature, trusted_public_key);
              if (!isValid) {
                return {
                  res: {
                    code: 400,
                    message: 'Invalid signature',
                  },
                };
              }

              // 新请求的 seq_id 必须大于上次处理的 ack_seq_id
              if (ack_seq_id && req.seq_id <= ack_seq_id) {
                return {
                  res: {
                    code: 400,
                    message: 'seq_id must be greater than previous ack_seq_id',
                  },
                };
              }
              ack_seq_id = req.seq_id;

              const decrypted = await decrypt(decodeBase64(req.encrypted_data), shared_key);

              if (!decrypted) {
                return {
                  res: {
                    code: 400,
                    message: 'Decryption failed',
                  },
                };
              }

              const execReq = JSON.parse(new TextDecoder().decode(decrypted)) as {
                tabId: number;
                script: string;
              };

              const ret = await userScriptsAPI.execute({
                target: { tabId: execReq.tabId },
                js: [{ code: execReq.script }],
              });

              const data = encodeBase64(
                await encrypt(new TextEncoder().encode(JSON.stringify(ret)), shared_key),
              );

              return { res: { code: 0, message: 'OK', data: data } };
            },
          );

          const network$ = new Observable((sub) => {
            const cbForRequest = (details: chrome.webRequest.WebRequestBodyDetails) => {
              sub.next({ type: 'request', payload: details });
            };
            chrome.webRequest.onBeforeRequest.addListener(cbForRequest, { urls: ['<all_urls>'] });
            sub.add(() => {
              chrome.webRequest.onBeforeRequest.removeListener(cbForRequest);
            });

            const cbForResponse = (details: chrome.webRequest.WebResponseDetails) => {
              sub.next({ type: 'response', payload: details });
            };
            chrome.webRequest.onCompleted.addListener(cbForResponse, { urls: ['<all_urls>'] });
            sub.add(() => {
              chrome.webRequest.onCompleted.removeListener(cbForResponse);
            });

            const cbForRequestHeader = (details: chrome.webRequest.WebRequestHeadersDetails) => {
              console.info('Request Headers:', details);
              sub.next({ type: 'requestHeaders', payload: details });
            };
            chrome.webRequest.onBeforeSendHeaders.addListener(
              cbForRequestHeader,
              {
                urls: ['<all_urls>'],
              },
              ['requestHeaders', 'extraHeaders'],
            );
            sub.add(() => {
              chrome.webRequest.onBeforeSendHeaders.removeListener(cbForRequestHeader);
            });

            const cbForResponseHeader = (details: chrome.webRequest.WebResponseHeadersDetails) => {
              sub.next({ type: 'responseHeaders', payload: details });
            };
            chrome.webRequest.onHeadersReceived.addListener(
              cbForResponseHeader,
              {
                urls: ['<all_urls>'],
              },
              ['responseHeaders', 'extraHeaders'],
            );
            sub.add(() => {
              chrome.webRequest.onHeadersReceived.removeListener(cbForResponseHeader);
            });
          }).pipe(
            //
            map((event) => new TextEncoder().encode(JSON.stringify(event))),
            share({ resetOnRefCountZero: true }),
          );

          terminal.channel.publishChannel(
            encodePath('NetworkEvents', keyPair.public_key),
            {},
            (channelId) => {
              const [x25519_public_key, signature] = decodePath(channelId);

              if (!x25519_public_key) {
                throw new Error('No x25519_public_key provided in channelId[1]');
              }

              if (!signature) {
                throw new Error('No signature provided in channelId[2]');
              }

              // 验证 signature
              const isValid = verifyMessage(x25519_public_key, signature, trusted_public_key);
              if (!isValid) {
                throw new Error('Invalid signature for channel subscription');
              }

              const shared_key = mapX25519PublicKeyToSharedKey.get(x25519_public_key);
              if (!shared_key) {
                throw new Error('No shared key found for the provided x25519_public_key');
              }
              return network$.pipe(concatMap(async (data) => encodeBase64(await encrypt(data, shared_key))));
            },
          );

          sub.add(() => {
            terminal.dispose();
          });
        }),
    ),
  )
  .subscribe();

console.log('WebPilot background script loaded');
