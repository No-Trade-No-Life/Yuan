import { formatTime } from '@yuants/utils';
import Papa from 'papaparse';
import { fs } from '../FileSystem';

export const CSV = {
  readFile: async <T = any>(filename: string): Promise<T[]> => {
    const t = Date.now();
    const file = await fs.readFileAsBlob(filename);
    const records: T[] = [];
    const fileSize = file.size;
    await new Promise((resolve) => {
      Papa.parse(file as File, {
        header: true,
        worker: true,
        step: (results) => {
          records.push(results.data as T);
        },
        complete: (results) => {
          resolve(void 0);
        },
      });
    });

    console.info(
      formatTime(Date.now()),
      `CSV.readFile: ${filename}, ${fileSize} bytes, ${records.length} records for ${Date.now() - t}ms`,
    );
    return records;
  },
  parse: <T = any>(csvString: string): T[] => {
    return Papa.parse<T>(csvString, { header: true }).data;
  },
  stringify: (data: any[]) => {
    return Papa.unparse(data, { header: true });
  },
};
