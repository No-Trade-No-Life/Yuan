import { createCache } from '@yuants/cache';
import {
  decrypt,
  deriveSharedKey,
  encodePath,
  encrypt,
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
   * 保存远程 ED25519 公钥到共享密钥的映射
   */
  sharedKeyCache = createCache<string>((remote_public_key) => this.requestSharedKey(remote_public_key));

  constructor(public readonly terminal: Terminal) {
    setTimeout(() => this._setupHandShakeService());
  }

  private _setupHandShakeService() {
    this.terminal.server.provideService<
      {
        public_key: string;
        signature: string;
        x25519_public_key: string;
      },
      {
        x25519_public_key: string;
        signature: string;
      }
    >(
      encodePath('HandShake', this.terminal.keyPair.public_key),
      {
        type: 'object',
        required: ['x25519_public_key'],
        properties: {
          x25519_public_key: { type: 'string' },
        },
      },
      async ({ req: { x25519_public_key, public_key, signature } }) => {
        if (!verifyMessage(x25519_public_key, signature, public_key)) {
          throw new Error('Invalid signature');
        }

        const localKeyPair = generateX25519KeyPair();

        const sharedKey = deriveSharedKey(x25519_public_key, localKeyPair.private_key);

        this.sharedKeyCache.set(public_key, sharedKey);

        const message = `${x25519_public_key}${localKeyPair.public_key}`;

        return {
          res: {
            code: 0,
            message: 'OK',
            data: {
              x25519_public_key: localKeyPair.public_key,
              signature: signMessage(message, this.terminal.keyPair.private_key),
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
        public_key: string;
        signature: string;
        x25519_public_key: string;
      },
      {
        x25519_public_key: string;
        signature: string;
      }
    >(encodePath('HandShake', ed25519_public_key), {
      x25519_public_key: myPair.public_key,
      public_key: this.terminal.keyPair.public_key,
      signature: signMessage(myPair.public_key, this.terminal.keyPair.private_key),
    });

    if (!verifyMessage(`${myPair.public_key}${data.x25519_public_key}`, data.signature, ed25519_public_key)) {
      throw new Error('Invalid signature');
    }

    const shared_key = deriveSharedKey(data.x25519_public_key, myPair.private_key);

    return shared_key;
  }

  /**
   * Decrypt data with remote ED25519 public key
   *
   * @param remote_public_key - remote ED25519 public key
   * @param encrypted_data - encrypted data (Uint8Array)
   * @returns - decrypted data (Uint8Array)
   *
   * @public
   */
  async decryptDataWithRemotePublicKey(
    encrypted_data: Uint8Array,
    remote_public_key: string,
  ): Promise<Uint8Array> {
    // 数据已经加密，说明交换过共享密钥
    try {
      // 乐观估计密钥有效
      const shared_key = this.sharedKeyCache.get(remote_public_key);
      if (!shared_key) throw new Error(`LocalSharedKeyNotFound: remote_public_key=${remote_public_key}`);
      return decrypt(encrypted_data, shared_key);
    } catch (err) {
      // 可能是密钥无效，重新请求共享密钥 (不阻塞，不抛异常)
      this.sharedKeyCache.query(remote_public_key, true);
      throw err;
    }
  }

  /**
   * Encrypt data with remote public key
   * @param data - Data to encrypt
   * @param remote_public_key - Remote public key
   * @returns - Encrypted data (Uint8Array)
   *
   * @public
   */
  async encryptDataWithRemotePublicKey(data: Uint8Array, remote_public_key: string): Promise<Uint8Array> {
    const shared_key = await this.sharedKeyCache.query(remote_public_key, false);
    if (!shared_key) throw new Error(`RemoteSharedKeyNotFound: remote_public_key=${remote_public_key}`);
    return encrypt(data, shared_key);
  }
}
