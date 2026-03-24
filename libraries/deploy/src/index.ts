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
   * Desired replica count for deployment workloads.
   *
   * Phase A only allows 1.
   */
  desired_replicas?: number;

  /**
   * Node selector for daemon workloads.
   *
   * Empty string matches all nodes.
   */
  selector?: string;

  /**
   * Lease ttl in seconds.
   */
  lease_ttl_seconds?: number;

  /**
   * Heartbeat interval in seconds.
   */
  heartbeat_interval_seconds?: number;

  /**
   * Whether scheduling is paused for this deployment.
   */
  paused?: boolean;

  /**
   * Scheduler observed generation.
   */
  observed_generation?: number;

  /**
   * Stable hash for spec change detection.
   */
  spec_hash?: string;

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

/**
 * Assignment runtime state.
 *
 * @public
 */
export type IDeploymentAssignmentState = 'Assigned' | 'Running' | 'Draining' | 'Terminated';

/**
 * Deployment assignment record.
 *
 * @public
 */
export interface IDeploymentAssignment {
  assignment_id: string;
  deployment_id: string;
  node_id: string;
  replica_index: number | null;
  lease_holder: string;
  lease_expire_at: string;
  heartbeat_at: string | null;
  exit_reason: string;
  state: IDeploymentAssignmentState;
  generation: number;
  created_at: string;
  updated_at: string;
}
