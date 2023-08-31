import { IDeployProvider, IExtensionContext } from '@yuants/extension';
import { formatTime } from '@yuants/kernel';
// @ts-ignore
import untar from 'js-untar';
import { dirname, join } from 'path-browserify';
import { defer, mergeMap, retry, timer } from 'rxjs';
import { fs } from '../FileSystem/api';

export const downloadTgz = async (packageName: string, ver?: string) => {
  const { meta, version } = await resolveVersion(packageName);
  console.info(formatTime(Date.now()), `downloading extension "${packageName}" (${version})...`);
  const tarball_url = meta.versions[version].dist.tarball;
  const tgz = await fetch(tarball_url).then((x) => x.blob());
  await fs.ensureDir('/.Y/extensions');
  await fs.writeFile(
    join('/.Y/extensions', `${packageName.replace('@', '').replace('/', '-')}-${version}.tgz`),
    tgz,
  );
};

export const installExtension = async (packageName: string, ver?: string) => {
  console.debug(formatTime(Date.now()), `install extension "${packageName}"...`);
  const version = ver || (await resolveVersion(packageName)).version;
  const tgzFilename = join(
    '/.Y/extensions',
    `${packageName.replace('@', '').replace('/', '-')}-${version}.tgz`,
  );
  if (!(await fs.exists(tgzFilename))) {
    await downloadTgz(packageName);
  }
  await installExtensionFromTgz(tgzFilename);
  console.debug(new Date(), `install extension "${packageName}" successfully`);
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

export const activeExtensions = new Set<string>();
export const DeployProviders: Record<string, IDeployProvider> = {};
export const ImageTags: Record<string, string> = {};

export const loadExtension = async (packageName: string) => {
  console.debug(formatTime(Date.now()), `load extension "${packageName}"...`);

  try {
    const packageDir = getPackageDir(packageName);
    const imageTagFilename = join(packageDir, 'temp/image-tag');
    if (await fs.exists(imageTagFilename)) {
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
    console.debug(formatTime(Date.now()), `load extension "${packageName}" successfully`);
  } catch (e) {
    console.debug(formatTime(Date.now()), `load extension "${packageName}" failed:`, e);
    throw e;
  }
};

defer(() => timer(1000))
  .pipe(
    mergeMap(async () => {
      const files = await fs.readdir('/.Y/extensions');
      for (const file of files) {
        try {
          const dirname = join('/.Y/extensions', file);
          const stat = await fs.stat(dirname);
          if (stat.isDirectory()) {
            const packageJson = JSON.parse(await fs.readFile(join(dirname, 'package.json')));
            await loadExtension(packageJson.name);
            activeExtensions.add(packageJson.name);
          }
        } catch (e) {}
      }
    }),
    retry(),
  )
  .subscribe();

export async function installExtensionFromTgz(tgzFilename: string) {
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
  for (const file of files) {
    console.debug(formatTime(Date.now()), `extension "${packageName}" extracting file "${file.name}"...`);
    const filename = join(
      '/.Y/extensions',
      packageName.replace('@', '').replace('/', '-'),
      file.name.replace(/^package\//, ''),
    );
    await fs.ensureDir(dirname(filename));
    await fs.writeFile(filename, file.blob);
  }
  console.info(formatTime(Date.now()), `extension "${packageName}" installed`);
}

function getPackageDir(packageName: string) {
  return join('/.Y/extensions', packageName.replace('@', '').replace('/', '-'));
}

async function resolveVersion(packageName: string, ver?: string) {
  const meta = await fetch(`https://registry.npmjs.org/${packageName}`).then((x) => x.json());
  const version = ver || meta['dist-tags'].latest;
  return { meta, version };
}
