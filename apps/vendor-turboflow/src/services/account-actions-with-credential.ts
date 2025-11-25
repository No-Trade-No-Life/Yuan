import { IPosition, makeSpotPosition, provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { encodePath, scopeError } from '@yuants/utils';
import { getAccountAssets, getAccountInfo, getPositionList, ICredential } from '../api/private-api';

provideAccountActionsWithCredential<ICredential>(
  Terminal.fromNodeEnv(),
  'TURBOFLOW',
  {
    type: 'object',
    required: ['private_key'],
    properties: {
      private_key: {
        type: 'string',
        description: 'ED25519 Private Key (base58 encoded)',
      },
    },
  },
  {
    listAccounts: async (credential) => {
      const accountInfo = await getAccountInfo(credential, undefined);

      return scopeError(
        'ListAccountsError::TurboFlow',
        { error: accountInfo.errno, message: accountInfo.msg },
        () => [
          {
            account_id: `turboflow/${accountInfo.data.account_id}`,
          },
        ],
      );
    },

    getAccountInfo: async (credential, account_id) => {
      const assetsResponse = await getAccountAssets(credential, {
        fill_coin_sub_info: '1',
      });

      const assetPositions = assetsResponse.data.list.map((x) =>
        makeSpotPosition({
          position_id: x.coin_code,
          product_id: encodePath('SPOT', x.coin_name),
          volume: parseFloat(x.available_balance),
          free_volume: parseFloat(x.available_balance),
          closable_price: 1,
        }),
      );

      const positionsResponse = await getPositionList(credential, { status: 'Holding' });

      const positions: IPosition[] = (positionsResponse.data.data || []).map((position) => {
        const side = position.side === 1 ? 'LONG' : 'SHORT';
        const holdSize = parseFloat(position.hold_size);
        const holdAv = parseFloat(position.hold_av);
        const unpnl = parseFloat(position.unpnl);
        const im = parseFloat(position.im);

        return {
          position_id: position.id,
          datasource_id: 'TURBOFLOW',
          product_id: encodePath('PERP', position.symbol),
          direction: side,
          volume: holdSize,
          free_volume: holdSize, // Assuming all volume is free
          position_price: holdAv,
          closable_price: holdAv,
          floating_profit: unpnl,
          valuation: holdSize * holdAv,
          margin: im,
        };
      });

      return [...assetPositions, ...positions];
    },
  },
);
