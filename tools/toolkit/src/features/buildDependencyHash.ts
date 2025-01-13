import * as rushLib from '@microsoft/rush-lib';
import { getGitHashForFiles, getPackageDeps } from '@rushstack/package-deps-hash';
import * as fs from 'fs-extra';
import _ from 'lodash';
import * as path from 'path';

export const buildDependencyHash = async () => {
  const packageJson = await fs.readJson(path.resolve(process.cwd(), 'package.json'));
  const packageName = packageJson.name;

  let rushConfiguration: rushLib.RushConfiguration;
  try {
    rushConfiguration = rushLib.RushConfiguration.loadFromDefaultLocation({
      startingFolder: process.cwd(),
    });
  } catch (e) {
    console.error(new Date(), `cannot load rush.json`, e);
    process.exit(1);
  }

  const thisProject = rushConfiguration.projectsByName.get(packageName);
  if (!thisProject) {
    console.error(new Date(), `project ${packageName} not found in rush.json`);
    process.exit(1);
  }

  const rushJsonFolder = rushConfiguration.rushJsonFolder;
  const commonTempFolder = rushConfiguration.commonTempFolder;

  const trimmedPackageName = packageName.replace(/@\w+\//, '');

  const outTagFile = path.resolve(thisProject.projectFolder, `temp/image-tag`);
  const absArtifactDir = path.resolve(commonTempFolder, `out/${trimmedPackageName}-out`);

  const ensureDirSync = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  };

  ensureDirSync(absArtifactDir);
  ensureDirSync(path.dirname(outTagFile));

  /// incrementally rush deploy，see：https://rushjs.io/zh-cn/pages/advanced/incremental_builds/

  const internalDependencies = thisProject.dependencyProjects;

  const filesHash = [...getPackageDeps(thisProject.projectFolder)].map(([k, v]) => [
    `${thisProject.projectRelativeFolder}/${k}`,
    v,
  ]);

  const shrinkwrapHash = getGitHashForFiles(
    [
      path.relative(
        rushJsonFolder,
        path.resolve(thisProject.projectRushTempFolder, rushLib.RushConstants.projectShrinkwrapFilename),
      ),
    ],
    rushJsonFolder,
  );

  const depsHash = getGitHashForFiles(
    [...internalDependencies].map((dependency) =>
      path.join(dependency.projectRelativeFolder, `temp`, `package-deps.json`),
    ),
    rushJsonFolder,
  );

  // Hash(thisProject) = fileHash + externalDepsHash + internalDeps.map(Hash)
  const currHash: Record<string, string> = Object.fromEntries([...filesHash, ...shrinkwrapHash, ...depsHash]);

  /// update project Deps Hash file
  const prevHash = fs.existsSync(path.resolve(thisProject.projectFolder, `temp`, `package-deps.json`))
    ? JSON.parse(
        fs.readFileSync(path.resolve(thisProject.projectFolder, `temp`, `package-deps.json`)).toString(),
      )
    : undefined;

  if (prevHash !== undefined && _.isEqual(prevHash, currHash)) {
    console.info(new Date(), `${packageName} in ${thisProject.projectRelativeFolder} unchanged, skip...`);
  } else {
    fs.writeFileSync(
      path.resolve(thisProject.projectFolder, `temp`, `package-deps.json`),
      JSON.stringify(currHash, undefined, 4),
    );
  }
};
