import { Range } from 'monaco-editor';
import { useTranslation } from 'react-i18next';
import { ReplaySubject, Subject, bufferTime, filter } from 'rxjs';
import { MonacoEditor } from '../Editor/Monaco';
import { registerPage } from '../Pages';

// ISSUE: 这会使得所有日志的导出位置都是在 Program 页面，而不是在对应的模块中
// const error = console.error.bind(console);
// console.error = (...params: any[]) => {
//   log$.next(`[Error] ${params.join(' ')}`);
//   error(...params);
// };
// const warn = console.warn.bind(console);
// console.warn = (...params: any[]) => {
//   log$.next(`[Warn] ${params.join(' ')}`);
//   warn(...params);
// };
// const info = console.info.bind(console);
// console.info = (...params: any[]) => {
//   log$.next(params.join(' '));
//   info(...params);
// };
// don't override console.debug, console.log

const log$ = new ReplaySubject<string>(1000);
export const clearLogAction$ = new Subject<void>();

registerPage('Program', () => {
  const { t } = useTranslation();

  return (
    <MonacoEditor
      value=""
      onConstruct={(editor) => {
        log$
          .pipe(
            bufferTime(1000),
            filter((logs) => logs.length > 0),
          )
          .subscribe((logs) => {
            const model = editor.getModel();
            editor.updateOptions({ wordWrap: 'on' });
            if (model) {
              const lineCount = model.getLineCount();
              const lastLineLength = model.getLineMaxColumn(lineCount);

              const range = new Range(lineCount, lastLineLength, lineCount, lastLineLength); // Locate at end

              editor.executeEdits('', [{ range: range, text: logs.join('\n') + '\n' }]);
            }
          });
        clearLogAction$.subscribe(() => {
          const model = editor.getModel();
          editor.updateOptions({ wordWrap: 'on' });
          if (model) {
            const lineCount = model.getLineCount();
            const lastLineLength = model.getLineMaxColumn(lineCount);

            const range = new Range(1, 1, lineCount, lastLineLength); // Range All

            editor.executeEdits('', [{ range: range, text: '' }]);
          }
        });
      }}
    />
  );
});
