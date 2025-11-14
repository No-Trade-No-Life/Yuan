import { addAccountMarket } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { provideSpotAccountInfoService, provideSwapAccountInfoService } from './account-info';
import {
  getAccount,
  getDefaultCredential,
  getSubUserList,
  getSwapUnifiedAccountType,
  getUid,
  postSwapSwitchAccountType,
} from './api/private-api';
import './interest_rate';
import { provideOrderSubmitService } from './order-actions';
import './order-actions-with-credentials';
import './quote';
import {
  setupSpotSuperMarginTransfer,
  setupSpotSwapTransfer,
  setupSubAccountTransfers,
  setupTrc20WithdrawalAddresses,
} from './transfer';
import { spotAccountUidCache } from './uid';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

(async () => {
  // 账户类型切换
  const swapAccountTypeRes = await getSwapUnifiedAccountType(credential);
  if (swapAccountTypeRes.data?.account_type === 1) {
    console.info(
      formatTime(Date.now()),
      'SwitchingAccountType',
      `previous: ${swapAccountTypeRes.data.account_type}, switching to 2 (unified account)`,
    );
    const switchRes = await postSwapSwitchAccountType(credential, { account_type: 2 });
    console.info(formatTime(Date.now()), 'SwitchingAccountType', `current: ${switchRes.data.account_type}`);
  }

  const huobiUid: number = (await getUid(credential)).data;
  console.info(formatTime(Date.now()), 'UID', huobiUid);

  const huobiAccounts = await getAccount(credential);
  const spotAccountUid = (await spotAccountUidCache.query(''))!;
  console.info(formatTime(Date.now()), 'huobiAccount', JSON.stringify(huobiAccounts));

  const account_id = `huobi/${huobiUid}`;
  const SPOT_ACCOUNT_ID = `${account_id}/spot/usdt`;
  const SUPER_MARGIN_ACCOUNT_ID = `${account_id}/super-margin`;
  const SWAP_ACCOUNT_ID = `${account_id}/swap`;

  const subUsersRes = await getSubUserList(credential);
  const subAccounts = subUsersRes.data;
  const isMainAccount = subUsersRes.ok;
  console.info(formatTime(Date.now()), 'subAccounts', JSON.stringify(subAccounts));

  // 设置账户信息服务

  provideSwapAccountInfoService(terminal, SWAP_ACCOUNT_ID, credential);

  provideSpotAccountInfoService(terminal, SPOT_ACCOUNT_ID, credential, spotAccountUid);

  // 设置账户市场关联
  addAccountMarket(terminal, { account_id: SPOT_ACCOUNT_ID, market_id: 'HUOBI/SPOT' });
  addAccountMarket(terminal, { account_id: SUPER_MARGIN_ACCOUNT_ID, market_id: 'HUOBI/SUPER-MARGIN' });
  addAccountMarket(terminal, { account_id: SWAP_ACCOUNT_ID, market_id: 'HUOBI/SWAP' });

  // 设置订单提交服务
  provideOrderSubmitService(terminal, SWAP_ACCOUNT_ID, SUPER_MARGIN_ACCOUNT_ID, credential);

  // 设置转账功能
  await setupTrc20WithdrawalAddresses(terminal, SPOT_ACCOUNT_ID, credential, isMainAccount);
  setupSpotSuperMarginTransfer(terminal, SPOT_ACCOUNT_ID, SUPER_MARGIN_ACCOUNT_ID, credential, huobiUid);
  setupSpotSwapTransfer(terminal, SPOT_ACCOUNT_ID, SWAP_ACCOUNT_ID, credential, huobiUid);
  setupSubAccountTransfers(terminal, SPOT_ACCOUNT_ID, credential, huobiUid, subAccounts, isMainAccount);
})();
