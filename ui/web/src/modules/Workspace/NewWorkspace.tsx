import { IconFolderOpen } from '@douyinfe/semi-icons';
import { Button, Modal, Typography } from '@douyinfe/semi-ui';
import { workspaceRoot$ } from '../FileSystem/api';

export const NewWorkspaceButton = () => {
  const connectToWorkspace = async () => {
    Modal.confirm({
      title: '本地目录授权',
      content: (
        <>
          <Typography.Text>
            <p>Yuan 将会在您的授权下访问您本地计算机的工作区。</p>
            <p>工作区存储了您的产出(策略与指标)及其运行所需的配置。</p>
            <p>您的任何代码产出都不会上传至服务器，非常安全。</p>
            <p>在开始之前，我们需要获得您的授权。</p>
          </Typography.Text>
          <Typography.Text size="small">
            <p>得益于 Web 技术的发展，我们有办法直接在浏览器中连接到您本地的文件目录，而无须您打包上传。</p>
            <p>
              您可以选择任意方式在各个计算机之间同步该工作区，例如 Git, Dropbox, OneDrive, Google Drive
              甚至用U盘拷贝。
            </p>
            <p>对目录的访问授权仅会有效至 Yuan 的所有标签页被关闭，下次打开 Yuan 需要重新授权。</p>
            <br />
            <p>需要 Chrome 86 / Edge 86 及其以上版本浏览器</p>
          </Typography.Text>
        </>
      ),
      okText: '同意并继续',
      cancelText: '不同意',
      onOk: async () => {
        const root: FileSystemDirectoryHandle = await showDirectoryPicker({
          mode: 'readwrite',
        });
        await root.requestPermission({ mode: 'readwrite' });
        workspaceRoot$.next(root);
      },
    });
  };

  return (
    <Button icon={<IconFolderOpen />} onClick={connectToWorkspace}>
      打开
    </Button>
  );
};
