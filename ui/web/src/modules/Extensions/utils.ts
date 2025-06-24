import { formatTime } from '@yuants/data-model';
import { IDeployProvider, IExtensionContext } from '@yuants/extension';
import ini from 'ini';
import { dirname, join } from 'path-browserify';
import { BehaviorSubject, from, lastValueFrom, mergeMap } from 'rxjs';
import { fs } from '../FileSystem/api';
// @ts-ignore
import untar from 'js-untar';

export interface INpmPackagePullParams {
  name: string;
  registry?: string;
  version?: string;
  npm_token?: string;
}

// ISSUE: use cors-proxy to avoid CORS issue
const mapUrlToCorsProxy = (url: string): string => {
  const urlObj = new URL('https://makcbuwrvhmfggzvhtux.supabase.co/functions/v1/cors-proxy');
  urlObj.searchParams.set('url', url);
  return urlObj.toString();
};

const PACKAGE_DOWNLOAD_DIR = '/.Y/downloads/packages';
export const downloadTgz = async (context: INpmPackagePullParams) => {
  const { meta, version } = await resolveVersion(context);
  console.info(formatTime(Date.now()), `downloading extension "${context.name}" (${version})...`);
  const tarball_url = meta.versions[version].dist.tarball;
  const tgz = await fetch(
    mapUrlToCorsProxy(tarball_url),
    context.npm_token
      ? {
          headers: {
            Authorization: `Bearer ${context.npm_token}`,
          },
        }
      : undefined,
  ).then((x) => x.blob());
  await fs.ensureDir(PACKAGE_DOWNLOAD_DIR);
  await fs.writeFile(
    join(PACKAGE_DOWNLOAD_DIR, `${context.name.replace('@', '').replace('/', '-')}-${version}.tgz`),
    tgz,
  );
};

export const installExtension = async (packageParams: INpmPackagePullParams) => {
  const packageName = packageParams.name;
  console.debug(formatTime(Date.now()), `install extension "${packageName}"...`);
  const version = packageParams.version || (await resolveVersion(packageParams)).version;
  const tgzFilename = join(
    PACKAGE_DOWNLOAD_DIR,
    `${packageName.replace('@', '').replace('/', '-')}-${version}.tgz`,
  );
  if (!(await fs.exists(tgzFilename))) {
    await downloadTgz(packageParams);
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
    } else {
      ImageTags[packageName] = packageJson.version;
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

export const loadTarBlob = async (tarBlob: Blob) => {
  const arrayBuffer = await tarBlob.arrayBuffer();
  const files: Array<{ name: string; readAsString: () => string; get blob(): Blob; type: string }> =
    await untar(arrayBuffer);

  return files.map((file) => ({
    filename: file.name,
    blob: file.blob,
    isDirectory: file.type === '5',
    isFile: file.type === '0',
  }));
};

export const loadTgzBlob = async (tgzBlob: Blob) => {
  const tarball = await new Response(
    tgzBlob.stream().pipeThrough(
      // @ts-ignore
      new DecompressionStream('gzip'),
    ),
  ).blob();
  return loadTarBlob(tarball);
};

export async function installExtensionFromTgz(tgzFilename: string) {
  const t = Date.now();
  const tgz = await fs.readFileAsBlob(tgzFilename);
  const files = await loadTgzBlob(tgz);
  const packageJsonFile = files.find((x) => x.filename === 'package/package.json');
  if (!packageJsonFile) {
    return;
  }
  const packageJson = JSON.parse(await packageJsonFile.blob.text());
  const packageName = packageJson.name;
  // Parallel: Very Fast for large amount of files
  await lastValueFrom(
    from(files).pipe(
      mergeMap(async (file) => {
        console.debug(
          formatTime(Date.now()),
          `extension "${packageName}" extracting file "${file.filename}"...`,
        );
        const filename = join(
          '/.Y/extensions',
          packageName.replace('@', '').replace('/', '-'),
          file.filename.replace(/^package\//, ''),
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

const applyContextFromNpmRc = async (context: INpmPackagePullParams) => {
  try {
    // try resolve registry & npm_token from .npmrc
    const npmRC = await fs.readFile('/.npmrc');
    const npmRCContent = npmRC.toString();
    const npmConfig = ini.parse(npmRCContent);
    const scope = context.name.match(/^@([^/]+)/)?.[1];
    const registry =
      (scope && npmConfig[`@${scope}:registry`]) || npmConfig.registry || 'https://registry.npmjs.org';
    const registryHostname = new URL(registry).hostname;
    const npm_token =
      npmConfig[`//${registryHostname}/:_authToken`] || npmConfig[`//${registryHostname}/:always-auth`];
    context.registry = registry;
    context.npm_token = npm_token;
  } catch (e) {}
};

export async function resolveVersion(context: INpmPackagePullParams) {
  await applyContextFromNpmRc(context);

  const meta = await fetch(
    mapUrlToCorsProxy(`${context.registry}/${context.name}`),
    context?.npm_token
      ? {
          headers: {
            Authorization: `Bearer ${context.npm_token}`,
          },
        }
      : undefined,
  ).then((x) => x.json());
  if (meta.error) throw new Error(meta.error);
  const version: string = context.version || meta['dist-tags'].latest;
  return { meta, version };
}
