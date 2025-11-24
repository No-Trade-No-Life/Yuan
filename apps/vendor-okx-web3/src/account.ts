import { IPosition, provideAccountInfoService } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { defer, repeat, retry, shareReplay, tap } from 'rxjs';
import * as okxWeb3Client from './api-service';

const WALLET_ADDRESS = process.env.WALLET_ADDRESS!;
const account_id = `OKXWeb3/${WALLET_ADDRESS}`;

const terminal = Terminal.fromNodeEnv();

export const supportedChains$ = defer(async () => {
  const res = await okxWeb3Client.getBalanceSupportedChain();
  if (res.code !== '0') {
    throw new Error(res.msg);
  }
  return res.data;
}).pipe(
  repeat({ delay: 86400_000 }),
  tap({
    error: (e) => {
      console.error(`SupportedChainsError`, e);
    },
  }),
  retry({ delay: 5000 }),
  shareReplay(1),
);

provideAccountInfoService(
  terminal,
  account_id,
  async () => {
    console.info(formatTime(Date.now()), `FetchingAccountInfo ${WALLET_ADDRESS}`);
    console.info(formatTime(Date.now()), `GetBalanceTotalValueByAddress ${WALLET_ADDRESS}`);
    const assetsRes = await okxWeb3Client.getBalanceTotalValueByAddress({
      address: WALLET_ADDRESS,
      chains:
        process.env.CHAINS_DIVIDED_BY_COMMA! ||
        [
          1, // ETH
          56, // BSC
          42161, // Arbitrum One
        ].join(','),
      assetType: '0',
    });

    if (assetsRes.code !== '0') {
      throw new Error(assetsRes.msg);
    }
    const totalAssets = Number(assetsRes.data[0].totalValue);
    console.info(formatTime(Date.now()), `TotalAssets ${totalAssets} USD`);

    console.info(formatTime(Date.now()), `GetBalanceAllTokenBalancesByAddress ${WALLET_ADDRESS}`);
    const tokenRes = await okxWeb3Client.getBalanceAllTokenBalancesByAddress({
      address: WALLET_ADDRESS,
      chains:
        process.env.CHAINS_DIVIDED_BY_COMMA! ||
        [
          1, // ETH
          56, // BSC
          42161, // Arbitrum One
        ].join(','),
    });
    if (tokenRes.code !== '0') {
      throw new Error(tokenRes.msg);
    }
    const tokens = tokenRes.data;
    console.info(formatTime(Date.now()), `TotalTokens ${tokens.length}`);

    console.info(formatTime(Date.now()), `GetDefiUserAssetPlatformList ${WALLET_ADDRESS}`);
    const defiRes = await okxWeb3Client.getDefiUserAssetPlatformList({
      walletAddressList: [
        {
          chainId: '56',
          walletAddress: WALLET_ADDRESS,
        },
        {
          chainId: '42161',
          walletAddress: WALLET_ADDRESS,
        },
      ],
    });

    if (defiRes.code !== 0) {
      throw new Error(defiRes.msg);
    }
    const defiPlatforms = defiRes.data;
    console.info(formatTime(Date.now()), `TotalDefiPlatforms ${defiPlatforms.walletIdPlatformList.length}`);

    console.info(formatTime(Date.now()), `GetDefiUserAssetPlatformDetail for each platform`);
    const defiDetails = await Promise.all(
      defiPlatforms.walletIdPlatformList[0].platformList.map((platform) =>
        okxWeb3Client
          .getDefiUserAssetPlatformDetail({
            analysisPlatformId: platform.analysisPlatformId.toString(),
            accountIdInfoList: [
              {
                walletAddressList: [
                  {
                    chainId: platform.networkBalanceVoList[0].chainId,
                    walletAddress: WALLET_ADDRESS,
                  },
                ],
              },
            ],
          })
          .then((res) => {
            if (res.code !== 0) {
              throw new Error(res.msg);
            }
            return res.data;
          }),
      ),
    );
    console.info(formatTime(Date.now()), `TotalDefiDetails ${defiDetails.length}`);

    const positions: IPosition[] = [];
    tokens.forEach((chain) => {
      chain.tokenAssets.forEach((token) => {
        positions.push({
          position_id: token.tokenContractAddress,
          datasource_id: token.chainIndex,
          product_id: token.symbol,
          account_id: account_id,
          direction: 'LONG',
          volume: Number(token.balance),
          free_volume: Number(token.balance),
          position_price: 0,
          closable_price: Number(token.tokenPrice),
          floating_profit: 0,
          valuation: 0,
        });
      });
    });

    defiDetails.forEach((detail) => {
      detail.walletIdPlatformDetailList.forEach((wallet) => {
        wallet.networkHoldVoList.forEach((network) => {
          network.investTokenBalanceVoList.forEach((token) => {
            token.positionList?.forEach((pos) => {
              pos.assetsTokenList.forEach((asset) => {
                positions.push({
                  position_id: `ACTIVE-${pos.positionName}-${asset.tokenSymbol}-${asset.tokenAddress}`,
                  datasource_id: detail.platformName,
                  product_id: asset.tokenSymbol,
                  account_id: account_id,
                  direction: 'LONG',
                  volume: Number(asset.coinAmount),
                  free_volume: 0,
                  position_price: 0,
                  closable_price: Number(asset.coinAmount),
                  floating_profit: 0,
                  valuation: 0,
                });
              });
              pos.unclaimFeesDefiTokenInfo.forEach((info) => {
                info.baseDefiTokenInfos.forEach((asset) => {
                  positions.push({
                    position_id: `UNCLAIMED-${pos.positionName}-${asset.tokenSymbol}-${asset.tokenAddress}`,
                    datasource_id: detail.platformName,
                    product_id: asset.tokenSymbol,
                    account_id: account_id,
                    direction: 'LONG',
                    volume: Number(asset.coinAmount),
                    free_volume: 0,
                    position_price: 0,
                    closable_price: Number(asset.coinAmount),
                    floating_profit: 0,
                    valuation: 0,
                  });
                });
              });
            });
          });
        });
      });
    });
    console.info(formatTime(Date.now()), `TotalPositions ${positions.length}`);

    return positions;
  },
  {
    auto_refresh_interval: process.env.ACCOUNT_AUTO_REFRESH_INTERVAL
      ? ~~Number(process.env.ACCOUNT_AUTO_REFRESH_INTERVAL)
      : 5_000,
  },
);
