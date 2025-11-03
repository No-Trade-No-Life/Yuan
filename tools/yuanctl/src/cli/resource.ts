export type ResourceKind = 'deployments' | 'deployment' | 'nodeunits' | 'deploymentlogs';

export interface ParsedResource {
  resource: ResourceKind;
  identifier?: string;
}

const normalizeResource = (input: string): ResourceKind => {
  const lowered = input.toLowerCase();
  switch (lowered) {
    case 'deployment':
    case 'deployments':
      return lowered;
    case 'nodeunit':
    case 'nodeunits':
      return 'nodeunits';
    case 'deploymentlog':
    case 'deploymentlogs':
      return 'deploymentlogs';
    default:
      throw new Error(`Unknown resource "${input}"`);
  }
};

export const parseResource = (resourceArg: string, nameArg?: string): ParsedResource => {
  let resource = resourceArg;
  let identifier: string | undefined;
  if (resource.includes('/')) {
    const [res, id] = resource.split('/', 2);
    resource = res;
    identifier = id;
  }
  if (nameArg) {
    if (nameArg.includes('/')) {
      const [res, id] = nameArg.split('/', 2);
      const nextResource = normalizeResource(res);
      if (resourceArg && normalizeResource(resource) !== nextResource) {
        throw new Error(`Resource mismatch between "${resourceArg}" and "${nameArg}"`);
      }
      resource = res;
      identifier = id;
    } else {
      identifier = nameArg;
    }
  }
  return {
    resource: normalizeResource(resource),
    identifier,
  };
};
