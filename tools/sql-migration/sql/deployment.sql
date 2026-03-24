-- deployment 表
CREATE TABLE IF NOT EXISTS
    deployment (
        id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid (),
        command TEXT NOT NULL,
        args JSONB NOT NULL DEFAULT '[]',
        env JSONB NOT NULL DEFAULT '{}',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON deployment FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE INDEX IF NOT EXISTS deployment_command_idx ON deployment (command);

CREATE INDEX IF NOT EXISTS deployment_updated_at ON deployment (updated_at DESC);

CREATE INDEX IF NOT EXISTS deployment_enabled ON deployment (enabled);

-- 添加 package_name 和 package_version 列
ALTER TABLE deployment
ADD COLUMN IF NOT EXISTS package_name TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS package_version TEXT NOT NULL DEFAULT '';

-- 设置 command 列的默认值
ALTER TABLE deployment
ALTER COLUMN command
SET DEFAULT '';

-- 添加 address 列
ALTER TABLE deployment
ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';

-- 添加 type 列
ALTER TABLE deployment
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'deployment';

ALTER TABLE deployment
ADD COLUMN IF NOT EXISTS desired_replicas INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS selector TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS lease_ttl_seconds INT NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS heartbeat_interval_seconds INT NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS paused BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS observed_generation INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS spec_hash TEXT NOT NULL DEFAULT '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'deployment_desired_replicas_check'
    ) THEN
        ALTER TABLE deployment
        ADD CONSTRAINT deployment_desired_replicas_check CHECK (desired_replicas >= 1 AND desired_replicas <= 1024);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'deployment_lease_ttl_seconds_check'
    ) THEN
        ALTER TABLE deployment
        ADD CONSTRAINT deployment_lease_ttl_seconds_check CHECK (lease_ttl_seconds >= 1 AND lease_ttl_seconds <= 86400);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'deployment_heartbeat_interval_seconds_check'
    ) THEN
        ALTER TABLE deployment
        ADD CONSTRAINT deployment_heartbeat_interval_seconds_check CHECK (heartbeat_interval_seconds >= 1 AND heartbeat_interval_seconds <= 3600);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'deployment_observed_generation_check'
    ) THEN
        ALTER TABLE deployment
        ADD CONSTRAINT deployment_observed_generation_check CHECK (observed_generation >= 0);
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS deployment_assignment (
    assignment_id TEXT PRIMARY KEY NOT NULL,
    deployment_id UUID NOT NULL,
    node_id TEXT NOT NULL,
    replica_index INT,
    lease_holder TEXT NOT NULL,
    lease_expire_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    heartbeat_at TIMESTAMPTZ,
    exit_reason TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'Assigned',
    generation INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'deployment_assignment_state_check'
    ) THEN
        ALTER TABLE deployment_assignment
        ADD CONSTRAINT deployment_assignment_state_check CHECK (state IN ('Assigned', 'Running', 'Draining', 'Terminated'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'deployment_assignment_generation_check'
    ) THEN
        ALTER TABLE deployment_assignment
        ADD CONSTRAINT deployment_assignment_generation_check CHECK (generation >= 0);
    END IF;
END
$$;

CREATE OR REPLACE TRIGGER auto_update_deployment_assignment_updated_at BEFORE
UPDATE ON deployment_assignment FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

CREATE UNIQUE INDEX IF NOT EXISTS deployment_assignment_deployment_replica_idx ON deployment_assignment (deployment_id, replica_index)
WHERE replica_index IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS deployment_assignment_deployment_node_idx ON deployment_assignment (deployment_id, node_id)
WHERE replica_index IS NULL;

CREATE INDEX IF NOT EXISTS deployment_assignment_node_lease_idx ON deployment_assignment (node_id, lease_expire_at);

CREATE INDEX IF NOT EXISTS deployment_assignment_deployment_state_idx ON deployment_assignment (deployment_id, state);
