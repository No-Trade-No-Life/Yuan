import { Modal, Toast } from '@douyinfe/semi-ui';
import { Terminal } from '@yuants/protocol';
import { dirname } from 'path-browserify';
import { bufferTime, defer, lastValueFrom, mergeMap } from 'rxjs';
import { fs } from '../FileSystem/api';
import { terminal$ } from '../Terminals';

export const sendFileByAirdrop = async (terminal: Terminal, target_terminal_id: string, filename: string) => {
  //
  const content = await fs.readFile(filename);
  const res = await lastValueFrom(
    defer(() => terminal.request('AirDrop', target_terminal_id, { filename, content })),
  );
  if (res.res?.code === 0) {
    Toast.success(`对方接收了 ${filename}`);
  } else {
    Toast.error(`对方拒收了 ${filename}`);
  }
};

declare module '@yuants/protocol/lib/services' {
  /**
   * - AirDrop
   */
  export interface IService {
    AirDrop: {
      req: { filename: string; content: string };
      res: { code: number; message: string };
      frame: any;
    };
  }
}

terminal$.subscribe((terminal) => {
  terminal?.provideService('AirDrop', {}, (msg) =>
    defer(async () => {
      const { filename, content } = msg.req;
      const ok = await new Promise((resolve, reject) => {
        Modal.confirm({
          title: `${msg.source_terminal_id} 向您投送 ${filename}...`,
          content: content.slice(0, 200) + '...',
          cancelText: '拒绝',
          okText: '接收',
          onOk: () => {
            resolve(true);
          },
          onCancel: () => {
            resolve(false);
          },
        });
      });
      if (!ok) {
        return { res: { code: 403, message: '对方拒收了' } };
      }
      await fs.ensureDir(dirname(filename));
      await fs.writeFile(filename, content);
      return { res: { code: 0, message: 'OK' } };
    }).pipe(
      bufferTime(2000),
      mergeMap((res) => (res.length === 0 ? [{ frame: {} }] : res)),
    ),
  );
});
