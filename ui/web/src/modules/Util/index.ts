import { stringify } from 'csv-stringify/browser/esm/sync';
import { parse } from 'csv-parse/browser/esm/sync';

export const CSV = {
  parse: <T = any>(csvString: string): T[] => {
    return parse(csvString, { columns: true });
  },
  stringify: (data: any[]) => {
    return stringify(data, { header: true });
  },
};
