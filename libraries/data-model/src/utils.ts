import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { v4 } from 'uuid';

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

/**
 * @public
 * @returns Universal Unique ID string
 */
export const UUID = () => v4();

/**
 * convert params to path.
 * Path is splitted by `/`.
 * Escape to `\/` if a param including `/`.
 * @public
 */
export const encodePath = (...params: any[]): string =>
  params.map((param) => `${param}`.replace(/\//g, '\\/')).join('/');

/**
 * convert path to params.
 * Path is splitted by `/`.
 * Escape to `\/` if a param including `/`.
 * @public
 */
export const decodePath = (path: string): string[] =>
  path.split(/(?<!\\)\//g).map((x) => x.replace(/\\\//g, '/'));
