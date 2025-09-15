import { Modal, Toast } from '@douyinfe/semi-ui';
import { Terminal } from '@yuants/protocol';
import { dirname } from 'path-browserify';
import { defer, lastValueFrom } from 'rxjs';
import { fs } from '../FileSystem/api';
import { blobToDataURL, dataURLToBlob } from '../FileSystem/utils';
import { terminal$ } from '../Terminals';

export const sendFileByAirdrop = async (terminal: Terminal, target_terminal_id: string, filename: string) => {
  //
  const blob = await fs.readFileAsBlob(filename);
  const content = await blobToDataURL(blob);
  const res = await lastValueFrom(
    defer(() => terminal.client.request('AirDrop', target_terminal_id, { filename, content })),
  );
  if (res.res?.code === 0) {
    Toast.success(`对方接收了 ${filename}`);
  } else {
    Toast.error(`对方拒收了 ${filename}`);
  }
};

terminal$.subscribe((terminal) => {
  terminal?.server.provideService<{ filename: string; content: string }, { code: number; message: string }>(
    'AirDrop',
    {},
    async (msg) => {
      const { filename, content } = msg.req;
      const ok = await new Promise((resolve, reject) => {
        Modal.confirm({
          title: `${msg.source_terminal_id} 向您投送 ${filename}...`,
          content: content.slice(0, 20) + '...',
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
      const blob = await dataURLToBlob(content);
      await fs.writeFile(filename, blob);
      return { res: { code: 0, message: 'OK' } };
    },
  );
});
