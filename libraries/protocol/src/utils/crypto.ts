import {
  deriveSharedKey,
  fromPrivateKey,
  generateX25519KeyPair,
  signMessage,
  verifyMessage,
} from '@yuants/utils';
import { from, lastValueFrom } from 'rxjs';
import { Terminal } from '../terminal';

declare module '../services' {
  interface IService {
    HandShake: {
      req: {
        ed25519_public_key: string;
        x25519_public_key: string;
      };
      res: IResponse<{
        x25519_public_key: string;
        signature: string;
      }>;
      frame: void;
    };
  }
}

/**
 * Setup HandShake service
 * @param terminal - terminal
 * @param private_key - ED25519 private key (base58)
 * @returns map of X25519 public key to shared key
 * @public
 */
export const setupHandShakeService = (terminal: Terminal, private_key: string) => {
  const pair = fromPrivateKey(private_key);
  const public_key = pair.public_key;

  const mapX25519PublicKeyToSharedKey = new Map<string, string>();

  terminal.provideService(
    'HandShake',
    {
      type: 'object',
      required: ['ed25519_public_key', 'x25519_public_key'],
      properties: {
        ed25519_public_key: { type: 'string', const: public_key },
        x25519_public_key: { type: 'string' },
      },
    },
    async (msg) => {
      const { x25519_public_key } = msg.req;
      const myPair = generateX25519KeyPair();

      const sharedKey = deriveSharedKey(x25519_public_key, myPair.private_key);
      mapX25519PublicKeyToSharedKey.set(x25519_public_key, sharedKey);

      const message = `${x25519_public_key}${myPair.public_key}`;
      return {
        res: {
          code: 0,
          message: 'OK',
          data: { x25519_public_key: myPair.public_key, signature: signMessage(message, private_key) },
        },
      };
    },
  );
  return mapX25519PublicKeyToSharedKey;
};

/**
 * Request shared key
 * @param terminal - terminal
 * @param ed25519_public_key - ed25519 public key (base58)
 * @returns AES-GCM shared key (base58)
 * @public
 */
export const requestSharedKey = async (terminal: Terminal, ed25519_public_key: string): Promise<string> => {
  const myPair = generateX25519KeyPair();
  const res = await lastValueFrom(
    from(
      terminal.requestService('HandShake', {
        ed25519_public_key,
        x25519_public_key: myPair.public_key,
      }),
    ),
  );
  const data = res.res?.data;
  if (!data) {
    throw new Error('Failed to get shared key');
  }
  if (!verifyMessage(`${myPair.public_key}${data.x25519_public_key}`, data.signature, ed25519_public_key)) {
    throw new Error('Invalid signature');
  }
  return deriveSharedKey(data.x25519_public_key, myPair.private_key);
};
