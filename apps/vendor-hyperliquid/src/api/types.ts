import { Wallet } from 'ethers';

/**
 * Hyperliquid 凭证接口
 * 仅包含核心数据，行为方法通过辅助函数提供
 */
export interface ICredential {
  private_key: string;
}

/**
 * 从凭证获取地址
 * @param credential 凭证对象
 * @returns 钱包地址
 */
export const getAddressFromCredential = (credential: ICredential): string => {
  const wallet = new Wallet(credential.private_key);
  return wallet.address;
};

/**
 * 创建凭证对象
 * @param private_key 私钥
 * @returns 凭证对象
 */
export const createCredential = (private_key: string): ICredential => {
  return { private_key };
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
