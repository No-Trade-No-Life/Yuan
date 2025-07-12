/**
 * @public
 */
export interface ITransferNetworkInfo {
  network_id: string;
  /** 手续费 */
  commission: number;
  /** 手续费货币 */
  currency: string;
  /** 网络超时时间 */
  timeout?: number;
}
