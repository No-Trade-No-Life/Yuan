import { AddMigration } from '@yuants/sql';

AddMigration({
  id: '23c3bfad-4e37-412e-8f4e-2e6cfb0f1bff',
  dependencies: [],
  name: 'create-table-prometheus_rule',
  statement: `
    -- https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/
    CREATE TABLE IF NOT EXISTS prometheus_rule (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- 规则组信息
      group_name TEXT NOT NULL,
      
      -- 规则基本信息
      type TEXT NOT NULL CHECK (type IN ('alerting', 'recording')),
      name TEXT NOT NULL,
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

      UNIQUE(group_name, name)
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_prometheus_rule_group_name ON prometheus_rule(group_name);
    CREATE INDEX IF NOT EXISTS idx_prometheus_rule_type ON prometheus_rule(type);
    CREATE INDEX IF NOT EXISTS idx_prometheus_rule_name ON prometheus_rule(name);
    CREATE INDEX IF NOT EXISTS idx_prometheus_rule_labels ON prometheus_rule USING GIN(labels);
    CREATE INDEX IF NOT EXISTS idx_prometheus_rule_annotations ON prometheus_rule USING GIN(annotations);
    CREATE INDEX IF NOT EXISTS idx_prometheus_rule_created_at ON prometheus_rule(created_at);
    CREATE INDEX IF NOT EXISTS idx_prometheus_rule_created_at ON prometheus_rule(created_at);

    -- 创建更新时间触发器函数
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- 为规则表创建更新时间触发器
    DROP TRIGGER IF EXISTS update_prometheus_rule_updated_at ON prometheus_rule;
    CREATE TRIGGER update_prometheus_rule_updated_at
        BEFORE UPDATE ON prometheus_rule
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  `,
});
