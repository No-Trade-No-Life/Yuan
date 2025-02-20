import { Space } from '@douyinfe/semi-ui';
import { ColumnDef } from '@tanstack/react-table';
import { UUID } from '@yuants/data-model';
import '@yuants/sql';
import { editor } from 'monaco-editor';
import { useMemo, useRef, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { MonacoEditor } from '../Editor/Monaco';
import { Button, DataView, Toast } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { terminal$ } from '../Terminals';

registerCommand('SQL/Console/New', () => executeCommand('SQLConsole', { id: UUID() }));

registerPage('SQLConsole', () => {
  const { id } = usePageParams() as { id: string };
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [data, setData] = useState([] as any[]);
  const columns = useMemo(() => {
    const a = data[0] || {};
    return Object.entries(a).map(([key, value]): ColumnDef<any, any> => ({ header: key, accessorKey: key }));
  }, [data]);
  return (
    <Space vertical align="start" style={{ width: '100%', height: '100%' }}>
      <Space>
        <Button
          onClick={async () => {
            try {
              const terminal = await firstValueFrom(terminal$);
              if (!terminal) throw 'Terminal not found';
              const query = editorRef.current?.getValue();
              if (!query) throw 'Empty query';
              const t = Date.now();
              const res = await terminal.requestForResponse('SQL', { query });
              if (res.code === 0 && res.data) {
                setData(res.data);
              } else {
                throw res.message;
              }
              editorRef.current?.setValue(
                editorRef.current.getValue() + '\n' + `/* DONE in ${Date.now() - t} ms */`,
              );
            } catch (e) {
              editorRef.current?.setValue(
                editorRef.current.getValue() + '\n' + '/* ERROR: ' + `${e}` + ' */',
              );
            }
          }}
        >
          执行
        </Button>
      </Space>
      <div style={{ width: '100%', height: '40%' }}>
        <MonacoEditor
          language="sql"
          value=""
          onConstruct={(editor) => {
            editorRef.current = editor;
          }}
        />
      </div>
      <div style={{ width: '100%' }}>
        <DataView data={data} columns={columns} columnsDependencyList={[data]} />
      </div>
    </Space>
  );
});
