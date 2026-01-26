import { makeSpotPosition, type IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getEarnBalance, ICredential } from '../../api/private-api';
import { getSpotPrice } from '../../api/public-api';

/**
 * 简单的并发限制器（支持带参数的函数）
 */
const createConcurrencyLimiter = <T, Args extends any[]>(
  concurrency: number,
  fn: (...args: Args) => Promise<T>,
): ((...args: Args) => Promise<T>) => {
  let running = 0;
  const queue: Array<() => void> = [];

  const runNext = () => {
    if (running >= concurrency || queue.length === 0) return;
    running++;
    const task = queue.shift()!;
    task();
  };

  return (...args: Args) => {
    return new Promise<T>((resolve, reject) => {
      const task = () => {
        fn(...args)
          .then(resolve, reject)
          .finally(() => {
            running--;
            runNext();
          });
      };
      queue.push(task);
      runNext();
    });
  };
};

// 限制现货价格查询的并发数（避免触发 API 限流）
const limitedGetSpotPrice = createConcurrencyLimiter(5, getSpotPrice);

/**
 * 获取理财账户信息
 */
export const getEarningAccountInfo = async (credential: ICredential): Promise<IPosition[]> => {
  const balances = await getEarnBalance(credential, {});

  const positions = await Promise.all(
    balances.map(async (balance) => {
      // 过滤零余额条目
      if (+balance.amount <= 0) return undefined;

      // 计算可用余额：理财总数量减去已申请赎回未到账的冻结部分
      const frozen = +balance.frozen_amount || 0;
      const freeVolume = Math.max(0, +balance.amount - frozen);

      // 获取币种对 USDT 的现货价格（getSpotPrice 已处理特殊映射和默认值）
      const closablePrice = await limitedGetSpotPrice(balance.currency);

      return makeSpotPosition({
        datasource_id: 'GATE',
        position_id: `earning/${balance.currency}`,
        product_id: encodePath('GATE', 'EARNING', balance.currency),
        volume: +balance.amount,
        free_volume: freeVolume,
        closable_price: closablePrice,
      });
    }),
  );

  // 过滤 undefined 条目
  return positions.filter((pos): pos is IPosition => !!pos);
};
