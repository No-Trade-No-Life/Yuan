import { Actions, TabNode } from 'flexlayout-react';
import { Range } from 'monaco-editor';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ReplaySubject, Subject, bufferTime, filter } from 'rxjs';
import { layoutModel$ } from '../../layout-model';
import { MonacoEditor } from '../Editor/Monaco';

const error = console.error.bind(console);
console.error = (...params: any[]) => {
  log$.next(`[Error] ${params.join(' ')}`);
  error(...params);
};
const warn = console.warn.bind(console);
console.warn = (...params: any[]) => {
  log$.next(`[Warn] ${params.join(' ')}`);
  warn(...params);
};
const info = console.info.bind(console);
console.info = (...params: any[]) => {
  log$.next(params.join(' '));
  info(...params);
};
// console.debug, console.log 不覆盖

const log$ = new ReplaySubject<string>(1000);
export const clearLogAction$ = new Subject<void>();

export const Program = React.memo((props: { node?: TabNode }) => {
  const { t } = useTranslation();
  useEffect(() => {
    if (props.node) {
      layoutModel$.value.doAction(Actions.renameTab(props.node.getId(), t('Program')));
    }
  }, [t]);

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
