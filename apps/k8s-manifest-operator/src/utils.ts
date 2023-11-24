import * as k8s from '@kubernetes/client-node';
import { formatTime } from '@yuants/data-model';
import {
  EMPTY,
  Observable,
  catchError,
  concatWith,
  defer,
  filter,
  from,
  lastValueFrom,
  mergeMap,
  of,
  retry,
  shareReplay,
} from 'rxjs';
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

export function makeNamespacedName(namespace: string, name: string): NamespacedName;
export function makeNamespacedName(obj: k8s.KubernetesObject): NamespacedName;

export function makeNamespacedName(
  namespaceOrObj: string | k8s.KubernetesObject,
  name?: string,
): NamespacedName {
  if (typeof namespaceOrObj === 'string') {
    return new NamespacedName(namespaceOrObj, name!);
  } else {
    return new NamespacedName(namespaceOrObj.metadata!.namespace!, namespaceOrObj.metadata!.name!);
  }
}

export const sync = async (client: k8s.KubernetesObjectApi, manifests: IDeployResource[]) => {
  // apply
  await lastValueFrom(
    from(manifests).pipe(
      mergeMap((x) => apply(client, x as IDeployResource)),
      concatWith(of(void 0)),
    ),
  );

  // delete
  await lastValueFrom(
    from(client.list('yuan.ntnl.io/v1alpha1', 'Component', 'yuan')).pipe(
      retry({ count: 3, delay: 1000 }),
      catchError((err) => {
        console.error(new Date(), `Server`, `ListError`, err);
        return EMPTY;
      }),
      mergeMap((res) => res.body.items),
      filter((x) => !manifests.find((y) => y.metadata?.name === x.metadata?.name)),
      mergeMap((x) => {
        const namespacedName = makeNamespacedName(x);
        return from(client.delete(x)).pipe(
          //
          retry({ count: 3, delay: 1000 }),
          mergeMap(() => EMPTY),
          catchError((err) => {
            console.error(new Date(), `Server`, namespacedName.toString(), `Error`, err);
            return EMPTY;
          }),
        );
      }),
      concatWith(of(void 0)),
    ),
  );
};

export const apply = async (client: k8s.KubernetesObjectApi, desired: IDeployResource) => {
  const namespacedName = makeNamespacedName(desired);
  await lastValueFrom(
    from(
      client.read({
        metadata: {
          name: desired.metadata.name!,
          namespace: desired.metadata.namespace!,
        },
        apiVersion: desired.apiVersion!,
        kind: desired.kind!,
      }),
    ).pipe(
      catchError((err) => {
        if (err instanceof k8s.HttpError) {
          if (err.response.statusCode === 404) {
            console.info(new Date(), `Server`, namespacedName.toString(), `Creating`);
            return from(client.create(desired)).pipe(
              //
              retry({ count: 3, delay: 1000 }),
              mergeMap(() => EMPTY),
            );
          }
        }
        throw err;
      }),
      mergeMap((res) => {
        const exists = res.body as IDeployResource;
        return from(
          client.patch(
            { ...desired, metadata: exists.metadata },
            undefined,
            undefined,
            undefined,
            undefined,
            {
              headers: {
                'Content-Type': 'application/merge-patch+json',
              },
            },
          ),
        ).pipe(
          //
          retry({ count: 3, delay: 1000 }),
          mergeMap(() => EMPTY),
        );
      }),
      catchError((err) => {
        console.error(new Date(), `Server`, namespacedName.toString(), `Error`, err);
        return EMPTY;
      }),
      concatWith(of(void 0)),
    ),
  );
};

export const deleteResource = async (client: k8s.KubernetesObjectApi, desired: IDeployResource) => {
  const namespacedName = makeNamespacedName(desired);
  await lastValueFrom(
    from(client.delete(desired)).pipe(
      catchError((err) => {
        console.error(new Date(), `Server`, namespacedName.toString(), `Error`, err);
        return EMPTY;
      }),
      concatWith(of(void 0)),
    ),
  );
};

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
      return Object.entries(k8s_resources).map(([name, obj]: [string, any]) => {
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
        return {
          kind: name,
          resource: obj,
        };
      });
    }),
  );
};
