import { Wallet } from 'ethers';

/**
 * Hyperliquid 凭证接口
 * 仅包含核心数据，行为方法通过辅助函数提供
 */
export interface ICredential {
  private_key: string;
  address: string;
}

/**
 * 获取凭证唯一标识
 */
export const getCredentialId = (credential: ICredential): string =>
  `HYPERLIQUID/${credential.address.toLowerCase()}`;

/**
 * 创建凭证对象
 * @param private_key 私钥
 * @returns 凭证对象
 */
export const createCredential = (private_key: string): ICredential => {
  const wallet = new Wallet(private_key);
  return { private_key, address: wallet.address };
};

/**
 * 获取默认凭证（从环境变量）
 * @returns 默认凭证对象
 */
export const getDefaultCredential = (): ICredential => {
  const private_key = process.env.PRIVATE_KEY;
  if (!private_key) {
    throw new Error('Missing Hyperliquid credential: PRIVATE_KEY must be set');
  }
  return createCredential(private_key);
};
