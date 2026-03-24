import { TablePrinter, type TableColumn } from '../printers/tablePrinter';
import type { YuanctlCommandError } from './error';

export type YuanctlOutputFormat = 'table' | 'json';

export interface YuanctlCommandResult<T = unknown> {
  ok: true;
  kind: string;
  data: T;
  meta?: {
    warnings?: string[];
    next?: string[];
  };
}

export interface YuanctlPrinter {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

type ColumnLike = TableColumn<Record<string, unknown>>;

const writeJson = (printer: YuanctlPrinter, value: unknown) => {
  printer.stdout(`${JSON.stringify(value, null, 2)}\n`);
};

const writeText = (printer: YuanctlPrinter, text: string) => {
  printer.stdout(text.endsWith('\n') ? text : `${text}\n`);
};

const pickColumns = (rows: Array<Record<string, unknown>>, preferred?: string[]): ColumnLike[] => {
  const keys = preferred && preferred.length > 0 ? preferred : Object.keys(rows[0] ?? {});
  return keys.map((key) => ({ key, header: key.toUpperCase() }));
};

const renderRowsAsTable = (
  printer: YuanctlPrinter,
  rows: Array<Record<string, unknown>>,
  preferred?: string[],
): void => {
  if (rows.length === 0) {
    writeText(printer, '(empty)');
    return;
  }
  const columns = pickColumns(rows, preferred);
  const lines: string[] = [];
  const restore = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map((item) => String(item)).join(' '));
  };
  try {
    new TablePrinter(columns).print(rows);
  } finally {
    console.log = restore;
  }
  writeText(printer, lines.join('\n'));
};

export const renderResult = (
  printer: YuanctlPrinter,
  result: YuanctlCommandResult,
  format: YuanctlOutputFormat,
): void => {
  if (format === 'json') {
    writeJson(printer, result);
    return;
  }

  switch (result.kind) {
    case 'config.template':
    case 'deploy.logs':
      writeText(printer, String(result.data));
      return;
    case 'deploy.list':
      renderRowsAsTable(printer, result.data as Array<Record<string, unknown>>, [
        'id',
        'package_name',
        'package_version',
        'enabled',
        'address',
        'updated_at',
      ]);
      return;
    case 'deploy.inspect':
      renderRowsAsTable(printer, [result.data as Record<string, unknown>]);
      return;
    case 'config.current':
      renderRowsAsTable(
        printer,
        [result.data as Record<string, unknown>],
        ['currentContextName', 'hostName', 'hostUrl', 'terminalId'],
      );
      return;
    case 'config.contexts':
      renderRowsAsTable(printer, result.data as Array<Record<string, unknown>>, [
        'name',
        'host',
        'terminal_id',
      ]);
      return;
    case 'mutation.summary':
      renderRowsAsTable(printer, [result.data as Record<string, unknown>], ['action', 'target', 'count']);
      return;
    default:
      if (Array.isArray(result.data)) {
        renderRowsAsTable(printer, result.data as Array<Record<string, unknown>>);
        return;
      }
      if (result.data && typeof result.data === 'object') {
        renderRowsAsTable(printer, [result.data as Record<string, unknown>]);
        return;
      }
      writeText(printer, String(result.data));
  }
};

export const renderError = (
  printer: YuanctlPrinter,
  error: YuanctlCommandError,
  format: YuanctlOutputFormat,
): void => {
  if (format === 'json') {
    printer.stderr(`${JSON.stringify(error, null, 2)}\n`);
    return;
  }
  const details = error.error.details ? ` ${JSON.stringify(error.error.details)}` : '';
  printer.stderr(`[${error.error.code}] ${error.error.message}${details}\n`);
};
