import { IResponse, Terminal } from '@yuants/protocol';
import { ITransferOrder } from './model';

/**
 * make a transfer apply request
 *
 * @public
 */
export const transferApply = (
  terminal: Terminal,
  order: ITransferOrder,
): Promise<IResponse<{ state: string; context?: string; transaction_id?: string; message?: string }>> =>
  terminal.client.requestForResponse('TransferApply', order) as any;

/**
 * make a transfer evaluation request
 *
 * @public
 */
export const transferEval = (
  terminal: Terminal,
  order: ITransferOrder,
): Promise<IResponse<{ state: string; context?: string; received_amount?: number } | void>> =>
  terminal.client.requestForResponse('TransferEval', order) as any;
