import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * all the time is formatted as `yyyy-MM-dd HH:mm:ss.SSSXXX`.
 *
 * e.g. "2023-05-07 12:34:56.789+08:00"
 *
 * @public
 */
export const formatTime = (time: Date | number | string, timeZone: string | undefined = undefined) => {
  try {
    if (timeZone) {
      return formatInTimeZone(time, timeZone, 'yyyy-MM-dd HH:mm:ss.SSSXXX');
    }
    return format(new Date(time), 'yyyy-MM-dd HH:mm:ss.SSSXXX');
  } catch (e) {
    return 'Invalid Date';
  }
};
