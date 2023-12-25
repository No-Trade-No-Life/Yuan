import * as k8s from '@kubernetes/client-node';
import deepEqual from 'deep-equal';
import {
  EMPTY,
  Subject,
  catchError,
  concatWith,
  debounceTime,
  defer,
  filter,
  first,
  from,
  groupBy,
  lastValueFrom,
  mergeMap,
  of,
  retry,
  tap,
  timer,
  toArray,
} from 'rxjs';
import { formatTime } from '@yuants/data-model';
import { CRD, FINALIZER_NAME, GROUP, IDeployResource, KIND, PLURAL, VERSION } from './model';
import { makeNamespacedName, useResources } from './utils';

const kubeConfig = new k8s.KubeConfig();
kubeConfig.loadFromFile('/home/c1/.kube/aliyun-dev-config.yaml');
// kubeConfig.loadFromCluster();

const crdApi = kubeConfig.makeApiClient(k8s.ApiextensionsV1Api);
const crApi = kubeConfig.makeApiClient(k8s.CustomObjectsApi);
// TODO: use generic api
const appApi = kubeConfig.makeApiClient(k8s.AppsV1Api);
const coreApi = kubeConfig.makeApiClient(k8s.CoreV1Api);
export const genericApi = k8s.KubernetesObjectApi.makeApiClient(kubeConfig);

export const init = async () => {
  console.info(formatTime(Date.now()), `Controller`, `setup CRD`);
  const desired = CRD;
  await lastValueFrom(
    from(crdApi.readCustomResourceDefinition(CRD.metadata!.name!)).pipe(
      catchError((err) => {
        if (err instanceof k8s.HttpError) {
          if (err.response.statusCode === 404) {
            console.info(formatTime(Date.now()), `Controller`, desired.metadata?.name!, `Creating`);
            return from(crdApi.createCustomResourceDefinition(CRD)).pipe(
              //
              retry({ count: 3, delay: 1000 }),
              mergeMap(() => EMPTY),
            );
          }
        }
        throw err;
      }),
      mergeMap((res) => {
        const exists: IDeployResource = res.body as any;
        return from(
          crdApi.patchCustomResourceDefinition(
            desired.metadata?.name!,
            {
              ...desired,
              metadata: exists.metadata,
            },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            {
              headers: {
                'content-type': 'application/merge-patch+json',
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
        console.error(formatTime(Date.now()), `Controller`, desired.metadata?.name!, `Error`, err);
        return EMPTY;
      }),
      concatWith(of(void 0)),
    ),
  );
};

const mapKeyToExistsResource: Record<string, IDeployResource | undefined> = {};

const reconcile = async (obj: IDeployResource, childChanged = false) => {
  const namespacedName = makeNamespacedName(obj);
  console.info(formatTime(Date.now()), `Controller`, namespacedName.toString(), `Reconciling`);

  const exists = structuredClone(obj);

  if (exists.metadata.deletionTimestamp !== undefined) {
    console.info(formatTime(Date.now()), `Controller`, namespacedName.toString(), 'Deleting');
    await deleteCR(exists);
    return;
  }

  // add finalizer
  if (!exists.metadata.finalizers?.includes(FINALIZER_NAME)) {
    (exists.metadata.finalizers ??= []).push(FINALIZER_NAME);
  }

  const resourceKey = namespacedName.toString();
  if (
    !childChanged &&
    mapKeyToExistsResource[resourceKey] &&
    deepEqual(exists.spec, mapKeyToExistsResource[resourceKey]?.spec) &&
    exists.status !== undefined &&
    exists.status.managedResources === exists.status.readyResources
  ) {
    console.info(formatTime(Date.now()), `Controller`, namespacedName.toString(), `Unchanged, skip`);
    return;
  }

  await lastValueFrom(
    defer(() => useResources(obj).pipe(first())).pipe(
      //
      tap((resources) => {
        console.info(
          formatTime(Date.now()),
          `Controller`,
          namespacedName.toString(),
          `Managing ${resources.length} resources`,
        );
        exists.status = {
          conditions: [],
          managedResources: resources.length,
          readyResources: 0,
        };
      }),
      mergeMap((resources) =>
        from(resources).pipe(
          mergeMap((resource) =>
            from(
              genericApi.read({
                metadata: makeNamespacedName(resource),
                apiVersion: resource.apiVersion!,
                kind: resource.kind!,
              }),
            ).pipe(
              //
              catchError((err) => {
                if (err instanceof k8s.HttpError) {
                  if (err.response.statusCode === 404) {
                    console.info(
                      formatTime(Date.now()),
                      `Controller`,
                      namespacedName.toString(),
                      `Creating ${resource.kind}`,
                    );
                    return from(genericApi.create(resource)).pipe(
                      //
                      retry({ count: 3, delay: 1000 }),
                      catchError((err) => {
                        console.error(
                          formatTime(Date.now()),
                          `Controller`,
                          namespacedName.toString(),
                          `Error ${resource.kind}`,
                          err,
                        );
                        return EMPTY;
                      }),
                      mergeMap(() => EMPTY),
                    );
                  }
                }
                throw err;
              }),
              // NOTE: we can patch the resource directly is because we do not watch resources the manifest owns,
              //       otherwise, must perform a compare and patch only when the resource is changed
              mergeMap((v) => {
                console.info(
                  formatTime(Date.now()),
                  `Controller`,
                  namespacedName.toString(),
                  `Updated ${resource.kind}`,
                );
                return genericApi.patch(resource, undefined, undefined, undefined, undefined, {
                  headers: {
                    'content-type': 'application/merge-patch+json',
                  },
                });
              }),
              catchError((err) => {
                console.error(
                  formatTime(Date.now()),
                  `Controller`,
                  namespacedName.toString(),
                  `Error ${resource.kind}`,
                  err,
                );
                return EMPTY;
              }),
              tap(() => {
                const desiredNsName = makeNamespacedName(resource);
                const condition = {
                  type: 'Ready',
                  status: 'True',
                  lastTransitionTime: new Date(),
                  message: `Managed ${resource.kind} ${desiredNsName.toString()} successfully`,
                  reason: `ManagedResource${resource.kind}Ready`,
                  observedGeneration: exists.metadata.generation || 0,
                };
                const index = exists.status!.conditions.findIndex(
                  (v) =>
                    v.type === 'Ready' &&
                    v.status === 'True' &&
                    v.reason === `ManagedResource${resource.kind}Ready`,
                );
                if (index === -1) {
                  exists.status!.conditions.push(condition);
                } else {
                  exists.status!.conditions[index] = condition;
                }
                exists.status!.readyResources++;
              }),
              concatWith(of(void 0)),
            ),
          ),
          toArray(),
        ),
      ),
    ),
  );

  mapKeyToExistsResource[resourceKey] = exists;
  await lastValueFrom(
    from(
      genericApi.patch(exists, undefined, undefined, undefined, undefined, {
        headers: {
          'content-type': 'application/merge-patch+json',
        },
      }),
    ).pipe(
      catchError((err) => {
        console.error(formatTime(Date.now()), `Controller`, namespacedName.toString(), `Error`, err);
        return EMPTY;
      }),
    ),
  );
};

const deleteCR = async (obj: IDeployResource) => {
  const namespacedName = makeNamespacedName(obj);
  console.info(formatTime(Date.now()), `Controller`, namespacedName.toString(), 'Deleting');

  // do finalize, FYI: https://kubernetes.io/zh-cn/docs/concepts/overview/working-with-objects/finalizers/
  // currently, we don't need to do anything here, but in the future,
  // we may want to do some cleanup work before deleting the agent
  if (obj.metadata.finalizers && obj.metadata.finalizers.includes(FINALIZER_NAME)) {
    obj.metadata.finalizers = obj.metadata.finalizers.filter((name) => name !== FINALIZER_NAME);
  }

  await genericApi.replace(obj);
};

const reconcileParent = async (obj: k8s.KubernetesObject, event: string) => {
  const ref = obj.metadata?.ownerReferences?.find(
    (v) => v.kind === KIND && v.apiVersion === `${GROUP}/${VERSION}`,
  );
  if (ref !== undefined && obj.kind !== undefined) {
    const namespacedName = makeNamespacedName(obj);
    console.info(
      formatTime(Date.now()),
      `Controller`,
      namespacedName.toString(),
      `ManagedResourceReconciling`,
      `kind: ${obj.kind}`,
      `event: ${event}`,
    );
    try {
      const parent = (
        await crApi.getNamespacedCustomObject(GROUP, VERSION, obj.metadata!.namespace!, PLURAL, ref.name)
      ).body as any;
      await reconcile(parent, true);
    } catch (e) {
      if (e instanceof k8s.HttpError) {
        if (e.response.statusCode === 404) {
          // parent not found, ignore
          return;
        }
      }
      console.error(
        formatTime(Date.now()),
        `Controller`,
        namespacedName.toString(),
        `ManagedResourceReconcilingError`,
        e,
      );
    }
  }
};

const yuanManifestInformer = k8s.makeInformer<IDeployResource>(
  kubeConfig,
  `/apis/${GROUP}/${VERSION}/${PLURAL}`,
  () => {
    return crApi.listClusterCustomObject(GROUP, VERSION, PLURAL) as any;
  },
);

yuanManifestInformer.on(k8s.ADD, (obj: IDeployResource) => {
  console.info(formatTime(Date.now()), `Controller`, `YuanComponentAdded`);
  reconcile(obj);
});

yuanManifestInformer.on(k8s.UPDATE, (obj: IDeployResource) => {
  console.info(formatTime(Date.now()), `Controller`, `YuanComponentUpdated`);
  reconcile(obj);
});

yuanManifestInformer.on(k8s.DELETE, (obj: IDeployResource) => {
  console.info(formatTime(Date.now()), `Controller`, `YuanComponentDeleted`);
});

yuanManifestInformer.on(k8s.ERROR, (err) => {
  console.error(formatTime(Date.now()), `Controller`, `YuanComponentInformerError`, err);
  timer(5000).subscribe(() => {
    yuanManifestInformer.start();
  });
});

const resourceEvent$ = new Subject<{ obj: k8s.KubernetesObject; event: string }>();
resourceEvent$
  .pipe(
    //
    filter((v) => v.obj.metadata?.uid !== undefined),
    groupBy((v) => v.obj.metadata!.uid!, {
      duration: () => timer(5000),
    }),
    mergeMap((group) =>
      group.pipe(
        //
        debounceTime(5000),
      ),
    ),
  )
  .subscribe((v) => {
    reconcileParent(v.obj, v.event);
  });

export const run = async () => {
  await init();
  yuanManifestInformer.start();
};
