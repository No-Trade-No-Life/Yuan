import { Toast } from '@douyinfe/semi-ui';
import { Actions, DockLocation, TabNode } from 'flexlayout-react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { useObservable, useObservableState } from 'observable-hooks';
import React, { useEffect, useRef, useState } from 'react';
import { BehaviorSubject, defer, mergeMap, pipe, retry, tap } from 'rxjs';
import { isDarkMode$ } from '../../common/Darkmode';
import { layoutModel$ } from '../../layout-model';
import { rollupLoadEvent$ } from '../Agent/utils';
import { fs } from '../FileSystem/api';

Object.assign(globalThis, { monaco });

const fileSaveState$ = new BehaviorSubject({} as Record<string, string>);

monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  baseUrl: 'file:///',
});

monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
  allowComments: true,
  trailingCommas: 'ignore',
});

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    if (label === 'json') {
      return new jsonWorker();
    }
    return new editorWorker();
  },
};

rollupLoadEvent$.subscribe(({ id, content }) => {
  try {
    const uri = monaco.Uri.file(id);
    // ISSUE: 过度添加 Model 会导致 "[g7a] REFUSES to accept new listeners because it exceeded its threshold by far"
    if (monaco.editor.getModel(uri) === null) {
      monaco.editor.createModel(content, undefined, uri);
    }
  } catch (e) {
    //
  }
});

export const openFileEditor = (filename: string) => {
  layoutModel$.value.doAction(
    Actions.addNode(
      {
        type: 'tab',
        name: '代码',
        component: 'FileEditor',
        config: { filename: filename },
      },
      '#main',
      DockLocation.CENTER,
      0,
    ),
  );
};

export const FileEditor = React.memo((props: { node?: TabNode }) => {
  const [filename, setFilename] = useState<string>(props.node?.getConfig()?.filename ?? '');
  const uri = monaco.Uri.file(filename);
  const model = monaco.editor.getModel(uri);

  const fileSaveState = useObservableState(fileSaveState$);

  // Auto Load Filename Content
  useObservableState(
    useObservable(
      pipe(
        //
        mergeMap(([filename]) =>
          defer(() => fs.readFile(filename)).pipe(
            tap((content) => {
              const uri = monaco.Uri.file(filename);
              const model = monaco.editor.getModel(uri);
              if (!model) {
                const model = monaco.editor.createModel(content, undefined, uri);
                if (fileSaveState$.value[filename] === undefined) {
                  const nextFileSaveState = {
                    ...fileSaveState$.value,
                    [filename]: model.getValue(),
                  };
                  fileSaveState$.next(nextFileSaveState);
                }
              }
            }),
            retry({ delay: 1000 }),
          ),
        ),
      ),
      [filename],
    ),
  );

  useEffect(() => {
    if (props.node) {
      const current = monaco.editor.getModel(monaco.Uri.file(filename))?.getValue();
      const last = fileSaveState[filename];
      layoutModel$.value.doAction(
        Actions.renameTab(props.node.getId(), last !== current ? filename + '*' : filename),
      );
    }
  }, [filename, fileSaveState]);

  const containerRef = useRef<any>();
  const [editor, setEditor] = useState<monaco.editor.IStandaloneCodeEditor | null>(null);

  const darkmode = useObservableState(isDarkMode$);

  useEffect(() => {
    const editor = monaco.editor.create(containerRef.current, {
      model: null,
      automaticLayout: true,
      theme: darkmode ? 'vs-dark' : 'vs',
      fixedOverflowWidgets: true,
    });
    setEditor(editor);
    return () => {
      setEditor(null);
      editor.dispose();
    };
  }, []);

  useObservableState(
    useObservable(() =>
      defer(() => fs.readFile('/global.d.ts')).pipe(
        //
        retry({ delay: 1000 }),
        tap((content) => {
          monaco.languages.typescript.typescriptDefaults.addExtraLib(content, 'global.d.ts');
        }),
      ),
    ),
  );

  useEffect(() => {
    editor?.setModel(model);
  }, [editor, model]);

  useEffect(() => {
    editor?.updateOptions({ theme: darkmode ? 'vs-dark' : 'vs' });
  }, [editor, darkmode]);

  useEffect(() => {
    editor?.addAction({
      id: 'save',
      label: 'Save',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: async () => {
        const model = editor.getModel();
        if (model) {
          const filename = model.uri.path;
          const code = model.getValue();
          if (code) {
            await fs.writeFile(filename, code);
            const fileSaveState = {
              ...fileSaveState$.value,
              [filename]: code,
            };
            fileSaveState$.next(fileSaveState);
            Toast.success(`保存成功 ${filename}`);
          }
        }
      },
    });
  }, [editor]);

  useEffect(() => {
    editor?.addAction({
      id: 'close',
      label: 'Close',
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyW],
      run: async () => {
        const nodeId = props.node?.getId();
        // console.info(new Date(), `closing tab ${nodeId} ${filename}`);
        if (nodeId) {
          layoutModel$.value.doAction(Actions.deleteTab(nodeId));
        }
      },
    });
  }, [editor]);

  useEffect(() => {
    editor?.onDidChangeModel((e) => {
      const filename = editor.getModel()?.uri.path;
      if (filename) {
        setFilename(filename);
      }
    });
  }, [editor]);

  useEffect(() => {
    editor?.onDidChangeModelContent((e) => {
      const filename = editor.getModel()?.uri.path;
      if (filename) {
        fileSaveState$.next({ ...fileSaveState$.value });
      }
    });
  }, [editor]);

  // Auto Reload File content from disk
  useEffect(() => {
    const observer = new IntersectionObserver(async (e) => {
      if (e[0].intersectionRatio > 0) {
        await reloadFromDisk(filename);
      }
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
    };
  }, [filename]);

  useEffect(() => {
    const listener = () => {
      if (!document.hidden) {
        reloadFromDisk(filename);
      }
    };
    document.addEventListener('visibilitychange', listener);
    return () => {
      document.removeEventListener('visibilitychange', listener);
    };
  }, [filename]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden' }}></div>;
});

const reloadFromDisk = async (filename: string) => {
  const model = monaco.editor.getModel(monaco.Uri.file(filename));
  if (model) {
    const fileSaveState = fileSaveState$.value[filename];
    if (!fileSaveState) {
      return;
    }
    const last = fileSaveState;
    const current = model.getValue();
    // 仅当文件未被修改时才重新加载
    if (last === current) {
      const code = await fs.readFile(filename);
      model.setValue(code);
      fileSaveState$.next({
        ...fileSaveState$.value,
        [filename]: code,
      });
    }
  }
};

monaco.editor.registerEditorOpener({
  openCodeEditor(editor, resource, selectionOrPosition) {
    // console.log(source, resource, selectionOrPosition);
    editor.setModel(monaco.editor.getModel(resource));
    if (selectionOrPosition instanceof monaco.Range) {
      editor.revealRange(selectionOrPosition);
    }
    return false;
  },
});
