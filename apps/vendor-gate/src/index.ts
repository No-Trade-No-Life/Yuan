import { addAccountMarket, IPosition, provideAccountInfoService } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { addAccountTransferAddress } from '@yuants/transfer';
import { encodePath, formatTime } from '@yuants/utils';
import { defer, firstValueFrom, repeat, retry, shareReplay } from 'rxjs';
import { client } from './api';
import './interest_rate';
import { mapProductIdToUsdtFutureProduct$ } from './product';

const terminal = Terminal.fromNodeEnv();

const memoizeMap = <T extends (...params: any[]) => any>(fn: T): T => {
  const cache: Record<string, any> = {};
  return ((...params: any[]) => (cache[encodePath(params)] ??= fn(...params))) as T;
};

(async () => {
  const gate_account = await client.getAccountDetail();
  const uid = gate_account.user_id;

  const FUTURE_USDT_ACCOUNT_ID = `gate/${uid}/future/USDT`;
  const SPOT_USDT_ACCOUNT_ID = `gate/${uid}/spot/USDT`;
  const UNIFIED_USDT_ACCOUNT_ID = `gate/${uid}/unified/USDT`;

  const loadFuturePositions = async (): Promise<IPosition[]> => {
    const [positionsRes, mapProductIdToUsdtFutureProduct] = await Promise.all([
      client.getFuturePositions('usdt'),
      firstValueFrom(mapProductIdToUsdtFutureProduct$),
    ]);

    const positions = Array.isArray(positionsRes) ? positionsRes : [];
    return positions.map((position): IPosition => {
      const product_id = position.contract;
      const theProduct = mapProductIdToUsdtFutureProduct.get(product_id);
      const volume = Math.abs(position.size);
      const closable_price = +position.mark_price;
      const valuation = volume * closable_price * (theProduct?.value_scale ?? 1);
      return {
        datasource_id: 'GATE-FUTURE',
        position_id: `${position.contract}-${position.leverage}-${position.mode}`,
        product_id,
        direction:
          position.mode === 'dual_long'
            ? 'LONG'
            : position.mode === 'dual_short'
            ? 'SHORT'
            : position.size > 0
            ? 'LONG'
            : 'SHORT',
        volume,
        free_volume: Math.abs(position.size),
        position_price: +position.entry_price,
        closable_price,
        floating_profit: +position.unrealised_pnl,
        valuation,
      };
    });
  };

  provideAccountInfoService(
    terminal,
    FUTURE_USDT_ACCOUNT_ID,
    async () => {
      const [positions, rawAccount] = await Promise.all([
        loadFuturePositions(),
        client.getFuturesAccounts('usdt'),
      ]);

      const account = rawAccount?.available
        ? rawAccount
        : { available: '0', total: '0', unrealised_pnl: '0' };
      const free = Number(account.available ?? 0);
      const equity = Number(account.total ?? 0) + Number(account.unrealised_pnl ?? 0);

      return {
        money: {
          currency: 'USDT',
          equity,
          free,
        },
        positions,
      };
    },
    { auto_refresh_interval: 1000 },
  );
  addAccountMarket(terminal, { account_id: FUTURE_USDT_ACCOUNT_ID, market_id: 'GATE/USDT-FUTURE' });

  provideAccountInfoService(
    terminal,
    UNIFIED_USDT_ACCOUNT_ID,
    async () => {
      const [positions, unifiedAccount, spotTickers] = await Promise.all([
        loadFuturePositions(),
        client.getUnifiedAccounts({}),
        client.getSpotTickers({}),
      ]);

      const balances = unifiedAccount?.balances ?? {};
      const balancesRecord = balances;
      const spotTickerList = Array.isArray(spotTickers) ? spotTickers : [];

      const free = Number(balancesRecord['USDT']?.available || 0);
      const equity = Number(unifiedAccount?.unified_account_total_equity || 0);

      const spotPosition: IPosition[] = Object.keys(balances)
        .map((instId) => {
          if (instId === 'USDT') return;
          let currency_pair = instId + '_USDT';
          if (instId === 'SOL2') {
            currency_pair = 'SOL_USDT';
          }
          const closable_price = Number(
            spotTickerList.find((ticker) => ticker.currency_pair === currency_pair)?.last || 0,
          );
          const volume = Number(balancesRecord[instId]?.available || 0);
          return {
            datasource_id: 'gate/spot',
            position_id: instId,
            product_id: instId,
            direction: 'LONG',
            volume,
            free_volume: volume,
            closable_price,
            position_price: closable_price,
            floating_profit: 0,
            valuation: closable_price * volume,
          };
        })
        .filter((x): x is Exclude<typeof x, undefined> => !!x);

      return {
        money: {
          currency: 'USDT',
          equity,
          free,
        },
        positions: [...positions, ...spotPosition],
      };
    },
    { auto_refresh_interval: 1000 },
  );
  addAccountMarket(terminal, { account_id: UNIFIED_USDT_ACCOUNT_ID, market_id: 'GATE/UNIFIED' });

  provideAccountInfoService(
    terminal,
    SPOT_USDT_ACCOUNT_ID,
    async () => {
      const res = await client.getSpotAccounts();
      if (!(res instanceof Array)) {
        throw new Error(`${res}`);
      }
      const balance = +(res.find((v) => v.currency === 'USDT')?.available ?? '0');
      const equity = balance;
      const free = equity;
      return {
        money: {
          currency: 'USDT',
          equity,
          free,
        },
        positions: [],
      };
    },
    { auto_refresh_interval: 1000 },
  );
  addAccountMarket(terminal, { account_id: SPOT_USDT_ACCOUNT_ID, market_id: 'GATE/SPOT' });

  // const futuresTickers$ = defer(async () => {
  //   const contractRes = await client.getFuturesContracts('usdt');
  //   if (!(contractRes instanceof Array)) {
  //     throw new Error(`${contractRes}`);
  //   }
  //   const tickerRes = await client.getFuturesTickers('usdt');
  //   if (!(tickerRes instanceof Array)) {
  //     throw new Error(`${contractRes}`);
  //   }
  //   const mapContractNameToContract = new Map(contractRes.map((v) => [v.name, v]));
  //   const mapContractNameToTicker = new Map(tickerRes.map((v) => [v.contract, v]));
  //   const ret: Record<string, ITick> = {};
  //   for (const contractName of mapContractNameToContract.keys()) {
  //     const ticker = mapContractNameToTicker.get(contractName);
  //     const contract = mapContractNameToContract.get(contractName);
  //     if (!ticker || !contract) {
  //       continue;
  //     }
  //     const tick: ITick = {
  //       datasource_id: 'GATE-FUTURE',
  //       product_id: contractName,
  //       updated_at: Date.now(),
  //       price: +ticker.last,
  //       ask: +ticker.lowest_ask,
  //       bid: +ticker.highest_bid,
  //       volume: +ticker.volume_24h,
  //       open_interest: +ticker.total_size,
  //       settlement_scheduled_at: contract.funding_next_apply * 1000,
  //       interest_rate_for_long: -+contract.funding_rate,
  //       interest_rate_for_short: +contract.funding_rate,
  //     };
  //     ret[contractName] = tick;
  //   }
  //   return ret;
  // }).pipe(
  //   //
  //   tap({
  //     error: (e) => {
  //       console.error(formatTime(Date.now()), 'FuturesTickers', e);
  //     },
  //   }),
  //   retry({ delay: 5000 }),
  //   repeat({ delay: 5000 }),
  //   shareReplay(1),
  // );

  const marketDepth$ = memoizeMap((contract_name: string) =>
    defer(async () => {
      const res = await client.getFuturesOrderBook('usdt', { contract: contract_name });
      // TODO: possible error handling
      return res;
    }).pipe(
      //
      repeat({ delay: 2500 }),
      retry({ delay: 5000 }),
      shareReplay(1),
    ),
  );

  // provideTicks(terminal, 'GATE-FUTURE', (product_id: string) => {
  //   return defer(() =>
  //     futuresTickers$.pipe(
  //       //
  //       map((v) => v[product_id]),
  //       filter((v) => v !== undefined),
  //       shareReplay(1),
  //     ),
  //   );
  // });

  terminal.server.provideService<IOrder>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: { account_id: { const: FUTURE_USDT_ACCOUNT_ID } },
    },
    async (msg) => {
      const order = msg.req;
      const res = await client.postFutureOrders('usdt', {
        contract: order.product_id,
        size:
          order.volume *
          (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 1 : -1),
        price: order.order_type === 'MARKET' ? '0' : `${order.price}`,
        tif: order.order_type === 'MARKET' ? 'ioc' : 'gtc',
        reduce_only: order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT',
      });
      if (res.label) {
        return { res: { code: 400, message: `${res.label}: ${res.message} ${res.detail}` } };
      }
      return { res: { code: 0, message: 'OK' } };
    },
  );

  terminal.server.provideService<IOrder>(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: { account_id: { const: FUTURE_USDT_ACCOUNT_ID } },
    },
    async (msg) => {
      const order = msg.req;
      await client.deleteFutureOrders('usdt', order.order_id!);
      return { res: { code: 0, message: 'OK' } };
    },
  );

  const ACCOUNT_INTERNAL_NETWORK_ID = `Bitget/${uid}/ACCOUNT_INTERNAL`;
  addAccountTransferAddress({
    terminal,
    account_id: SPOT_USDT_ACCOUNT_ID,
    network_id: ACCOUNT_INTERNAL_NETWORK_ID,
    currency: 'USDT',
    address: 'SPOT',
    onApply: {
      INIT: async (order) => {
        const transferResult = await client.postWalletTransfer({
          currency: 'USDT',
          from: 'spot',
          to: 'futures',
          amount: `${order.current_amount}`,
          settle: 'usdt',
        });
        if (transferResult.tx_id !== undefined) {
          return { state: 'COMPLETE', transaction_id: transferResult.tx_id };
        }
        return { state: 'INIT', message: `${transferResult}` };
      },
    },
    onEval: async (transferOrder) => {
      return { state: 'COMPLETE', received_amount: transferOrder.current_amount };
    },
  });
  addAccountTransferAddress({
    terminal,
    account_id: FUTURE_USDT_ACCOUNT_ID,
    network_id: ACCOUNT_INTERNAL_NETWORK_ID,
    currency: 'USDT',
    address: 'USDT_FUTURE',
    onApply: {
      INIT: async (order) => {
        const transferResult = await client.postWalletTransfer({
          currency: 'USDT',
          from: 'futures',
          to: 'spot',
          amount: `${order.current_amount}`,
          settle: 'usdt',
        });
        if (transferResult.tx_id !== undefined) {
          return { state: 'COMPLETE', transaction_id: transferResult.tx_id };
        }
        return { state: 'INIT', message: `${transferResult}` };
      },
    },
    onEval: async (transferOrder) => {
      return { state: 'COMPLETE', received_amount: transferOrder.current_amount };
    },
  });

  const subAccountsResult = await client.getSubAccountList({ type: '0' });
  // TODO: test what happens if we were sub accounts
  const isMainAccount = true;
  if (isMainAccount) {
    const depositAddressRes = await client.getDepositAddress({ currency: 'USDT' });
    console.info(formatTime(Date.now()), 'DepositAddress', JSON.stringify(depositAddressRes));
    const addresses = depositAddressRes.multichain_addresses.filter((v) => v.chain === 'TRX');
    for (const address of addresses) {
      addAccountTransferAddress({
        terminal,
        account_id: SPOT_USDT_ACCOUNT_ID,
        network_id: 'TRC20',
        currency: 'USDT',
        address: address.address,
        onApply: {
          // TODO: test this one
          INIT: async (transferOrder) => {
            const transferResult = await client.postWithdrawals({
              amount: '' + transferOrder.current_amount!,
              currency: 'USDT',
              address: transferOrder.current_rx_address!,
              chain: 'TRX',
            });
            const { txid, withdraw_order_id } = transferResult;
            if (txid && txid.length > 0) {
              return { state: 'COMPLETE', transaction_id: txid };
            }
            return { state: 'PENDING', context: withdraw_order_id };
          },
          PENDING: async (transferOrder) => {
            const wdId = transferOrder.current_tx_context;
            const withdrawalRecordsResult = await client.getWithdrawalHistory();
            const withdrawalRecord = withdrawalRecordsResult.find((v) => v.withdraw_order_id === wdId);
            if (withdrawalRecord && withdrawalRecord.txid && withdrawalRecord.txid.length > 0) {
              return { state: 'COMPLETE', transaction_id: withdrawalRecord.txid };
            }
            return { state: 'PENDING', context: wdId };
          },
        },
        onEval: async (transferOrder) => {
          const checkResult = await client.getDepositHistory({
            currency: 'USDT',
          });
          const depositRecord = checkResult.find((v) => v.txid === transferOrder.current_transaction_id);
          if (depositRecord && depositRecord.status === 'DONE') {
            return { state: 'COMPLETE', received_amount: +depositRecord.amount };
          }
          return { state: 'PENDING' };
        },
      });
    }
  }
})();
