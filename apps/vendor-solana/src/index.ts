import { provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';

const solanaAddress = process.env.PUBLIC_KEY?.split(',') || [];
const terminal = Terminal.fromNodeEnv();

const getAccountInfo = async (
  address: string,
): Promise<{
  jsonrpc: string;
  result: {
    context: {
      apiVersion: string;
      slot: number;
    };
    value: {
      data: string[];
      executable: boolean;
      lamports: number;
      owner: string;
      rentEpoch: number;
      space: number;
    };
  };
  id: number;
}> =>
  fetch('https://api.mainnet-beta.solana.com', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [
        address,
        {
          encoding: 'base58',
        },
      ],
    }),
  }).then((res) => res.json());

solanaAddress.forEach((address) => {
  console.info(formatTime(Date.now()), 'INIT', address);
  provideAccountInfoService(
    terminal,
    `SOLANA/${address}`,
    async () => {
      const info = await getAccountInfo(address);
      console.info(formatTime(Date.now()), 'INFO', info);
      const lamports = info.result.value.lamports;
      const sol = lamports / 1e9;
      return {
        money: {
          currency: 'SOL',
          equity: sol,
          free: sol,
        },
        positions: [],
      };
    },
    { auto_refresh_interval: 10_000 },
  );
});
