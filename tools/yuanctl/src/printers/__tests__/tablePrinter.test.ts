import { TablePrinter } from '../../printers/tablePrinter';

describe('TablePrinter', () => {
  it('renders table output', () => {
    const printer = new TablePrinter<{ name: string; version: string }>([
      { key: 'name', header: 'NAME' },
      { key: 'version', header: 'VERSION' },
    ]);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    printer.print([
      { name: 'alpha', version: '1.0.0' },
      { name: 'beta', version: '1.1.0' },
    ]);
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
