CREATE TABLE IF NOT EXISTS
    twitter_messages (
        id TEXT PRIMARY KEY,
        CONTENT TEXT NOT NULL,
        author TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_description TEXT NOT NULL,
        author_image TEXT NOT NULL,
        author_followers INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        frozen_at TIMESTAMPTZ,
        raw_data JSONB
    );

CREATE TABLE IF NOT EXISTS
    twitter_monitor_users (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        frozen_at TIMESTAMPTZ
    );

ALTER TABLE twitter_monitor_users
DROP CONSTRAINT IF EXISTS twitter_monitor_users_pkey;

ALTER TABLE twitter_monitor_users
DROP COLUMN IF EXISTS id;

ALTER TABLE twitter_monitor_users
DROP CONSTRAINT IF EXISTS twitter_monitor_users_pk;

ALTER TABLE twitter_monitor_users
ADD CONSTRAINT twitter_monitor_users_pk PRIMARY KEY (user_id);

CREATE EXTENSION IF NOT EXISTS timescaledb;

ALTER TABLE twitter_messages
DROP CONSTRAINT IF EXISTS twitter_messages_pkey;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'twitter_messages'::regclass
        AND conname = 'twitter_messages_key'
    ) THEN
        ALTER TABLE twitter_messages
        ADD CONSTRAINT twitter_messages_key
        UNIQUE (id, created_at);
    END IF;
END $$;

PERFORM create_hypertable (
    'twitter_messages',
    by_range ('created_at'),
    migrate_data => TRUE,
    if_not_exists => TRUE
);