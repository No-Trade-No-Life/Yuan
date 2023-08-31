import { IDeploySpec } from '@yuants/protocol';
import { from, lastValueFrom, toArray } from 'rxjs';
import { bundleCode } from '../Agent/utils';

export const loadManifests = async (entry: string) => {
  const module: () => AsyncIterable<IDeploySpec> = await importModule(entry);
  return await lastValueFrom(
    from(module()).pipe(
      //
      toArray(),
    ),
  );
};

export const importModule = async (entry: string) => {
  const code = await bundleCode(entry);
  const module = new Function('DeployContext', `return ${code}`).call(undefined, { bundleCode });
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
