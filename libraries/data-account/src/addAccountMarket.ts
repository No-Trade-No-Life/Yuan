import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';

/**
 * write account market info to db
 *
 * @public
 */
export const addAccountMarket = async (
  terminal: Terminal,
  cxt: { account_id: string; market_id: string },
) => {
  const { account_id, market_id } = cxt;
  try {
    await requestSQL(
      terminal,
      `
        INSERT INTO account_market (account_id, market_id) values (${escapeSQL(account_id)}, ${escapeSQL(
        market_id,
      )}) ON CONFLICT (account_id, market_id) DO NOTHING;
      `,
    );
  } catch (e) {
    console.error(
      formatTime(Date.now()),
      'AddAccountMarketError',
      `accountId: ${account_id}, marketId: ${market_id}`,
      `Error: `,
      e,
    );
  }
};
