import { useAgent } from './basic-set';

/**
 * 使用账户信息
 * @returns 账户信息
 * @public
 */
export const useAccountInfo = () => useAgent().accountInfoUnit.accountInfo;
