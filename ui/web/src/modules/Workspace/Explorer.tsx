import {
  IconCopy,
  IconDelete,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconForward,
  IconImport,
  IconLoading,
  IconMore,
  IconSend,
} from '@douyinfe/semi-icons';
import { Button, Dropdown, Modal, Space, Toast, Tree } from '@douyinfe/semi-ui';
import { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree/interface';
import { formatTime } from '@yuants/data-model';
import copy from 'copy-to-clipboard';
import { t } from 'i18next';
import { useObservableState } from 'observable-hooks';
import path from 'path-browserify';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { filter, from, lastValueFrom, map, mergeMap, toArray } from 'rxjs';
import { unzip } from 'unzipit';
import { agentConf$, reloadSchemaAction$ } from '../Agent/AgentConfForm';
import { writeManifestsFromBatchTasks } from '../Agent/utils';
import { executeCommand, registerCommand } from '../CommandCenter';
import { installExtensionFromTgz } from '../Extensions/utils';
import { FsBackend$, fs, workspaceRoot$ } from '../FileSystem/api';
import { showForm } from '../Form';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { currentHostConfig$ } from '../Workbench/model';
import { sendFileByAirdrop } from './airdrop';

registerPage('Explorer', () => {
  const { t } = useTranslation('Explorer');
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
                        <Dropdown.Title>{t('open')}</Dropdown.Title>
                        {data.key.match(/\.ts$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              agentConf$.next({ ...agentConf$.value, entry: data.key });
                              reloadSchemaAction$.next();
                              executeCommand('AgentConfForm');
                            }}
                          >
                            {t('open_as_agent')}
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.fund\.json$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              executeCommand('RealtimeAsset', { filename: data.key });
                            }}
                          >
                            {t('open_as_fund')}
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.batch\.ts$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              executeCommand('AgentBatchBackTest', { filename: data.key });
                            }}
                          >
                            {t('open_as_batch_backtest')}
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.batch\.ts$/) && !!currentHostConfig$.value ? (
                          <Dropdown.Item
                            onClick={async () => {
                              await writeManifestsFromBatchTasks(data.key, currentHostConfig$.value?.HV_URL!);
                              Toast.success(t('common:succeed'));
                            }}
                          >
                            {t('open_as_batch_agent_manifest')}
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.?manifests\.(json|yaml|yml|ts)$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              executeCommand('DeployConfigForm', { filename: data.key });
                            }}
                          >
                            {t('open_as_manifests')}
                          </Dropdown.Item>
                        ) : null}
                        {data.key.match(/\.tgz$/) ? (
                          <Dropdown.Item
                            onClick={() => {
                              installExtensionFromTgz(data.key);
                            }}
                          >
                            {t('open_as_extension_package')}
                          </Dropdown.Item>
                        ) : null}
                        <Dropdown.Divider />
                        <Dropdown.Title>{t('actions')}</Dropdown.Title>
                        <Dropdown.Item
                          icon={<IconCopy />}
                          onClick={() => {
                            copy(data.key);
                            Toast.success(t('common:copied'));
                          }}
                        >
                          {t('copy_filename')}
                        </Dropdown.Item>
                        {isLeaf ? null : (
                          <Dropdown.Item
                            icon={<IconFile />}
                            onClick={() => {
                              executeCommand('CreateFile', { baseDir: data.key });
                            }}
                          >
                            {t('create_file')}
                          </Dropdown.Item>
                        )}
                        {isLeaf ? null : (
                          <Dropdown.Item
                            icon={<IconFolder />}
                            onClick={() => {
                              executeCommand('CreateDirectory', { baseDir: data.key });
                            }}
                          >
                            {t('create_directory')}
                          </Dropdown.Item>
                        )}
                        <Dropdown.Item disabled icon={<IconForward />}>
                          {t('move')}
                        </Dropdown.Item>
                        <Dropdown.Item
                          type="danger"
                          icon={<IconDelete />}
                          onClick={async () => {
                            if (
                              !confirm(
                                t('delete_confirm', {
                                  path: data.key,
                                  interpolation: { escapeValue: false },
                                }),
                              )
                            ) {
                              return;
                            }
                            await fs.rm(data.key);
                            Toast.success(t('common:succeed'));
                          }}
                        >
                          {t('delete')}
                        </Dropdown.Item>
                        <Dropdown.Item
                          icon={<IconSend />}
                          disabled={!data.isLeaf || !currentHostConfig}
                          onClick={async () => {
                            if (!terminal) return;
                            const target_terminal_id = await showForm<string>({
                              type: 'string',
                              title: t('airdrop_target'),
                            });
                            if (!target_terminal_id) return;
                            sendFileByAirdrop(terminal, target_terminal_id, data.key);
                          }}
                        >
                          {t('airdrop')}
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
          executeCommand('FileEditor', { filename: path });
        }}
        treeData={[...treeData]}
      ></Tree>
    </Space>
  );
});

registerCommand('CreateFile', async ({ baseDir = '/' }) => {
  const name = await showForm<string>({
    type: 'string',
    title: t('common:CreateFile_prompt', { baseDir, interpolation: { escapeValue: false } }),
  });
  if (name) {
    const filename = path.join(baseDir, name);
    await fs.writeFile(filename, '');
    Toast.success(t('common:CreateFile_succeed', { filename, interpolation: { escapeValue: false } }));
  }
});

registerCommand('CreateDirectory', async ({ baseDir = '/' }) => {
  const name = await showForm<string>({
    type: 'string',
    title: t('common:CreateDirectory_prompt', { baseDir, interpolation: { escapeValue: false } }),
  });
  if (name) {
    const thePath = path.join(baseDir, name);
    await fs.mkdir(thePath);
    Toast.success(
      t('common:CreateDirectory_succeed', { path: thePath, interpolation: { escapeValue: false } }),
    );
  }
});
