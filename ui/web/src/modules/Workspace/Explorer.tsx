import {
  IconCopy,
  IconDelete,
  IconEdit,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconImport,
  IconLoading,
  IconMore,
  IconSend,
} from '@douyinfe/semi-icons';
import { Button, Dropdown, Modal, Space, Toast, Tree } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree/interface';
import copy from 'copy-to-clipboard';
import * as FlexLayout from 'flexlayout-react';
import { DockLocation } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import path from 'path-browserify';
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { filter, from, lastValueFrom, map, mergeMap, toArray } from 'rxjs';
import { unzip } from 'unzipit';
import { terminal$ } from '../../common/create-connection';
import { layoutModel$ } from '../../layout-model';
import { agentConf$, reloadSchemaAction$ } from '../Agent/AgentConfForm';
import { writeManifestsFromBatchTasks } from '../Agent/utils';
import { openFileEditor } from '../Editor/FileEditor';
import { installExtensionFromTgz } from '../Extensions/utils';
import { FsBackend$, fs, workspaceRoot$ } from '../FileSystem/api';
import { currentHostConfig$ } from '../Workbench/model';
import { sendFileByAirdrop } from './airdrop';

export const Explorer = React.memo((props: { node?: FlexLayout.TabNode }) => {
  const model = useObservableState(layoutModel$);
  const terminal = useObservableState(terminal$);
  const currentHostConfig = useObservableState(currentHostConfig$);

  const initialData: TreeNodeData[] = [
    {
      label: '/',
      key: '/',
    },
  ];
  const [treeData, setTreeData] = useState(initialData);
  const [treeKey, setTreeKey] = useState(0);

  const { t } = useTranslation('Explorer');

  useEffect(() => {
    if (props.node) {
      model.doAction(FlexLayout.Actions.renameTab(props.node.getId(), t('common:Explorer')));
    }
  }, [t]);

  useEffect(() => {
    const sub = FsBackend$.subscribe(() => {
      setTreeData(initialData);
      setTreeKey((i) => i + 1);
    });
    return () => {
      sub.unsubscribe();
    };
  }, []);

  function updateTreeData(list: TreeNodeData[], key: string, children: TreeNodeData[]): TreeNodeData[] {
    return list.map((node) => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });
  }

  const handleLoadData = async (node?: TreeNodeData) => {
    if (!node) {
      return;
    }
    const nodes = await lastValueFrom(
      from(fs.stat(node.key)).pipe(
        filter((s) => s.isDirectory()),
        mergeMap(() => fs.readdir(node.key)),
        mergeMap((v) => v),
        mergeMap((name) => {
          const _path = path.posix.join(node.key, name);
          return from(fs.stat(_path)).pipe(
            //
            map((stats) => ({ label: name, key: _path, isLeaf: stats.isFile() })),
          );
        }),
        toArray(),
        map((x) => x.sort((a, b) => +a.isLeaf - +b.isLeaf || a.label.localeCompare(b.label))),
      ),
    );
    setTreeData((origin) => updateTreeData(origin, node.key, nodes));
  };

  const connectToWorkspace = async () => {
    Modal.confirm({
      title: t('request_fs_permission'),
      content: <Trans t={t} i18nKey={'request_fs_permission_note'} />,
      okText: t('agree'),
      cancelText: t('disagree'),
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
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Button disabled={!window.showDirectoryPicker} icon={<IconFolderOpen />} onClick={connectToWorkspace}>
          {t('open_new')}
        </Button>
        <Button
          icon={<IconImport />}
          onClick={async () => {
            const res = await unzip(`https://y.ntnl.io/Yuan-Public-Workspace/Yuan-Public-Workspace-main.zip`);
            for (const [filename, entry] of Object.entries(res.entries)) {
              if (!entry.isDirectory) {
                const thePath = path.resolve('/', filename);
                if (thePath[0] === '/') {
                  await fs.ensureDir(path.dirname(thePath));
                  fs.writeFile(thePath, await entry.blob());
                  console.info(
                    formatTime(Date.now()),
                    t('common:file_written', { filename: thePath, interpolation: { escapeValue: false } }),
                  );
                }
              }
            }
            Toast.success(t('import_examples_succeed'));
          }}
        >
          {t('import_examples')}
        </Button>
      </Space>
      <Tree
        key={treeKey}
        loadData={handleLoadData}
        loadedKeys={[]}
        style={{ width: '100%' }}
        renderFullLabel={({ className, onExpand, onClick, data, expandStatus }) => {
          const { label, isLeaf } = data;
          return (
            <li className={className} role="treeitem" onClick={isLeaf ? onClick : onExpand}>
              <Space style={{ width: '100%' }}>
                {isLeaf ? (
                  <IconFile />
                ) : expandStatus.loading ? (
                  <IconLoading />
                ) : expandStatus.expanded ? (
                  <IconFolderOpen />
                ) : (
                  <IconFolder />
                )}
                <span>{label}</span>
                <Dropdown
                  content={
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Dropdown.Menu>
                        <Dropdown.Item
                          icon={<IconCopy />}
                          onClick={() => {
                            copy(data.key);
                            Toast.success(`复制到剪贴板: ${data.key}`);
                          }}
                        >
                          复制路径
                        </Dropdown.Item>
                        {isLeaf ? null : (
                          <Dropdown.Item
                            icon={<IconFile />}
                            onClick={async () => {
                              const name = prompt(`于 ${data.key} 目录下创建文件，请输入文件名`);
                              if (name) {
                                const thePath = path.join(data.key, name);
                                await fs.writeFile(thePath, '');
                                Toast.success(`创建文件成功: ${thePath}`);
                              }
                            }}
                          >
                            创建文件...
                          </Dropdown.Item>
                        )}
                        {isLeaf ? null : (
                          <Dropdown.Item
                            icon={<IconFolder />}
                            onClick={async () => {
                              const name = prompt(`于 ${data.key} 目录下创建目录，请输入目录名`);
                              if (name) {
                                const thePath = path.join(data.key, name);
                                await fs.mkdir(thePath);
                                Toast.success(`创建目录成功: ${thePath}`);
                              }
                            }}
                          >
                            创建目录...
                          </Dropdown.Item>
                        )}
                        <Dropdown.Divider />
                        {data.key.match(/\.ts$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              agentConf$.next({ ...agentConf$.value, entry: data.key });
                              reloadSchemaAction$.next();
                              layoutModel$.value.doAction(FlexLayout.Actions.selectTab('AgentConfForm'));
                            }}
                          >
                            作为模型
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.json$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              model.doAction(
                                FlexLayout.Actions.addNode(
                                  {
                                    type: 'tab',
                                    name: `实时资产`,
                                    component: 'RealtimeAsset',
                                    config: { filename: data.key },
                                  },
                                  '#main',
                                  DockLocation.CENTER,
                                  0,
                                ),
                              );
                            }}
                          >
                            作为基金结算配置
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.batch.ts$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              model.doAction(
                                FlexLayout.Actions.addNode(
                                  {
                                    type: 'tab',
                                    name: `批量回测`,
                                    component: 'AgentBatchBackTest',
                                    config: { filename: data.key },
                                  },
                                  '#main',
                                  DockLocation.CENTER,
                                  0,
                                ),
                              );
                            }}
                          >
                            作为批量回测配置
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.batch\.ts$/) && !!currentHostConfig$.value ? (
                          <Dropdown.Item
                            onClick={async () => {
                              await writeManifestsFromBatchTasks(data.key, currentHostConfig$.value?.HV_URL!);
                              Toast.success(`生成部署配置成功`);
                            }}
                          >
                            生成部署配置
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.?manifests\.(json|yaml|yml|ts)$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              model.doAction(
                                FlexLayout.Actions.addNode(
                                  {
                                    type: 'tab',
                                    name: `部署配置`,
                                    component: 'DeployConfigForm',
                                    config: { filename: data.key },
                                  },
                                  '#main',
                                  DockLocation.CENTER,
                                  0,
                                ),
                              );
                            }}
                          >
                            作为部署配置
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.tgz$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              installExtensionFromTgz(data.key);
                            }}
                          >
                            安装拓展
                          </Dropdown.Item>
                        ) : null}
                        <Dropdown.Divider />
                        <Dropdown.Item disabled icon={<IconEdit />}>
                          重命名
                        </Dropdown.Item>
                        <Dropdown.Item
                          type="danger"
                          icon={<IconDelete />}
                          onClick={async () => {
                            if (!confirm(`递归删除 ${data.key}，此操作无法恢复`)) {
                              return;
                            }
                            await fs.rm(data.key);
                            Toast.success(`删除成功 ${data.key}`);
                          }}
                        >
                          删除
                        </Dropdown.Item>
                        <Dropdown.Item
                          icon={<IconSend />}
                          disabled={!data.isLeaf || !currentHostConfig}
                          onClick={() => {
                            if (!terminal) return;
                            const target_terminal_id = prompt('投送目标终端');
                            if (!target_terminal_id) return;
                            sendFileByAirdrop(terminal, target_terminal_id, data.key);
                          }}
                        >
                          隔空投递
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </div>
                  }
                >
                  <IconMore style={{ marginLeft: 'auto', marginRight: '1em' }} />
                </Dropdown>
              </Space>
            </li>
          );
        }}
        onSelect={(path) => {
          openFileEditor(path);
        }}
        treeData={[...treeData]}
      ></Tree>
    </Space>
  );
});
