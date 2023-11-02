import { JSONSchema7, JSONSchema7Definition } from 'json-schema';

/**
 * Deployment specification: uniquely identifies a deployment by specifying this value
 * @public
 */
export interface IDeploySpec {
  /**
   * The unique identifier of the deployment
   */
  key: string;
  /**
   * The image tag used for deployment
   */
  version?: string;
  /**
   * The package to be deployed, e.g. \@yuants/hv
   */
  package: string;
  /**
   * Environment variables
   */
  env?: Record<string, string>;
  /**
   * Annotations, which can add some metadata to it
   * e.g. can be used to generate some non-standard resources in the corresponding vendor interpretation
   * Reference: https://kubernetes.io/docs/concepts/overview/working-with-objects/annotations/
   */
  annotations?: Record<string, string>;
  /**
   * Network configuration
   */
  network?: {
    /**
     * Port forwarding, reference: https://docs.docker.com/config/containers/container-networking/#published-ports
     * Generally, when starting a container, we need to specify [container internal port name]:[container external port]
     * However, here we only specify which port to expose, that is, [container external port], and bind it with the container internal port through a unique semantic name
     * The reason is that only the package can define which port needs to be exposed, and the deployer only defines which port to forward to
     * e.g. vnc -\> 5900, hv -\> 8888
     */
    port_forward?: Record<string, number>;
    /**
     * Reverse proxy,
     * e.g. hv: y.ntnl.io/hv
     */
    backward_proxy?: Record<string, string>;
  };
  /**
   * File system configuration
   * The format is [container internal Volume name]:[container external URI]
   *
   * e.g. config-file1 -\> file://path/to/file
   *      config-file2 -\> s3://bucket_url
   *      config-file3 -\> yuan-workspace://some/path
   */
  filesystem?: Record<string, string>;
  /**
   * CPU resource claim, leaving it blank means using the default value in the package
   */
  cpu?: IResourceClaim;
  /**
   * Memory resource claim, leaving it blank means using the default value in the package
   */
  memory?: IResourceClaim;

  /**
   * Inline JSON data, could be used as a configuration file
   *
   * should be serializable
   */
  one_json?: string;
}

/**
 * Resource claim definition, format reference: https://kubernetes.io/docs/reference/kubernetes-api/common-definitions/quantity/
 * @public
 */
export interface IResourceClaim {
  /** required */
  min?: string;
  /** limited */
  max?: string;
}

/**
 * Automatically calculated environment information:
 *   used to supplement the necessary parts that users have not defined in the deployment specification.
 * @public
 */
export interface IEnvContext {
  /**
   * The image tag used for deployment
   */
  version: string;

  /**
   * Resolves the path and gives the absolute path. Resolve does not verify the existence of the file.
   *
   * @param path - An absolute path under the current Workspace, or a relative path to the Manifests' own absolute path.
   *               It is required to be resolvable by the provider of {@link IEnvContext}.
   * @returns The absolute path on the local machine that path points to, or undefined if it does not exist.
   */
  resolveLocal: (path: string) => Promise<string>;

  /**
   * Reads a file and encodes it in UTF-8 format.
   *
   * Reads the file pointed to by `path` and returns the UTF-8 encoded string. If the path does not point to a file, returns undefined.
   * @param path - An absolute path under the current Workspace, or a relative path to the Manifests' own absolute path.
   *               It is required to be resolvable by the provider of {@link IEnvContext}.
   * @returns The UTF-8 encoded string, or undefined.
   */
  readFile: (path: string) => Promise<string>;

  /**
   * 读取 path 指向的文件，并返回 base64 编码的字符串，若 path 所指向的路径找不到文件，则返回 undefined
   * @param path-是一个当前 Workspace 下的绝对路径，或者是相对于 Manifests 自身绝对路径的相对路径。要求能够被 IEnvContext 的提供者解析
   * @returns base64 编码的字符串，或 undefined
   */

  /**
   * Reads the file pointed to by `path` and returns the base64 encoded string. If the path does not point to a file, returns undefined.
   * @param path - An absolute path under the current Workspace, or a relative path to the Manifests' own absolute path.
   *               It is required to be resolvable by the provider of {@link IEnvContext}.
   * @returns The base64 encoded string, or undefined.
   */
  readFileAsBase64: (path: string) => Promise<string>;

  /**
   * Encodes a UTF-8 string in base64 format.
   * @param str - The string to encode.
   * @returns The base64 encoded string.
   */
  toBase64String: (str: string) => Promise<string>;

  /**
   * Reads the file names in the directory pointed to by `path`. If the path does not point to a directory, returns an empty array.
   * @param path - An absolute path under the current Workspace, or a relative path to the Manifests' own absolute path.
   *               It is required to be resolvable by the provider of {@link IEnvContext}.
   * @returns An array of file names in the directory, or an empty array.
   */
  readdir: (path: string) => Promise<string[]>;

  /**
   * Determines whether the path points to a directory.
   * @param path - An absolute path under the current Workspace, or a relative path to the Manifests' own absolute path.
   *               It is required to be resolvable by the provider of {@link IEnvContext}.
   * @returns True if the path points to a directory, false otherwise.
   */
  isDirectory: (path: string) => Promise<boolean>;

  /**
   * Calculates the SHA256 hash of a string.
   * @param content - The string to hash.
   * @returns The SHA256 hash of the string.
   */
  createHashOfSHA256: (content: string) => Promise<string>;
}

/**
 * @public
 */
export const mergeSchema = (packageSchema: JSONSchema7): JSONSchema7 => {
  const extractProperties = (sub: JSONSchema7Definition | undefined) => {
    if (sub === undefined || sub === true || sub === false) {
      return {};
    }
    return sub;
  };
  return {
    type: 'object',
    title: packageSchema?.title ?? 'Yuan Deploy Specification',
    required: ['package', 'key', ...(packageSchema.required?.filter((v) => v !== 'package') ?? [])],
    properties: {
      key: {
        title: 'component deployment Key',
        description: 'Specify the unique identifier of the deployment',
        type: 'string',
      },
      version: {
        title: 'Image Tag',
        description: 'Specify the Image Tag to deploy, leave empty to use the latest image',
        type: 'string',
      },
      package: {
        type: 'string',
        pattern: '^(@[a-z0-9-~][a-z0-9-._~]*/)?[a-z0-9-~][a-z0-9-._~]*$',
        ...extractProperties(packageSchema?.properties?.package),
      },
      env: {
        ...extractProperties(packageSchema?.properties?.env),
        type: 'object',
      },
      annotations: {
        ...extractProperties(packageSchema?.properties?.annotations),
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      cpu: {
        type: 'object',
        properties: {
          min: { type: 'string' },
          max: { type: 'string' },
        },
      },
      memory: {
        type: 'object',
        properties: {
          min: { type: 'string' },
          max: { type: 'string' },
        },
      },
      network: {
        type: 'object',
        properties: {
          backward_proxy: {
            ...extractProperties(
              extractProperties(packageSchema?.properties?.network)?.properties?.backward_proxy,
            ),
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          port_forward: {
            ...extractProperties(
              extractProperties(packageSchema?.properties?.network)?.properties?.port_forward,
            ),
            type: 'object',
            additionalProperties: { type: 'number' },
          },
        },
      },
      filesystem: {
        ...extractProperties(packageSchema?.properties?.filesystem),
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      one_json: {
        type: 'string',
        description: 'Inline JSON Data',
      },
    },
  };
};

/**
 * Deployment Provider
 * @public
 */
export interface IDeployProvider {
  /**
   * Generates a JSON schema for the deployment specification.
   * @returns The JSON schema for the deployment specification.
   */
  make_json_schema: () => JSONSchema7;

  /**
   * Generates a Docker Compose file for the deployment specification.
   * @param ctx - The deployment specification.
   * @param envCtx - The environment context.
   * @returns The Docker Compose file.
   */
  make_docker_compose_file: (ctx: IDeploySpec, envCtx: IEnvContext) => Promise<object>;

  /**
   * Generates Kubernetes resource objects for the deployment specification.
   * @param ctx - The deployment specification.
   * @param envCtx - The environment context.
   * @returns The Kubernetes resource objects.
   */
  make_k8s_resource_objects: (ctx: IDeploySpec, envCtx: IEnvContext) => Promise<object>;
}

/**
 * Generates environment variables in the format of a Docker Compose file.
 * @public
 * @param env - The environment variables.
 * @returns The environment variables in the format of a Docker Compose file.
 */
export function makeDockerEnvs(env?: Record<string, string>): string[] {
  return Object.entries(env ?? {}).map(([k, v]) => `${k}=${v}`);
}

/**
 * Generates environment variables in the format of a Kubernetes pod.
 * @public
 * @param env - The environment variables.
 * @returns The environment variables in the format of a Kubernetes pod.
 */
export function makeK8sEnvs(env?: Record<string, string>): { name: string; value: string }[] {
  return Object.entries(env ?? {}).map(([k, v]) => ({
    name: k,
    value: `${v}`,
  }));
}
