-- series_data_range 表
CREATE TABLE IF NOT EXISTS
    series_data_range (
        series_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (series_id, table_name, start_time, end_time)
    );

CREATE INDEX IF NOT EXISTS idx_series_data_range_table_name_series_id_start_time ON series_data_range (
    table_name,
    series_id,
    start_time DESC
);

