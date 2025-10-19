import {
  deriveSharedKey,
  encodePath,
  generateX25519KeyPair,
  signMessage,
  verifyMessage,
} from '@yuants/utils';
import { Terminal } from './terminal';

/**
 * Terminal Security Module
 *
 * @public
 */
export class TerminalSecurity {
  /**
   * 保存远程生成的 X25519 公钥到共享密钥的映射
   */
  mapX25519PublicKeyToSharedKey = new Map<string, string>();

  constructor(public readonly terminal: Terminal) {
    terminal.server.provideService<
      {
        x25519_public_key: string;
      },
      {
        x25519_public_key: string;
        signature: string;
      }
    >(
      encodePath('HandShake', terminal.keyPair.public_key),
      {
        type: 'object',
        required: ['x25519_public_key'],
        properties: {
          x25519_public_key: { type: 'string' },
        },
      },
      async ({ req: { x25519_public_key } }) => {
        const localKeyPair = generateX25519KeyPair();

        const sharedKey = deriveSharedKey(x25519_public_key, localKeyPair.private_key);
        this.mapX25519PublicKeyToSharedKey.set(x25519_public_key, sharedKey);

        const message = `${x25519_public_key}${localKeyPair.public_key}`;

        return {
          res: {
            code: 0,
            message: 'OK',
            data: {
              x25519_public_key: localKeyPair.public_key,
              signature: signMessage(message, terminal.keyPair.private_key),
            },
          },
        };
      },
    );
  }

  async requestSharedKey(ed25519_public_key: string) {
    const myPair = generateX25519KeyPair();

    const data = await this.terminal.client.requestForResponseData<
      {
        x25519_public_key: string;
      },
      {
        x25519_public_key: string;
        signature: string;
      }
    >(encodePath('HandShake', ed25519_public_key), {
      x25519_public_key: myPair.public_key,
    });

    if (!verifyMessage(`${myPair.public_key}${data.x25519_public_key}`, data.signature, ed25519_public_key)) {
      throw new Error('Invalid signature');
    }

    const shared_key = deriveSharedKey(data.x25519_public_key, myPair.private_key);

    return {
      /**
       * Local X25519 public key (base58)
       */
      public_key: myPair.public_key,
      /**
       * Local X25519 private key (base58)
       */
      private_key: myPair.private_key,
      /**
       * Remote X25519 public key (base58)
       */
      remote_public_key: data.x25519_public_key,
      /**
       * AES-GCM shared key (base58)
       */
      shared_key: shared_key,
    };
  }
}
