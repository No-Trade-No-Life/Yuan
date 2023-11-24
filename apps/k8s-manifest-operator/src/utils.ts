import * as k8s from '@kubernetes/client-node';
import { formatTime } from '@yuants/data-model';
import { Observable, defer, mergeMap, retry, shareReplay } from 'rxjs';
import { IDeployResource } from './model';
// @ts-ignore
import { IDeployProvider, IEnvContext, IExtensionContext } from '@yuants/extension';
import { createHash } from 'crypto';
import fetch from 'node-fetch';
import tar, { ReadEntry } from 'tar';

export class NamespacedName {
  constructor(public readonly namespace: string, public readonly name: string) {}

  toString(): string {
    return `${this.namespace}/${this.name}`;
  }
}

export function makeNamespacedName(namespaceOrObj: k8s.KubernetesObject): NamespacedName {
  return new NamespacedName(namespaceOrObj.metadata!.namespace!, namespaceOrObj.metadata!.name!);
}

const downloadTgz = async (packageName: string, ver?: string) => {
  const { meta, version } = await resolveVersion(packageName, ver);
  const tarball_url = meta.versions[version].dist.tarball;
  console.info(new Date(), `downloading extension "${packageName}" (${version}) from ${tarball_url}`);
  const tgz = await fetch(tarball_url);
  return tgz.body;
};

async function resolveVersion(packageName: string, ver?: string) {
  const meta: any = await fetch(`https://registry.npmjs.org/${packageName}`).then((x) => x.json());
  const version = ver || meta['dist-tags'].latest;
  return { meta, version };
}

const importModule = (code: string) => {
  const module = new Function(`return ${code}`).call(undefined);
  if (module.__esModule) {
    if (typeof module.default === 'function') {
      return module.default;
    }
    throw new Error(`Module must export default function`);
  }
  if (typeof module !== 'function') {
    throw new Error('Module must export default function');
  }
  return module;
};

const loadExtension = async (packageName: string, version: string): Promise<IDeployProvider> => {
  const t = Date.now();
  console.debug(formatTime(t), `load extension "${packageName}"...`);
  try {
    const tgz = await downloadTgz(packageName, version);

    const code = await new Promise<string>((resolve, reject) =>
      tgz!.pipe(
        tar.x({}).on('entry', async (entry: ReadEntry) => {
          const filename = entry.path;
          if (filename === 'package/dist/extension.bundle.js') {
            const buffers = [];
            for await (const data of entry) {
              buffers.push(data);
            }
            const code = Buffer.concat(buffers).toString();
            resolve(code);
          }
        }),
      ),
    );

    const extension: (ctx: IExtensionContext) => void = importModule(code);
    let ret: IDeployProvider;
    extension({
      registerDeployProvider: (provider) => {
        ret = provider;
      },
    });
    const tE = Date.now();
    const loadTime = tE - t;
    console.debug(formatTime(tE), `load extension "${packageName}" successfully in ${loadTime}ms`);
    return ret!;
  } catch (e) {
    console.debug(formatTime(Date.now()), `load extension "${packageName}" failed:`, e);
    throw e;
  }
};

const hub: Record<string, Observable<IDeployProvider>> = {};

export const useDeployProvider = (packageName: string, version: string) => {
  return (hub[`${packageName}-${version}`] ??= defer(() => loadExtension(packageName, version)).pipe(
    //
    retry({ delay: 2000 }),
    shareReplay(1),
  ));
};

export const useResources = (cr: IDeployResource) => {
  console.info(new Date(), `useResources`, cr.metadata.name);
  const { package: packageName, version } = cr.spec;
  return useDeployProvider(packageName, version!).pipe(
    //
    mergeMap(async (provider) => {
      const manifest = cr.spec;
      // FIXME: remove file related functions
      const throwNotImplemented = () => {
        throw new Error('resolveLocal is not implemented');
      };
      const envCtx: IEnvContext = {
        resolveLocal: throwNotImplemented,
        readFile: throwNotImplemented,
        readFileAsBase64: throwNotImplemented,
        readdir: throwNotImplemented,
        isDirectory: throwNotImplemented,

        version: manifest.version!,
        toBase64String: async (str: string) => Buffer.from(str).toString('base64'),
        createHashOfSHA256: async (str: string) => createHash('sha256').update(str).digest('hex'),
      };

      const k8s_resources = await provider.make_k8s_resource_objects(manifest, envCtx);
      console.info(new Date(), `ResolvedResources`, Object.keys(k8s_resources));
      return Object.values(k8s_resources).map((obj: any) => {
        obj.metadata!.ownerReferences = [
          {
            apiVersion: cr.apiVersion,
            kind: cr.kind,
            name: cr.metadata.name!,
            uid: cr.metadata.uid!,
            blockOwnerDeletion: true,
            controller: true,
          },
        ];
        return obj as k8s.KubernetesObject;
      });
    }),
  );
};
