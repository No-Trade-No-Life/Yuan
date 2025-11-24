import { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { ICredential, getGridOrdersAlgoPending, getGridPositions } from '../api/private-api';

export const getStrategyAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  // TODO: 需要分页获取所有的网格订单 (每页 100 条)
  const [gridAlgoOrders] = await Promise.all([
    getGridOrdersAlgoPending(credential, {
      algoOrdType: 'contract_grid',
    }),
  ]);

  let totalEquity = 0;
  const positions: IPosition[] = [];

  const gridPositionsRes = await Promise.all(
    gridAlgoOrders.data.map((item) =>
      getGridPositions(credential, { algoOrdType: 'contract_grid', algoId: item.algoId }),
    ),
  );

  gridPositionsRes.forEach((gridPositions, index) => {
    let positionValuation = 0;
    const leverage = +gridAlgoOrders.data?.[index].actualLever;
    gridPositions?.data?.forEach((position) => {
      if (+position.pos !== 0) {
        const directionRaw = gridAlgoOrders.data?.[index]?.direction ?? '';
        const direction = directionRaw ? directionRaw.toUpperCase() : 'LONG';
        positions.push({
          position_id: encodePath(position.algoId, position.instId),
          datasource_id: 'OKX',
          product_id: encodePath(position.instType, position.instId),
          direction,
          volume: Math.abs(+position.pos),
          free_volume: +position.pos,
          position_price: +position.avgPx,
          floating_profit: +position.upl,
          closable_price: +position.last,
          valuation: +position.notionalUsd,
        });
        positionValuation += +position.notionalUsd;
      }
    });
    if (leverage === 0) {
      // 实际杠杆为 0，说明没有持仓，直接把投资金额和累计盈亏算到净值里
      totalEquity += +gridAlgoOrders.data?.[index].investment + +gridAlgoOrders.data?.[index].totalPnl;
    } else {
      // 历史提取金额不会从 investment, totalPnl 扣减
      // 计算净值需要通过仓位的名义价值和实际杠杆计算
      totalEquity += positionValuation / leverage;
    }
  });

  return positions;
};
