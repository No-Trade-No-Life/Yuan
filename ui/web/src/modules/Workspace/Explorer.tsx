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
import path, { dirname } from 'path-browserify';
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
import i18n from '../Locale/i18n';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { currentHostConfig$ } from '../Workbench/model';
import { sendFileByAirdrop } from './airdrop';

/**
 * File is associated with Command
 */
interface IAssociationRule {
  /** i18n_key = `association:${id}`  */
  id: string;

  match: (ctx: { path: string; isFile: boolean }) => boolean;
  action: (ctx: { path: string; isFile: boolean }) => void;
}

const rules: IAssociationRule[] = [
  {
    id: 'AgentBatchBackTest',
    match: ({ path, isFile }) => isFile && !!path.match(/\.batch\.ts$/),
    action: ({ path }) => {
      executeCommand('AgentBatchBackTest', { filename: path });
    },
  },
  {
    id: 'AgentBatchBackTest_generate',
    match: ({ path, isFile }) => isFile && !!path.match(/\.batch\.ts$/) && !!currentHostConfig$.value,
    action: async ({ path }) => {
      await writeManifestsFromBatchTasks(path, currentHostConfig$.value?.host_url!);
      Toast.success(t('common:succeed'));
    },
  },
  {
    id: 'AgentConfForm',
    match: ({ path, isFile }) => isFile && !!path.match(/\.ts$/),
    action: ({ path }) => {
      agentConf$.next({ ...agentConf$.value, entry: path });
      reloadSchemaAction$.next();
      executeCommand('AgentConfForm', { filename: path });
    },
  },
  {
    id: 'DeployConfigForm',
    match: ({ path, isFile }) => isFile && !!path.match(/\.?manifests\.(json|yaml|yml|ts)$/),
    action: ({ path }) => {
      executeCommand('DeployConfigForm', { filename: path });
    },
  },
  {
    id: 'Extension',
    match: ({ path, isFile }) => isFile && !!path.match(/\.tgz$/),
    action: ({ path }) => {
      installExtensionFromTgz(path);
    },
  },
  {
    id: 'RealtimeAsset',
    match: ({ path, isFile }) => isFile && !!path.match(/\.fund\.json$/),
    action: ({ path }) => {
      executeCommand('RealtimeAsset', { filename: path });
    },
  },
  {
    id: 'FileEditor',
    match: ({ isFile }) => isFile,
    action: ({ path }) => {
      executeCommand('FileEditor', { filename: path });
    },
  },
];

registerPage('Explorer', () => {
  const { t, ready } = useTranslation(['Explorer', 'associations']);
  const terminal = useObservableState(terminal$);
  const currentHostConfig = useObservableState(currentHostConfig$);

  const initialData: TreeNodeData[] = [
    {
      label: workspaceRoot$.value?.name ?? t('TempDirectory'),
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

  const handleLoadNode = async (nodeKey?: string) => {
    if (!nodeKey) {
      return;
    }
    const nodes = await lastValueFrom(
      from(fs.stat(nodeKey)).pipe(
        filter((s) => s.isDirectory()),
        mergeMap(() => fs.readdir(nodeKey)),
        mergeMap((v) => v),
        mergeMap((name) => {
          const _path = path.posix.join(nodeKey, name);
          return from(fs.stat(_path)).pipe(
            //
            map((stats) => ({ label: name, key: _path, isLeaf: stats.isFile() })),
          );
        }),
        toArray(),
        map((x) => x.sort((a, b) => +a.isLeaf - +b.isLeaf || a.label.localeCompare(b.label))),
      ),
    );
    setTreeData((origin) => updateTreeData(origin, nodeKey, nodes));
  };

  if (!ready) return null;

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Button
          disabled={!window.showDirectoryPicker}
          icon={<IconFolderOpen />}
          onClick={() => {
            executeCommand('workspace.open');
          }}
        >
          {t('open_new')}
        </Button>
        <Button
          icon={<IconImport />}
          onClick={async () => {
            executeCommand('workspace.import_examples');
          }}
        >
          {t('import_examples')}
        </Button>
      </Space>
      <Tree
        key={treeKey}
        loadData={(node) => handleLoadNode(node?.key)}
        loadedKeys={[]}
        treeData={[...treeData]}
        style={{ width: '100%' }}
        onExpand={(expendKeys, props) => {
          if (props.expanded) {
            handleLoadNode(props.node.key);
          }
        }}
        renderFullLabel={({ className, onExpand, onClick, data, expandStatus }) => {
          const { label, isLeaf } = data;
          const context = { path: data.key, isFile: !!isLeaf };

          const matchedRules = rules.filter((rule) => rule.match(context));

          return (
            <li
              className={className}
              role="treeitem"
              onClick={isLeaf ? onClick : onExpand}
              onDoubleClick={() => {
                matchedRules[0]?.action(context);
              }}
            >
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

                        {matchedRules.map((rule, idx) => (
                          <Dropdown.Item
                            onClick={() => {
                              rule.action(context);
                            }}
                          >
                            {t(`associations:${rule.id}`)} {idx === 0 && `(${t('common:default')})`}
                          </Dropdown.Item>
                        ))}

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
                            onClick={async () => {
                              await executeCommand('CreateFile', { baseDir: data.key });
                              await handleLoadNode(data.key);
                            }}
                          >
                            {t('create_file')}
                          </Dropdown.Item>
                        )}
                        {isLeaf ? null : (
                          <Dropdown.Item
                            icon={<IconFolder />}
                            onClick={async () => {
                              await executeCommand('CreateDirectory', { baseDir: data.key });
                              await handleLoadNode(data.key);
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
                            await handleLoadNode(dirname(data.key));
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

registerCommand('workspace.open', async () => {
  await i18n.loadNamespaces('Explorer');
  Modal.confirm({
    title: t('Explorer:request_fs_permission'),
    content: <Trans t={t} i18nKey={'Explorer:request_fs_permission_note'} />,
    okText: t('Explorer:agree'),
    cancelText: t('Explorer:disagree'),
    onOk: async () => {
      const root: FileSystemDirectoryHandle = await showDirectoryPicker({
        mode: 'readwrite',
      });
      await root.requestPermission({ mode: 'readwrite' });
      workspaceRoot$.next(root);
    },
  });
});

registerCommand('workspace.import_examples', async () => {
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
  Toast.success(t('common:import_succeed'));
});
