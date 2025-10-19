-- portal_config 表
CREATE TABLE IF NOT EXISTS
    portal_config (
        id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid (),
        external_host_url TEXT NOT NULL,
        is_import BOOLEAN NOT NULL,
        filter_schema JSONB NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

-- 为 is_import 字段创建索引，提高按类型查询的性能
CREATE INDEX IF NOT EXISTS idx_portal_config_is_import ON portal_config (is_import);

-- 为 updated_at 字段创建索引，方便增量同步
CREATE INDEX IF NOT EXISTS idx_portal_config_updated_at ON portal_config (updated_at);

-- 为 enabled 字段创建索引，方便查询启用的配置
CREATE INDEX IF NOT EXISTS idx_portal_config_enabled ON portal_config (enabled);

-- 自动更新 updated_at 字段的触发器
CREATE
OR REPLACE TRIGGER auto_update_updated_at BEFORE
UPDATE ON portal_config FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();