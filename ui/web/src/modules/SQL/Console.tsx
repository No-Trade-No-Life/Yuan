import { IconPlay } from '@douyinfe/semi-icons';
import { Space, Typography } from '@douyinfe/semi-ui';
import { ColumnDef } from '@tanstack/react-table';
import '@yuants/sql';
import { UUID } from '@yuants/utils';
import { editor } from 'monaco-editor';
import { useMemo, useRef, useState } from 'react';
import { firstValueFrom } from 'rxjs';
import { executeCommand, registerCommand } from '../CommandCenter';
import { MonacoEditor } from '../Editor/Monaco';
import { Button, DataView } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { terminal$ } from '../Terminals';
import { requestSQL } from '@yuants/sql';

registerCommand('SQL/Console/New', () => executeCommand('SQLConsole', { id: UUID() }));

registerPage('SQLConsole', () => {
  const { id } = usePageParams() as { id: string };
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [data, setData] = useState([] as any[]);
  const [message, setMessage] = useState('');
  const columns = useMemo(() => {
    const a = data[0] || {};
    return Object.entries(a).map(([key, value]): ColumnDef<any, any> => ({ header: key, accessorKey: key }));
  }, [data]);
  return (
    <Space align="start" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: '40%', height: '100%' }}>
        <MonacoEditor
          language="sql"
          value=""
          onConstruct={(editor) => {
            editorRef.current = editor;
          }}
        />
      </div>
      <div style={{ height: '100%', flexGrow: 1, overflow: 'auto' }}>
        <DataView
          data={data}
          columns={columns}
          columnsDependencyList={[data]}
          topSlot={
            <>
              <Button
                icon={<IconPlay />}
                onClick={async () => {
                  try {
                    const terminal = await firstValueFrom(terminal$);
                    if (!terminal) throw 'Terminal not found';
                    const query = editorRef.current?.getValue();
                    if (!query) throw 'Empty query';
                    const t = Date.now();
                    const res = await requestSQL<any[]>(terminal, query);
                    Object.assign(globalThis, { $sql: res });
                    setData(res);
                    setMessage(`DONE in ${Date.now() - t} ms`);
                  } catch (e) {
                    setMessage(`ERROR: ${e}`);
                  }
                }}
              >
                执行
              </Button>
              <Typography.Text>{message}</Typography.Text>
            </>
          }
        />
      </div>
    </Space>
  );
});
