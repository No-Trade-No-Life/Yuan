import { Terminal } from '@yuants/protocol';
import { IAccountInfo } from './interface';

/**
 * use account info data stream
 * @public
 */
export const useAccountInfo = (terminal: Terminal, account_id: string) =>
  terminal.channel.subscribeChannel<IAccountInfo>('AccountInfo', account_id);
