-- https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/
CREATE TABLE IF NOT EXISTS
    prometheus_rule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        -- 规则组信息
        group_name TEXT NOT NULL,
        -- 规则基本信息
        TYPE TEXT NOT NULL CHECK (
            TYPE IN ('alerting', 'recording')
        ),
        NAME TEXT NOT NULL,
        expr TEXT NOT NULL,
        -- 报警规则专用字段
        alert_for TEXT DEFAULT NULL,
        alert_keep_firing_for TEXT DEFAULT NULL,
        -- 记录规则专用字段  
        record TEXT DEFAULT NULL,
        -- 通用字段
        labels JSONB DEFAULT '{}',
        annotations JSONB DEFAULT '{}',
        -- 元数据
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (group_name, NAME)
    );

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_prometheus_rule_group_name ON prometheus_rule (group_name);

CREATE INDEX IF NOT EXISTS idx_prometheus_rule_type ON prometheus_rule (
    TYPE
);

CREATE INDEX IF NOT EXISTS idx_prometheus_rule_name ON prometheus_rule (NAME);

CREATE INDEX IF NOT EXISTS idx_prometheus_rule_labels ON prometheus_rule USING GIN (labels);

CREATE INDEX IF NOT EXISTS idx_prometheus_rule_annotations ON prometheus_rule USING GIN (annotations);

CREATE INDEX IF NOT EXISTS idx_prometheus_rule_created_at ON prometheus_rule (created_at);

CREATE INDEX IF NOT EXISTS idx_prometheus_rule_created_at ON prometheus_rule (created_at);

-- 为规则表创建更新时间触发器
CREATE
OR REPLACE TRIGGER update_prometheus_rule_updated_at BEFORE
UPDATE ON prometheus_rule FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column ();

ALTER TABLE prometheus_rule
ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_prometheus_rule_enabled ON prometheus_rule (enabled);