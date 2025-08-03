import {
  addAccountMarket,
  IAccountInfo,
  IAccountMoney,
  IPosition,
  publishAccountInfo,
} from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { defer, repeat, retry, shareReplay, tap } from 'rxjs';
import { client } from './api';
import './interest-rate';
import './product';
import './quote';

const terminal = Terminal.fromNodeEnv();

(async () => {
  const accountInfoRes = await client.getAccountInfo();
  const uid = accountInfoRes.data.userId;
  const parentId = '' + accountInfoRes.data.parentId;
  const isMainAccount = uid === parentId;

  const USDT_FUTURE_ACCOUNT_ID = `bitget/${uid}/futures/USDT`;
  const SPOT_ACCOUNT_ID = `bitget/${uid}/spot/USDT`;

  // swap account info
  {
    const swapAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const balanceRes = await client.getFutureAccounts({ productType: 'USDT-FUTURES' });
      if (balanceRes.msg !== 'success') {
        throw new Error(balanceRes.msg);
      }
      const positionsRes = await client.getAllPositions({ productType: 'USDT-FUTURES', marginCoin: 'USDT' });
      if (positionsRes.msg !== 'success') {
        throw new Error(positionsRes.msg);
      }

      const money: IAccountMoney = {
        currency: 'USDT',
        equity: +balanceRes.data[0].accountEquity,
        profit: +balanceRes.data[0].unrealizedPL,
        free: +balanceRes.data[0].maxTransferOut,
        used: +balanceRes.data[0].accountEquity - +balanceRes.data[0].maxTransferOut,
        balance: +balanceRes.data[0].available,
      };
      return {
        account_id: USDT_FUTURE_ACCOUNT_ID,
        money: money,
        currencies: [money],
        positions: positionsRes.data.map(
          (position): IPosition => ({
            position_id: `${position.symbol}-${position.holdSide}`,
            datasource_id: 'BITGET',
            product_id: encodePath('USDT-FUTURES', position.symbol),
            direction: position.holdSide === 'long' ? 'LONG' : 'SHORT',
            volume: +position.total,
            free_volume: +position.available,
            position_price: +position.openPriceAvg,
            closable_price: +position.markPrice,
            floating_profit: +position.unrealizedPL,
            valuation: +position.total * +position.markPrice,
          }),
        ),
        orders: [],
        updated_at: Date.now(),
      };
    }).pipe(
      //
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'SwapAccountInfo', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 1000 }),
      shareReplay(1),
    );
    publishAccountInfo(terminal, USDT_FUTURE_ACCOUNT_ID, swapAccountInfo$);
    addAccountMarket(terminal, { account_id: USDT_FUTURE_ACCOUNT_ID, market_id: 'BITGET/USDT-FUTURE' });
  }

  // spot account info
  {
    const spotAccountInfo$ = defer(async (): Promise<IAccountInfo> => {
      const res = await client.getSpotAssets();
      if (res.msg !== 'success') {
        throw new Error(res.msg);
      }
      const balance = +(res.data.find((v) => v.coin === 'USDT')?.available ?? 0);
      const equity = balance;
      const free = equity;
      const money: IAccountMoney = {
        currency: 'USDT',
        equity,
        profit: 0,
        free,
        used: 0,
        balance,
      };
      return {
        updated_at: Date.now(),
        account_id: SPOT_ACCOUNT_ID,
        money: money,
        currencies: [money],
        positions: [],
        orders: [],
      };
    }).pipe(
      //
      tap({
        error: (e) => {
          console.error(formatTime(Date.now()), 'SpotAccountInfo', e);
        },
      }),
      retry({ delay: 5000 }),
      repeat({ delay: 1000 }),
      shareReplay(1),
    );

    publishAccountInfo(terminal, SPOT_ACCOUNT_ID, spotAccountInfo$);
    addAccountMarket(terminal, { account_id: SPOT_ACCOUNT_ID, market_id: 'BITGET/SPOT' });
  }

  // trade api
  {
    terminal.provideService(
      'SubmitOrder',
      {
        required: ['account_id'],
        properties: {
          account_id: { const: USDT_FUTURE_ACCOUNT_ID },
        },
      },
      (msg) =>
        defer(async () => {
          console.info(formatTime(Date.now()), 'SubmitOrder', msg);
          const order = msg.req;
          const [instType, instId] = decodePath(order.product_id);

          const mapOrderDirectionToSide = (direction?: string) => {
            switch (direction) {
              case 'OPEN_LONG':
              case 'CLOSE_LONG':
                return 'buy';
              case 'OPEN_SHORT':
              case 'CLOSE_SHORT':
                return 'sell';
            }
            throw new Error(`Unknown direction: ${direction}`);
          };

          const mapOrderDirectionToTradeSide = (direction?: string) => {
            switch (direction) {
              case 'OPEN_LONG':
              case 'OPEN_SHORT':
                return 'open';
              case 'CLOSE_LONG':
              case 'CLOSE_SHORT':
                return 'close';
            }
            throw new Error(`Unknown direction: ${direction}`);
          };

          const params = {
            symbol: instId,
            productType: instType,
            marginMode: 'crossed',
            marginCoin: 'USDT',
            size: '' + order.volume,
            price: order.price !== undefined ? '' + order.price : undefined,
            side: mapOrderDirectionToSide(order.order_direction),
            tradeSide: mapOrderDirectionToTradeSide(order.order_direction),
            orderType: order.order_type === 'LIMIT' ? 'limit' : 'market',
          };

          console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));

          const res = await client.postFuturePlaceOrder(params);
          if (res.msg !== 'success') {
            return { res: { code: +res.code, message: '' + res.msg } };
          }
          return { res: { code: 0, message: 'OK' } };
        }),
    );

    terminal.provideService(
      'CancelOrder',
      {
        required: ['account_id'],
        properties: {
          account_id: { const: USDT_FUTURE_ACCOUNT_ID },
        },
      },
      (msg) =>
        defer(async () => {
          console.info(formatTime(Date.now()), 'CancelOrder', msg);
          const order = msg.req;
          const [instType, instId] = decodePath(order.product_id);

          const res = await client.postFutureCancelOrder({
            symbol: instId,
            productType: instType,
            orderId: order.order_id,
          });

          if (res.msg !== 'success') {
            return { res: { code: +res.code, message: '' + res.msg } };
          }
          return { res: { code: 0, message: 'OK' } };
        }),
    );
  }

  // transfer
  {
    // BLOCK_CHAIN;
    if (isMainAccount) {
      const depositAddressRes = await client.getDepositAddress({ coin: 'USDT', chain: 'TRC20' });
      console.info(formatTime(Date.now()), 'DepositAddress', depositAddressRes.data);
      const address = depositAddressRes.data;

      addAccountTransferAddress({
        terminal,
        account_id: SPOT_ACCOUNT_ID,
        network_id: 'TRC20',
        currency: 'USDT',
        address: address.address,
        onApply: {
          INIT: async (order) => {
            if (!order.current_amount || order.current_amount < 10) {
              return { state: 'ERROR', message: 'Amount too small' };
            }
            const transferResult = await client.postWithdraw({
              coin: 'USDT',
              transferType: 'on_chain',
              address: order.current_rx_address!,
              chain: 'TRC20',
              size: `${order.current_amount}`,
            });
            if (transferResult.msg !== 'success') {
              return { state: 'ERROR', message: transferResult.msg };
            }
            const wdId = transferResult.data.orderId;
            return { state: 'PENDING', context: wdId };
          },
          PENDING: async (order) => {
            const wdId = order.current_tx_context;
            const withdrawalRecordsResult = await client.getWithdrawalRecords({
              orderId: wdId,
              startTime: `${Date.now() - 90 * 86400_000}`,
              endTime: '' + Date.now(),
            });
            const txId = withdrawalRecordsResult.data[0].tradeId;
            if (txId === wdId) {
              return { state: 'PENDING', context: wdId };
            }
            return { state: 'COMPLETE', transaction_id: txId };
          },
        },
        onEval: async (order) => {
          const checkResult = await client.getDepositRecords({
            coin: 'USDT',
            startTime: `${Date.now() - 90 * 86400_000}`,
            endTime: '' + Date.now(),
            limit: '100',
          });
          if (checkResult.msg !== 'success') {
            return { state: 'PENDING' };
          }
          const deposit = checkResult.data.find((v) => v.tradeId === order.current_transaction_id);
          if (deposit === undefined) {
            return { state: 'PENDING' };
          }
          return { state: 'COMPLETE', received_amount: +deposit.size };
        },
      });
    }

    // account internal transfer
    const ACCOUNT_INTERNAL_NETWORK_ID = `Bitget/${uid}/ACCOUNT_INTERNAL_NETWORK_ID`;
    addAccountTransferAddress({
      terminal,
      account_id: SPOT_ACCOUNT_ID,
      network_id: ACCOUNT_INTERNAL_NETWORK_ID,
      currency: 'USDT',
      address: 'SPOT',
      onApply: {
        INIT: async (order) => {
          const transferResult = await client.postTransfer({
            fromType: 'spot',
            toType: 'usdt_futures',
            amount: `${order.current_amount}`,
            coin: 'USDT',
          });
          if (transferResult.msg !== 'success') {
            return { state: 'INIT', message: transferResult.msg };
          }
          return { state: 'COMPLETE' };
        },
      },
      onEval: async (order) => {
        return { state: 'COMPLETE', received_amount: order.current_amount };
      },
    });
    addAccountTransferAddress({
      terminal,
      account_id: USDT_FUTURE_ACCOUNT_ID,
      network_id: ACCOUNT_INTERNAL_NETWORK_ID,
      currency: 'USDT',
      address: 'USDT_FUTURE',
      onApply: {
        INIT: async (order) => {
          const transferResult = await client.postTransfer({
            fromType: 'usdt_futures',
            toType: 'spot',
            amount: `${order.current_amount}`,
            coin: 'USDT',
          });
          if (transferResult.msg !== 'success') {
            return { state: 'INIT', message: transferResult.msg };
          }
          return { state: 'COMPLETE' };
        },
      },
      onEval: async (order) => {
        return { state: 'COMPLETE', received_amount: order.current_amount };
      },
    });

    // TODO: account internal margin transfer

    // sub-account transfer
    const getSubAccountNetworkId = (subUid: string) => `Bitget/${parentId}/SubAccount/${subUid}`;
    if (isMainAccount) {
      const subAccountInfoRes = await client.getVirtualSubAccountList();
      for (const item of subAccountInfoRes.data.subAccountList || []) {
        addAccountTransferAddress({
          terminal,
          account_id: SPOT_ACCOUNT_ID,
          network_id: getSubAccountNetworkId(item.subAccountUid),
          currency: 'USDT',
          address: 'parent',
          onApply: {
            INIT: async (order) => {
              const transferResult = await client.postSubAccountTransfer({
                fromType: 'spot',
                toType: 'spot',
                amount: `${order.current_amount}`,
                coin: 'USDT',
                fromUserId: parentId,
                toUserId: item.subAccountUid,
              });
              if (transferResult.msg !== 'success') {
                return { state: 'INIT', message: transferResult.msg };
              }
              return { state: 'COMPLETE', transaction_id: transferResult.data.transferId };
            },
          },
          onEval: async (order) => {
            return { state: 'COMPLETE', received_amount: order.current_amount };
          },
        });

        addAccountTransferAddress({
          terminal,
          account_id: `bitget/${item.subAccountUid}/spot/USDT`,
          network_id: getSubAccountNetworkId(item.subAccountUid),
          currency: 'USDT',
          address: 'sub',
          onApply: {
            INIT: async (order) => {
              const transferResult = await client.postSubAccountTransfer({
                fromType: 'spot',
                toType: 'spot',
                amount: `${order.current_amount}`,
                coin: 'USDT',
                fromUserId: item.subAccountUid,
                toUserId: parentId,
              });
              if (transferResult.msg !== 'success') {
                return { state: 'INIT', message: transferResult.msg };
              }
              return { state: 'COMPLETE', transaction_id: transferResult.data.transferId };
            },
          },
          onEval: async (order) => {
            return { state: 'COMPLETE', received_amount: order.current_amount };
          },
        });
      }
    }
  }
})();
