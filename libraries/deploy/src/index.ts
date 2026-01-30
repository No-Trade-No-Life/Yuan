/**
 * A deploy is an configuration
 *
 * @public
 */
export interface IDeployment {
  /**
   * Unique identifier for the deployment
   */
  id: string;

  /**
   * package name for the deployment
   */
  package_name: string;

  /**
   * package version for the deployment
   */
  package_version: string;

  /**
   * Deployment setup command
   */
  command: string;

  /**
   * Arguments for the deployment command
   */
  args: string[];

  /**
   * Environment variables for the deployment
   */
  env: Record<string, string>;

  /**
   * Deployment type
   */
  type: 'daemon' | 'deployment';

  /**
   * Node Unit Address (ED25519 Public Key)
   *
   * If not empty, the deployment will be deployed to the specified Node Unit
   * If empty, the deployment will be deployed to any available Node Unit
   */
  address: string;

  /**
   * Is the deployment enabled?
   */
  enabled: boolean;

  /**
   * Timestamp when the deployment was created
   */
  created_at: string;

  /**
   * Timestamp when the deployment was last updated (Automatically updated on modification)
   */
  updated_at: string;
}
