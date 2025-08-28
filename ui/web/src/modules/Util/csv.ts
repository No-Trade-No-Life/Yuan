import { formatTime } from '@yuants/utils';
import Papa from 'papaparse';
import { fs } from '../FileSystem';

const escapeCellValue = (cell: any): string => {
  if (typeof cell === 'string') {
    if (cell.includes('"') || cell.includes(',') || cell.includes('\n')) {
      return `"${cell.replace(/"/g, '""')}"`;
    } else {
      return cell;
    }
  }

  if (typeof cell === 'number') {
    return cell.toString();
  }

  if (typeof cell === 'boolean') {
    return cell ? 'true' : 'false';
  }

  if (typeof cell === 'undefined') {
    return '';
  }

  if (cell === null) {
    return '';
  }

  return escapeCellValue(JSON.stringify(cell));
};

export const CSV = {
  escapeCellValue,
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

  writeFile: async (filename: string, data: any[]): Promise<void> => {
    const writable = await fs.createWritableStream(filename);
    const headers = Object.keys(data[0] || {});

    await new ReadableStream({
      start(controller) {
        controller.enqueue(headers.map(escapeCellValue).join(',') + '\n');
        for (const row of data) {
          const line = headers.map((h) => escapeCellValue(row[h])).join(',');
          controller.enqueue(line + '\n');
        }
        controller.close();
      },
    }).pipeTo(writable);
  },

  /**
   * 通过原始表格数据写入 CSV 文件
   * @param filename 写入的文件名
   * @param data 原始表格数据
   * @param transpose 是否转置数据 (行列互换), 默认不转置
   */
  writeFileFromRawTable: async (filename: string, data: any[][], transpose = false): Promise<void> => {
    const writable = await fs.createWritableStream(filename);

    // TODO: 优化大文件写入 (使用 pull 背压 + BYOB 模式)
    await new ReadableStream({
      start(controller) {
        const [d1, d2] = [data.length, data[0]?.length || 0];
        const rows = transpose ? d2 : d1;
        const cols = transpose ? d1 : d2;

        let cnt = 0;
        const buffer = [];

        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            const str = escapeCellValue(transpose ? data[j][i] : data[i][j]);
            cnt += str.length;
            buffer.push(str);
            if (j < cols - 1) {
              cnt++;
              buffer.push(',');
            }
          }
          buffer.push('\n');
          // Flush buffer (64KB)
          if (cnt > 64 * 1024) {
            controller.enqueue(buffer.join(''));
            buffer.length = 0;
            cnt = 0;
          }
        }
        controller.enqueue(buffer.join(''));
        controller.close();
      },
    }).pipeTo(writable);
  },

  parse: <T = any>(csvString: string): T[] => {
    return Papa.parse<T>(csvString, { header: true }).data;
  },
  stringify: (data: any[]) => {
    return Papa.unparse(data, { header: true });
  },
};
