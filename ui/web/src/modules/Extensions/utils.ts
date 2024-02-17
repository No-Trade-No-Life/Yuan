import { formatTime } from '@yuants/data-model';
import { IDeployProvider, IExtensionContext } from '@yuants/extension';
import { dirname, join } from 'path-browserify';
import { BehaviorSubject, defer, from, lastValueFrom, mergeMap, retry, switchMap, timeout } from 'rxjs';
import { FsBackend$, fs } from '../FileSystem/api';
// @ts-ignore
import untar from 'js-untar';

const PACKAGE_DOWNLOAD_DIR = '/.Y/downloads/packages';
export const downloadTgz = async (packageName: string, ver?: string) => {
  const { meta, version } = await resolveVersion(packageName);
  console.info(formatTime(Date.now()), `downloading extension "${packageName}" (${version})...`);
  const tarball_url = meta.versions[version].dist.tarball;
  const tgz = await fetch(tarball_url).then((x) => x.blob());
  await fs.ensureDir(PACKAGE_DOWNLOAD_DIR);
  await fs.writeFile(
    join(PACKAGE_DOWNLOAD_DIR, `${packageName.replace('@', '').replace('/', '-')}-${version}.tgz`),
    tgz,
  );
};

export const installExtension = async (packageName: string, ver?: string) => {
  console.debug(formatTime(Date.now()), `install extension "${packageName}"...`);
  const version = ver || (await resolveVersion(packageName)).version;
  const tgzFilename = join(
    PACKAGE_DOWNLOAD_DIR,
    `${packageName.replace('@', '').replace('/', '-')}-${version}.tgz`,
  );
  if (!(await fs.exists(tgzFilename))) {
    await downloadTgz(packageName);
  }
  await installExtensionFromTgz(tgzFilename);
  console.debug(formatTime(Date.now()), `install extension "${packageName}" successfully`);
};

export const uninstallExtension = async (packageName: string) => {
  await fs.rm(getPackageDir(packageName));
  activeExtensions$.next(
    [...activeExtensions$.value.filter((x) => x.packageJson.name !== packageName)].sort((a, b) =>
      a.packageJson.name.localeCompare(b.packageJson.name),
    ),
  );
};

export const PREINSTALLED_EXTENSIONS = [
  //
  '@yuants/app-host',
  '@yuants/app-agent',
  '@yuants/app-trade-copier',
  '@yuants/app-mongodb-storage',
  '@yuants/app-email-notifier',
  '@yuants/app-feishu-notifier',
  '@yuants/app-market-data-collector',
  '@yuants/app-metrics-collector',
];

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

export interface IActiveExtensionInstance {
  packageJson: {
    name: string;
    description?: string;
    version: string;
  };
  loadTime: number;
}

export const activeExtensions$ = new BehaviorSubject<IActiveExtensionInstance[]>([]);
export const DeployProviders: Record<string, IDeployProvider> = {};
export const ImageTags: Record<string, string> = {};

export const loadExtension = async (packageName: string) => {
  const t = Date.now();
  console.debug(formatTime(t), `load extension "${packageName}"...`);
  try {
    const packageDir = getPackageDir(packageName);
    const packageJson = JSON.parse(await fs.readFile(join(packageDir, 'package.json')));
    const imageTagFilename = join(packageDir, 'temp/image-tag');
    if (packageJson?.publishConfig?.access === 'public') {
      ImageTags[packageName] = packageJson.version;
    } else if (await fs.exists(imageTagFilename)) {
      ImageTags[packageName] = await fs.readFile(imageTagFilename);
    }
    const extensionBundleFilename = join(packageDir, 'dist/extension.bundle.js');
    if (await fs.exists(extensionBundleFilename)) {
      const code = await fs.readFile(extensionBundleFilename);
      const extension: (ctx: IExtensionContext) => void = importModule(code);
      extension({
        registerDeployProvider: (provider) => {
          DeployProviders[packageName] = provider;
        },
      });
    }
    const tE = Date.now();
    const loadTime = tE - t;
    activeExtensions$.next(
      [
        ...activeExtensions$.value.filter((x) => x.packageJson.name !== packageName),
        { packageJson, loadTime },
      ].sort((a, b) => a.packageJson.name.localeCompare(b.packageJson.name)),
    );

    console.debug(formatTime(tE), `load extension "${packageName}" successfully in ${loadTime}ms`);
  } catch (e) {
    console.debug(formatTime(Date.now()), `load extension "${packageName}" failed:`, e);
    throw e;
  }
};

FsBackend$.pipe(
  switchMap(() =>
    defer(() => fs.readdir('/.Y/extensions')).pipe(
      timeout(200),
      retry({ delay: 200 }),

      mergeMap((files) => files),
      mergeMap(async (file) => {
        try {
          const dirname = join('/.Y/extensions', file);
          const stat = await fs.stat(dirname);
          if (stat.isDirectory()) {
            const packageJson = JSON.parse(await fs.readFile(join(dirname, 'package.json')));
            await loadExtension(packageJson.name);
          }
        } catch (e) {}
      }, 1),
      retry({ delay: 1000 }),
    ),
  ),
).subscribe();

export async function installExtensionFromTgz(tgzFilename: string) {
  const t = Date.now();
  const tgz = await fs.readAsBlob(tgzFilename);
  const tarball = await new Response(
    tgz.stream().pipeThrough(
      // @ts-ignore
      new DecompressionStream('gzip'),
    ),
  ).blob();
  const arrayBuffer = await tarball.arrayBuffer();
  const files: Array<{ name: string; readAsString: () => string; get blob(): Blob }> = await untar(
    arrayBuffer,
  );
  const packageJsonFile = files.find((x) => x.name === 'package/package.json');
  if (!packageJsonFile) {
    return;
  }
  const packageJson = JSON.parse(packageJsonFile.readAsString());
  const packageName = packageJson.name;
  // Parallel: Very Fast for large amount of files
  await lastValueFrom(
    from(files).pipe(
      mergeMap(async (file) => {
        console.debug(formatTime(Date.now()), `extension "${packageName}" extracting file "${file.name}"...`);
        const filename = join(
          '/.Y/extensions',
          packageName.replace('@', '').replace('/', '-'),
          file.name.replace(/^package\//, ''),
        );
        await fs.ensureDir(dirname(filename));
        await fs.writeFile(filename, file.blob);
      }),
    ),
  );
  const tE = Date.now();
  const dur = tE - t;
  console.info(formatTime(Date.now()), `extension "${packageName}" installed in ${dur}ms`);
}

function getPackageDir(packageName: string) {
  return join('/.Y/extensions', packageName.replace('@', '').replace('/', '-'));
}

export async function resolveVersion(packageName: string, ver?: string) {
  const meta = await fetch(`https://registry.npmjs.org/${packageName}`).then((x) => x.json());
  const version: string = ver || meta['dist-tags'].latest;
  return { meta, version };
}
