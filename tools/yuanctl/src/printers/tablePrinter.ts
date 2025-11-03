export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  format?: (value: any, row: T) => string;
  width?: number;
}

export interface TablePrinterOptions {
  noHeaders?: boolean;
  wide?: boolean;
}

const toKey = (key: TableColumn<any>['key']) => String(key);

const stringValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export class TablePrinter<T extends object> {
  constructor(
    private readonly columns: TableColumn<T>[],
    private readonly options: TablePrinterOptions = {},
  ) {}

  print(rows: T[]): void {
    const widths = this.columns.map((column) => {
      const headerWidth = column.header.length;
      const cellWidths = rows.map((row) => this.renderCell(column, row).length);
      return Math.max(headerWidth, ...cellWidths);
    });
    const lines: string[] = [];
    if (!this.options.noHeaders) {
      const headerCells = this.columns.map((column, idx) => pad(column.header, widths[idx]));
      lines.push(headerCells.join('  '));
    }
    for (const row of rows) {
      const cells = this.columns.map((column, idx) => {
        const rendered = this.renderCell(column, row);
        return pad(rendered, widths[idx]);
      });
      lines.push(cells.join('  '));
    }
    const output = lines.join('\n');
    console.log(output);
  }

  private renderCell(column: TableColumn<T>, row: T): string {
    const key = column.key;
    const rawValue =
      typeof key === 'string'
        ? (row as any)[key]
        : key in row
        ? (row as any)[key as keyof T]
        : (row as any)[toKey(key)];
    const formatted = column.format ? column.format(rawValue, row) : stringValue(rawValue);
    if (column.width && formatted.length > column.width) {
      return formatted.slice(0, column.width - 1) + '…';
    }
    return formatted;
  }
}

const pad = (value: string, width: number): string => {
  if (value.length >= width) return value;
  return value + ' '.repeat(width - value.length);
};
