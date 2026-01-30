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
