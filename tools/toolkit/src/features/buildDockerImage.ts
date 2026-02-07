import * as rushLib from '@microsoft/rush-lib';
import Axios from 'axios';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { filter, from, map, mergeMap, tap } from 'rxjs';

export const buildDockerImage = async () => {
  if (!(await fs.exists(path.resolve(process.cwd(), 'build/Dockerfile')))) {
    console.info(new Date(), 'no Dockerfile found, skip building docker image');
    return;
  }

  const parsePlatforms = (raw: string | undefined): string[] =>
    (raw || '')
      .split(',')
      .map((v) => v.trim())
      .filter((v) => !!v);

  const defaultBuildPlatforms = parsePlatforms(process.env.DOCKER_BUILD_PLATFORMS);
  if (defaultBuildPlatforms.length > 0) {
    console.info(new Date(), `docker build platforms: ${defaultBuildPlatforms.join(',')}`);
  }

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

  console.info(new Date(), `building docker image for ${packageName} at ${absArtifactDir}`);

  ensureDirSync(absArtifactDir);
  ensureDirSync(path.dirname(outTagFile));

  /// calculate image tag by project deps hash
  const imageTag =
    `sha-` +
    execSync(`git hash-object ${path.resolve(thisProject.projectFolder, `temp`, `package-deps.json`)}`)
      .toString()
      .trim();

  console.info(new Date(), `image tag: ${imageTag}`);

  fs.writeFileSync(outTagFile, imageTag);

  const registry = process.env.REGISTRY ?? 'ghcr.io';
  const namespace = process.env.REGISTRY_NAMESPACE ?? 'no-trade-no-life';
  const version = process.env.VERSION ?? packageJson.version;
  const auth: { username: string; password: string } | undefined =
    process.env.REGISTRY_USERNAME && process.env.REGISTRY_PASSWORD
      ? {
          username: process.env.REGISTRY_USERNAME!,
          password: process.env.REGISTRY_PASSWORD!,
        }
      : undefined;

  console.info(new Date(), `registry: ${registry}, username: ${auth?.username}, namespace: ${namespace}`);

  console.info(new Date(), `checking image ${registry}/${namespace}/${trimmedPackageName}:${version}`);
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

        console.info(new Date(), `preparing docker-bake.json for ${packageName} at ${outBakeFile}`);

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
          platforms?: string[];
        }

        const imageSpecs: IImageSpec[] = packageJson?.io_ntnl?.images ?? [
          {
            dockerfile: 'build/Dockerfile',
            name: trimmedPackageName,
          },
        ];

        const target = Object.fromEntries(
          imageSpecs.map((imageSpec) => {
            const baseTag = `${registry}/${namespace}/${imageSpec.name}`;
            const tags = Array.from(new Set([`${baseTag}:${version}`, `${baseTag}:latest`]));
            const platforms = imageSpec.platforms?.length ? imageSpec.platforms : defaultBuildPlatforms;
            return [
              imageSpec.name,
              {
                dockerfile: path.resolve(thisProject.projectFolder, imageSpec.dockerfile),
                context: path.resolve(rushJsonFolder, 'common/temp'),
                tags,
                ...(platforms.length > 0 ? { platforms } : {}),
              },
            ];
          }),
        );

        const group = {
          default: {
            targets: imageSpecs.map((i) => i.name),
          },
        };

        // ISSUE: 并发合并可能会对 docker-bake.json 文件造成破坏
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

        // for CI run, we compose a single docker-bake file, and let the CI do the work
        if (process.env.DOCKER_BUILD_INSTANTLY === 'true') {
          console.info(new Date(), `building docker image for ${packageName} at ${absArtifactDir}`);
          fs.writeFileSync(outBakeFile, JSON.stringify({ target, group }, undefined, 2));
          // const output = execSync(`docker buildx bake -f ${outBakeFile}`, { stdio: 'pipe' });
          const child = spawn('docker', ['buildx', 'bake', '-f', outBakeFile], {
            stdio: 'pipe',
          })
            .on('close', (code) => {
              console.info(new Date(), `docker buildx bake exited with code ${code}`);
            })
            .stderr.on('data', (data) => {
              process.stdout.write(data);
            });
        }
      },
    });
};
