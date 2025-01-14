import * as rushLib from '@microsoft/rush-lib';
import Axios from 'axios';
import { execSync } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { filter, from, map, mergeMap, tap } from 'rxjs';

export const buildDockerImage = async () => {
  if (!(await fs.exists(path.resolve(process.cwd(), 'build/Dockerfile')))) return;

  const packageJson = await fs.readJson(path.resolve(process.cwd(), 'package.json'));
  const packageName = packageJson.name;

  const rushConfiguration = rushLib.RushConfiguration.loadFromDefaultLocation({
    startingFolder: process.cwd(),
  });

  const thisProject = rushConfiguration.projectsByName.get(packageName);
  if (!thisProject) {
    console.error(new Date(), `project ${packageName} not found in rush.json`);
    process.exit(1);
  }

  const rushJsonFolder = rushConfiguration.rushJsonFolder;
  const commonTempFolder = rushConfiguration.commonTempFolder;

  const trimmedPackageName = packageName.replace(/@([a-z0-9-~][a-z0-9-._~]*)\//, '');
  const outBakeFile = path.resolve(commonTempFolder, `docker-bake-${trimmedPackageName}.json`);

  const outTagFile = path.resolve(thisProject.projectFolder, `temp/image-tag`);
  // const outTagJs = path.resolve(thisProject.projectFolder, `lib/image-tag.json`);
  const absArtifactDir = path.resolve(commonTempFolder, `out/${trimmedPackageName}-out`);

  const ensureDirSync = (dirPath: string) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  };

  ensureDirSync(absArtifactDir);
  ensureDirSync(path.dirname(outTagFile));

  /// calculate image tag by project deps hash
  const imageTag =
    `sha-` +
    execSync(`git hash-object ${path.resolve(thisProject.projectFolder, `temp`, `package-deps.json`)}`)
      .toString()
      .trim();

  fs.writeFileSync(outTagFile, imageTag);

  const registry = process.env.REGISTRY ?? 'ghcr.io';
  const namespace = process.env.REGISTRY_NAMESPACE ?? 'no-trade-no-life';
  const version = process.env.VERSION ? packageJson.version : imageTag;
  const auth: { username: string; password: string } | undefined =
    process.env.REGISTRY_USERNAME && process.env.REGISTRY_PASSWORD
      ? {
          username: process.env.REGISTRY_USERNAME!,
          password: process.env.REGISTRY_PASSWORD!,
        }
      : undefined;

  /// check if image exists
  // https://docs.docker.com/registry/spec/auth/token/
  from(
    Axios.get(`https://${registry}/v2/${namespace}/${trimmedPackageName}/manifests/${version}`, {
      headers: {
        Accept: 'application/vnd.oci.image.index.v1+json',
      },
      validateStatus: (status) => status < 500,
    }),
  )
    .pipe(
      //
      filter((res) => res.status === 401),
      map((v) => v.headers['www-authenticate']),
      mergeMap((authenticate) => {
        const [, realm, service, scope] = authenticate.match(
          /Bearer realm=\"(.+?)\"\,service=\"(.+?)\"\,scope=\"(.+?)\"/,
        );
        return Axios.get(realm, {
          params: {
            service,
            scope,
          },
          auth: auth,
          validateStatus: (status) => status < 500,
        });
      }),
      map((resp) => resp.data as { token: string }),
      tap((msg) => {
        console.debug(new Date(), 'token', msg.token);
      }),
      mergeMap((msg) =>
        Axios.get(`https://${registry}/v2/${namespace}/${trimmedPackageName}/manifests/${version}`, {
          headers: {
            Accept: 'application/vnd.oci.image.index.v1+json',
            Authorization: `Bearer ${msg.token}`,
          },
        }),
      ),
    )
    .subscribe({
      next: () => {
        console.info(
          new Date(),
          'ImageExists',
          `image ${registry}/${namespace}/${trimmedPackageName}:${version} exists in the remote registry`,
        );
      },
      error: (e) => {
        /// Prepare artifacts
        if (e.code === 'ERR_BAD_REQUEST') {
          console.info(
            new Date(),
            'ImageNotExists',
            `image ${registry}/${namespace}/${trimmedPackageName}:${version} not exists in the remote registry`,
          );
        } else {
          console.info(
            new Date(),
            'ImageExistenceUnknown',
            `build ${registry}/${namespace}/${trimmedPackageName}:${version} anyway`,
          );
        }
        console.info(new Date(), `collecting artifacts for ${packageName} at ${absArtifactDir}`);
        execSync(
          `node ${path.resolve(
            rushJsonFolder,
            'common/scripts/install-run-rush.js',
          )} deploy --project ${packageName} --target ${absArtifactDir} --overwrite`,
        );

        /// Prepare docker-bake.json
        const packageJson = require(path.resolve(thisProject.projectFolder, 'package.json'));

        for (const file of packageJson?.io_ntnl?.deploy_files || []) {
          const src = path.resolve(thisProject.projectFolder, file);
          const dest = path.join(absArtifactDir, thisProject.projectRelativeFolder, path.basename(src));
          if (fs.statSync(src).isDirectory()) {
            fs.emptyDirSync(dest);
          }
          fs.copySync(src, dest);
        }

        interface IImageSpec {
          dockerfile: string;
          name: string;
        }

        const imageSpecs: IImageSpec[] = packageJson?.io_ntnl?.images ?? [
          {
            dockerfile: 'build/Dockerfile',
            name: trimmedPackageName,
          },
        ];

        const target = Object.fromEntries(
          imageSpecs.map((imageSpec) => [
            imageSpec.name,
            {
              dockerfile: path.resolve(thisProject.projectFolder, imageSpec.dockerfile),
              context: path.resolve(rushJsonFolder, 'common/temp'),
              tags: [`${registry}/${namespace}/${imageSpec.name}:${version}`],
            },
          ]),
        );

        const group = {
          default: {
            targets: imageSpecs.map((i) => i.name),
          },
        };

        // for CI run, we compose a single docker-bake file, and let the CI do the work
        // else we build docker image
        if ((process.env.CI_RUN ?? 'false') === 'true') {
          const uniOutBakeFile = path.resolve(rushJsonFolder, `common/temp/docker-bake.json`);
          if (fs.existsSync(uniOutBakeFile)) {
            const content = JSON.parse(fs.readFileSync(uniOutBakeFile).toString());
            content.group.default.targets = [...content.group.default.targets, ...group.default.targets];
            content.target = {
              ...content.target,
              ...target,
            };
            fs.writeFileSync(uniOutBakeFile, JSON.stringify(content, undefined, 2));
          } else {
            fs.writeFileSync(uniOutBakeFile, JSON.stringify({ target, group }, undefined, 2));
          }
        } else {
          fs.writeFileSync(outBakeFile, JSON.stringify({ target, group }, undefined, 2));
          execSync(`docker buildx bake -f ${outBakeFile}`, { stdio: 'ignore' });
        }
      },
    });
};
