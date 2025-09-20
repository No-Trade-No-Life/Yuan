import { ITrade } from '@yuants/data-trade';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { firstValueFrom } from 'rxjs';
import { terminal$ } from '../Network';
import { formatTime } from '@yuants/utils';

export const generateSimulateAccountNetValue = async (
  timeline: number[],
  open: string[],
  hight: string[],
  low: string[],
  close: string[],
  simulateAccountId: string,
  startTime: string,
  endTime: string,
) => {
  const terminal = await firstValueFrom(terminal$);
  const series = new Map<string, any[]>();
  if (terminal) {
    const tradeList = await requestSQL<ITrade[]>(
      terminal,
      `
        select * from trade where account_id=${escapeSQL(simulateAccountId)} and created_at>=${escapeSQL(
        formatTime(startTime),
      )} and created_at<=${escapeSQL(formatTime(endTime))} order by created_at;
            `,
    );
  }
  return;
};
