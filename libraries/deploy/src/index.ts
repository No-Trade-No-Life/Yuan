import { AddMigration } from '@yuants/sql';

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

AddMigration({
  id: 'b9fcea5f-f772-4e79-9055-af4ca238dcad',
  name: 'create_table_deployment',
  dependencies: [],
  statement: `
        CREATE TABLE IF NOT EXISTS deployment (
            id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
            command TEXT NOT NULL,
            args JSONB NOT NULL DEFAULT '[]',
            env JSONB NOT NULL DEFAULT '{}',
            enabled BOOLEAN NOT NULL DEFAULT true,

            created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        create or replace trigger auto_update_updated_at before update on deployment for each row execute function update_updated_at_column();

        CREATE INDEX IF NOT EXISTS deployment_command_idx ON deployment (command);
        CREATE INDEX IF NOT EXISTS deployment_updated_at ON deployment (updated_at desc);
        CREATE INDEX IF NOT EXISTS deployment_enabled ON deployment (enabled);

    `,
});

AddMigration({
  id: 'c0934318-1618-4d65-961e-eb266190197b',
  name: 'add_columns_package_name_version_to_deployment',
  dependencies: ['b9fcea5f-f772-4e79-9055-af4ca238dcad'],
  statement: `
        ALTER TABLE deployment
        ADD COLUMN IF NOT EXISTS package_name TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS package_version TEXT NOT NULL DEFAULT '';
  `,
});
