import { IconCode, IconRefresh } from '@douyinfe/semi-icons';
import { Toast } from '@douyinfe/semi-ui';
import { IDeploySpec, IEnvContext, mergeSchema } from '@yuants/extension';
import Ajv from 'ajv';
import { t } from 'i18next';
import { parse } from 'jsonc-parser';
import { useObservableState } from 'observable-hooks';
import path from 'path-browserify';
import { useEffect, useState } from 'react';
import { concatMap, from, lastValueFrom, map, mergeMap, reduce, tap, toArray } from 'rxjs';
import YAML from 'yaml';
import { executeCommand } from '../CommandCenter';
import { DeployProviders, ImageTags } from '../Extensions/utils';
import { fs } from '../FileSystem/api';
import { Button, DataView } from '../Interactive';
import { registerPage, usePageParams } from '../Pages';
import { authState$ } from '../SupaBase';
import { registerAssociationRule } from '../System';
import { loadManifests } from './utils';

// FYI: https://stackoverflow.com/a/30106551
const stringToBase64String = (str: string) => {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16));
    }),
  );
};

const ajv = new Ajv();

registerAssociationRule({
  id: 'DeployConfigForm',
  match: ({ path, isFile }) => isFile && !!path.match(/\.?manifests\.(json|yaml|yml|ts)$/),
  action: ({ path }) => {
    executeCommand('DeployConfigForm', { filename: path });
  },
});

registerPage('DeployConfigForm', () => {
  const { filename } = usePageParams() as { filename: string };

  const authState = useObservableState(authState$);

  const [refreshCount, setRefreshCount] = useState(0);

  const parseConfigs = async (path: string): Promise<IDeploySpec[]> => {
    if (path.endsWith('.json')) {
      return parse(await fs.readFile(path));
    } else if (path.endsWith('.yaml') || path.endsWith('.yml')) {
      return YAML.parse(await fs.readFile(path));
    } else if (path.endsWith('.ts')) {
      return loadManifests(path);
    }
    throw new Error(`Invalid file extension ${path}`);
  };
  const [manifests, setManifests] = useState<IDeploySpec[]>([]);
  const [hostId, setHostId] = useState<string>('');

  useEffect(() => {
    if (filename) {
      parseConfigs(filename).then(
        (configs) => {
          Toast.success(`加载配置文件成功`);
          setManifests(configs);
        },
        (e) => {
          console.error(e);
          Toast.error(`加载配置文件失败 ${e}`);
        },
      );
    }
  }, [filename, refreshCount]);

  const makeDockerCompose = async () => {
    await lastValueFrom(
      from(manifests).pipe(
        //
        map((config) => {
          const packageName = config.package;
          const task = DeployProviders[packageName];
          if (!task) {
            throw `Invalid package name ${packageName}`;
          }
          const validate = ajv.compile(mergeSchema(task.make_json_schema()));
          if (!validate(config)) {
            throw new Error(`Invalid config ${JSON.stringify(validate.errors)}`);
          }
          const envCtx: IEnvContext = {
            version: ImageTags[packageName],
            resolveLocal: async (v) => path.join('$YUAN_WORKSPACE', v),
            readFile: fs.readFile,
            readFileAsBase64: fs.readFileAsBase64,
            toBase64String: async (str: string) => stringToBase64String(str),
            readdir: fs.readdir,
            isDirectory: async (v) => (await fs.stat(v)).isDirectory(),
            createHashOfSHA256: async (content) => {
              const encoder = new window.TextEncoder();
              const raw = encoder.encode(content);
              const hashBuffer = await window.crypto.subtle.digest('SHA-256', raw);
              const hashArray = Array.from(new Uint8Array(hashBuffer)); // 将缓冲区转换为字节数组
              const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // 将字节数组转换为十六进制字符串
              return hashHex;
            },
          };
          return [config, envCtx, task] as const;
        }),
        concatMap(async ([ctx, envCtx, tasks]) => await tasks.make_docker_compose_file(ctx, envCtx)),
        reduce((acc, cur: any) => ({ ...acc, ...cur }), {}),
        map((v) => ({
          version: '3.9',
          services: v,
        })),
        map((v) => YAML.stringify(v)),
        map((v) =>
          [
            //
            `# THIS FILE IS AUTO GENERATED`,
            `# DO NOT MODIFY MANUALLY`,
            ``,
            v,
          ].join('\n'),
        ),
        mergeMap((v) => fs.writeFile(`${filename}.docker-compose.yaml`, v)),
        tap({
          error: (e) => {
            console.error(e);
            Toast.error(`生成 Docker Compose 配置失败 ${e}`);
          },
          complete: () => {
            Toast.success(`生成 Docker Compose 配置成功`);
            console.info(`运行命令，启动 Docker`);
            console.info(
              `  docker compose -f ${path.join(
                '$YUAN_WORKSPACE',
                `${filename}.docker-compose.yaml`,
              )} up -d --remove-orphans`,
            );
          },
        }),
      ),
    );
  };

  const makeK8sResource = async () => {
    const normalizePackageName = (pkgName: string) =>
      pkgName.replace('@', '').replace('/', '-').toLocaleLowerCase();
    await lastValueFrom(
      from(manifests).pipe(
        //
        map((config) => {
          const packageName = config.package;
          const task = DeployProviders[packageName];
          if (!task) {
            throw `Invalid package name ${packageName}`;
          }
          const validate = ajv.compile(mergeSchema(task.make_json_schema()));
          if (!validate(config)) {
            throw new Error(`Invalid config ${JSON.stringify(validate.errors)}`);
          }
          const envCtx: IEnvContext = {
            version: ImageTags[packageName],
            resolveLocal: async (v) => path.join('$YUAN_WORKSPACE', v),
            readFile: fs.readFile,
            readFileAsBase64: fs.readFileAsBase64,
            toBase64String: async (str: string) => stringToBase64String(str),
            readdir: fs.readdir,
            isDirectory: async (v) => (await fs.stat(v)).isDirectory(),
            createHashOfSHA256: async (content) => {
              const encoder = new window.TextEncoder();
              const raw = encoder.encode(content);
              const hashBuffer = await window.crypto.subtle.digest('SHA-256', raw);
              const hashArray = Array.from(new Uint8Array(hashBuffer)); // 将缓冲区转换为字节数组
              const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // 将字节数组转换为十六进制字符串
              return hashHex;
            },
          };
          return [config, envCtx, task] as const;
        }),
        concatMap(
          async ([ctx, envCtx, v]): Promise<[string, object]> => [
            normalizePackageName(ctx.package),
            await v.make_k8s_resource_objects(ctx, envCtx),
          ],
        ),
        mergeMap(([k, v]) =>
          from(Object.values(v)).pipe(
            //
            map((v) => YAML.stringify(v)),
            toArray(),
            map((v) => `# ${k}\n${v.join('\n---\n')}`),
          ),
        ),
        toArray(),
        map((vs) => vs.join('\n---\n')),
        map((v) =>
          [
            //
            `# THIS FILE IS AUTO GENERATED`,
            `# DO NOT MODIFY MANUALLY`,
            ``,
            v,
          ].join('\n'),
        ),
        mergeMap((v) => fs.writeFile(`${filename}.k8s.yaml`, v)),
        tap({
          error: (e) => {
            console.error(e);
            Toast.error(`生成 K8s 资源失败 ${e}`);
          },
          complete: () => {
            Toast.success(`生成 K8s 资源成功`);
            console.info(`运行命令，更新资源到 K8s 集群`);
            console.info(`  kubectl apply -f $YUAN_WORKSPACE${filename}.k8s.yaml`);
          },
        }),
      ),
    );
  };

  return (
    <DataView
      data={manifests}
      layoutMode="list"
      columns={[
        //
        { header: 'Key', accessorKey: 'key' },
        { header: '包名', accessorKey: 'package' },
        {
          header: '版本',
          accessorKey: 'version',
          cell: (ctx) => ctx.getValue() ?? ImageTags[ctx.row.original.package],
        },
        { header: '环境变量', accessorKey: 'env', cell: (ctx) => JSON.stringify(ctx.getValue()) },
        { header: '注解', accessorKey: 'annotations', cell: (ctx) => JSON.stringify(ctx.getValue()) },
      ]}
      topSlot={
        <>
          <Button icon={<IconCode />} onClick={() => executeCommand('FileEditor', { filename: filename })}>
            {t('common:view_source')}
          </Button>
          <Button
            onClick={async () => {
              setRefreshCount(refreshCount + 1);
            }}
            icon={<IconRefresh />}
          ></Button>
          <Button
            onClick={() =>
              Promise.allSettled(
                [...new Set(manifests.map((v) => v.package))].map((packageName) =>
                  executeCommand('Extension.install', { name: packageName, immediateSubmit: true }),
                ),
              )
            }
          >
            安装/更新全部包
          </Button>

          <Button onClick={makeDockerCompose}>生成 Docker Compose 配置文件</Button>
          <Button onClick={makeK8sResource}>生成 K8s 资源文件</Button>
        </>
      }
    />
  );
});
