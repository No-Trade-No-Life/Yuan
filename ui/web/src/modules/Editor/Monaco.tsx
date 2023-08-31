import * as monaco from 'monaco-editor';
import { useObservableState } from 'observable-hooks';
import React, { FC, useEffect, useRef } from 'react';
import { isDarkMode$ } from '../../common/Darkmode';

export const MonacoEditor: FC<{
  value: string;
  language?: string;
  onConstruct?: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}> = React.memo((props) => {
  const containerRef = useRef<any>();

  const darkmode = useObservableState(isDarkMode$);

  useEffect(() => {
    const editor = monaco.editor.create(containerRef.current, {
      value: props.value,
      language: props.language,
      automaticLayout: true,
      theme: darkmode ? 'vs-dark' : 'vs',
      fixedOverflowWidgets: true,
    });
    props.onConstruct?.(editor);
    editor.onDidBlurEditorText(() => {});
    return () => {
      editor.dispose();
    };
  }, [darkmode, props.value]);

  return <div style={{ width: '100%', height: '100%' }} ref={containerRef}></div>;
});
