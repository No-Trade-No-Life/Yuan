-- twitter_monitor_users 表
CREATE TABLE IF NOT EXISTS
    twitter_monitor_users (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        frozen_at TIMESTAMPTZ
    );

-- 修改 twitter_monitor_users 表结构
ALTER TABLE twitter_monitor_users
DROP CONSTRAINT IF EXISTS twitter_monitor_users_pkey;

ALTER TABLE twitter_monitor_users
DROP COLUMN IF EXISTS id;

ALTER TABLE twitter_monitor_users
DROP CONSTRAINT IF EXISTS twitter_monitor_users_pk;

ALTER TABLE twitter_monitor_users
ADD CONSTRAINT twitter_monitor_users_pk PRIMARY KEY (user_id);
