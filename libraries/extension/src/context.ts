import { IDeployProvider } from './deploy';

/**
 * The extension context.
 *
 * @public
 */
export interface IExtensionContext {
  /**
   * registers a deploy provider.
   */
  registerDeployProvider: (provider: IDeployProvider) => void;
}
