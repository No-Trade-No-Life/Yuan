-- telegram_messages 表
CREATE TABLE IF NOT EXISTS
    public.telegram_messages (
        id serial4 NOT NULL,
        message TEXT NOT NULL,
        message_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        created_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at timestamptz DEFAULT CURRENT_TIMESTAMP NOT NULL,
        frozen_at timestamptz NULL,
        raw_data jsonb NOT NULL,
        CONSTRAINT telegram_messages_message_id_key UNIQUE (message_id),
        CONSTRAINT telegram_messages_pkey PRIMARY KEY (id)
    );

-- 修改 telegram_messages 表约束
ALTER TABLE telegram_messages
DROP CONSTRAINT IF EXISTS telegram_messages_pkey;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'telegram_messages'::regclass
        AND conname = 'telegram_messages_key'
    ) THEN
        ALTER TABLE telegram_messages
        ADD CONSTRAINT telegram_messages_key
        UNIQUE (id, created_at);
    END IF;
END $$;

ALTER TABLE telegram_messages
DROP CONSTRAINT IF EXISTS telegram_messages_message_id_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'telegram_messages'::regclass
        AND conname = 'telegram_messages_message_id_created_at_key'
    ) THEN
        ALTER TABLE telegram_messages
        ADD CONSTRAINT telegram_messages_message_id_created_at_key
        UNIQUE (message_id, created_at);
    END IF;
END $$;

-- 创建超表
PERFORM create_hypertable (
    'telegram_messages',
    by_range ('created_at'),
    migrate_data => TRUE,
    if_not_exists => TRUE
);
