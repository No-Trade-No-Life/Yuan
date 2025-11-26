import { encode } from '@msgpack/msgpack';
import { keccak256, Wallet } from 'ethers';

interface PhantomAgent {
  source: string;
  connectionId: string;
}

interface L1Payload {
  domain: {
    chainId: number;
    name: string;
    verifyingContract: string;
    version: string;
  };
  types: {
    Agent: Array<{ name: string; type: string }>;
    EIP712Domain: Array<{ name: string; type: string }>;
  };
  primaryType: string;
  message: PhantomAgent;
}

interface Signature {
  r: string;
  s: string;
  v: number;
}

function addressToBytes(address: string): Uint8Array {
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  return new Uint8Array(Buffer.from(cleanAddress, 'hex'));
}

function actionHash(
  action: any,
  vaultAddress: string | null,
  nonce: number,
  expiresAfter: number | null,
): string {
  let data: any = new Uint8Array(encode(action));

  const nonceBytes = new Uint8Array(8);
  const nonceView = new DataView(nonceBytes.buffer);
  nonceView.setBigUint64(0, BigInt(nonce), false); // false = big endian
  data = concatUint8Arrays(data, nonceBytes);

  if (vaultAddress == null) {
    data = concatUint8Arrays(data, new Uint8Array([0x00]));
  } else {
    data = concatUint8Arrays(data, new Uint8Array([0x01]));
    data = concatUint8Arrays(data, addressToBytes(vaultAddress));
  }
  if (expiresAfter != null) {
    data = concatUint8Arrays(data, new Uint8Array([0x00]));
    const expiresBytes = new Uint8Array(8);
    const expiresView = new DataView(expiresBytes.buffer);
    expiresView.setBigUint64(0, BigInt(expiresAfter), false); // false = big endian
    data = concatUint8Arrays(data, expiresBytes);
  }

  return keccak256(data);
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }

  return result;
}

function constructPhantomAgent(hash: string, isMainnet: boolean): PhantomAgent {
  return {
    source: isMainnet ? 'a' : 'b',
    connectionId: hash,
  };
}

function l1Payload(phantomAgent: PhantomAgent): L1Payload {
  return {
    domain: {
      chainId: 1337,
      name: 'Exchange',
      verifyingContract: '0x0000000000000000000000000000000000000000',
      version: '1',
    },
    types: {
      Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' },
      ],
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
    },
    primaryType: 'Agent',
    message: phantomAgent,
  };
}

async function signInner(wallet: Wallet, data: L1Payload): Promise<Signature> {
  const signature = await wallet.signTypedData(data.domain, { Agent: data.types.Agent }, data.message);

  const r = signature.slice(0, 66);
  const s = '0x' + signature.slice(66, 130);
  const v = parseInt(signature.slice(130, 132), 16);

  return { r, s, v };
}

/**
 * 签署 L1 动作
 *
 * @param wallet - 以太坊钱包实例
 * @param action - 要签署的动作数据
 * @param activePool - 活跃池地址（可以为 null）
 * @param nonce - 随机数
 * @param expiresAfter - 过期时间（可以为 null）
 * @param isMainnet - 是否为主网
 * @returns 签名对象
 */
export async function signL1Action(
  wallet: Wallet,
  action: any,
  activePool: string | null,
  nonce: number,
  expiresAfter: number | null,
  isMainnet: boolean,
): Promise<Signature> {
  const hash = actionHash(action, activePool, nonce, expiresAfter);
  const phantomAgent = constructPhantomAgent(hash, isMainnet);
  const data = l1Payload(phantomAgent);
  return await signInner(wallet, data);
}

export { actionHash, addressToBytes, constructPhantomAgent, l1Payload };
