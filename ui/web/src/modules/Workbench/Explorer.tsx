import {
  IconArrowUpRight,
  IconCopy,
  IconDelete,
  IconFile,
  IconFolder,
  IconFolderOpen,
  IconForward,
  IconLoading,
  IconMore,
  IconSend,
} from '@douyinfe/semi-icons';
import { Dropdown, Modal, Space, Toast, Tree } from '@douyinfe/semi-ui';
import { TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree/interface';
import { formatTime } from '@yuants/data-model';
import copy from 'copy-to-clipboard';
import { t } from 'i18next';
import { useObservable, useObservableState } from 'observable-hooks';
import path, { dirname } from 'path-browserify';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { filter, firstValueFrom, from, lastValueFrom, map, mergeMap, toArray } from 'rxjs';
import { unzip } from 'unzipit';
import { executeCommand, registerCommand } from '../CommandCenter';
import { FsBackend$, fs } from '../FileSystem';
import { createLocalWorkspace, openWorkspace, removeWorkspace, workspaces$ } from '../FileSystem/workspaces';
import { showForm } from '../Form';
import { Button } from '../Interactive';
import i18n from '../Locale/i18n';
import { registerPage } from '../Pages';
import { associationRules } from '../System';
import { terminal$ } from '../Terminals';
import { sendFileByAirdrop } from './airdrop';

registerPage('Explorer', () => {
  const { t, ready } = useTranslation(['Explorer', 'associations']);
  const terminal = useObservableState(terminal$);
  const rootName =
    useObservableState(useObservable(() => FsBackend$.pipe(map((x) => x?.name)))) || t('TempDirectory');

  const initialData: TreeNodeData[] = [
    {
      label: rootName,
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
          const context = { path: data.key || '/', isFile: !!isLeaf };
          const filename = data.key;

          const matchedRules = associationRules
            .filter((rule) => rule.match(context))
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));

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
                <span>{filename === '/' ? rootName : label}</span>
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
                            if (!data.key) return;
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
                            if (!data.key) return;
                            if (
                              !(await showForm({
                                type: 'boolean',
                                title: t('delete_confirm', {
                                  path: data.key,
                                  interpolation: { escapeValue: false },
                                }),
                              }))
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
                          disabled={!data.isLeaf || !terminal}
                          onClick={async () => {
                            if (!data.key) return;
                            if (!terminal) return;
                            const terminalInfos = await firstValueFrom(from(terminal.terminalInfos$));
                            const candidates = terminalInfos.filter((terminalInfo) =>
                              Object.values(terminalInfo.serviceInfo || {}).some(
                                (x) => x.method === 'AirDrop',
                              ),
                            );
                            const target_terminal_id = await showForm<string>({
                              type: 'string',
                              title: t('airdrop_target'),
                              enum: candidates.map((terminalInfo) => terminalInfo.terminal_id),
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
  const confirm = await new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: t('Explorer:request_fs_permission'),
      content: (
        <Space vertical>
          <Trans t={t} i18nKey={'Explorer:request_fs_permission_note'} />

          {[...(workspaces$.value || new Map()).values()].map((root) => (
            <Space style={{ width: '100%' }} key={root.id}>
              <Button
                block
                onClick={async () => {
                  openWorkspace(root.id);
                }}
              >
                {root.name}
              </Button>
              <Button
                icon={<IconArrowUpRight />}
                onClick={async () => {
                  openWorkspace(root.id, '_blank');
                }}
              />
              <Button type="danger" icon={<IconDelete />} onClick={() => removeWorkspace(root.id)} />
            </Space>
          ))}
        </Space>
      ),
      okText: t('Explorer:agree'),
      cancelText: t('Explorer:disagree'),
      onOk: () => {
        resolve(true);
      },
      onCancel: () => {
        resolve(false);
      },
    });
  });
  if (!confirm) return;
  const workspace = await createLocalWorkspace();
  openWorkspace(workspace.id, '_self');
});

registerCommand('workspace.import_examples', async () => {
  const res = await unzip(`https://y.ntnl.io/Yuan-Public-Workspace/Yuan-Public-Workspace-main.zip`);
  // Speed up: write files in parallel
  await lastValueFrom(
    from(Object.entries(res.entries)).pipe(
      mergeMap(async ([filename, entry]) => {
        if (!entry.isDirectory) {
          const thePath = path.resolve('/', filename);
          if (thePath[0] === '/') {
            await fs.ensureDir(path.dirname(thePath));
            await fs.writeFile(thePath, await entry.blob());
            console.info(
              formatTime(Date.now()),
              t('common:file_written', { filename: thePath, interpolation: { escapeValue: false } }),
            );
          }
        }
      }),
    ),
  );
  Toast.success(t('common:import_succeed'));
});
