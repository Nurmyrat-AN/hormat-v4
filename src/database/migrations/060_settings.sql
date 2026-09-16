CREATE TABLE settings (
 key text PRIMARY KEY CHECK(length(key) BETWEEN 1 AND 200),
 value jsonb NOT NULL,
 type text NOT NULL CHECK(type IN ('string','integer','decimal','boolean','json')),
 updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(CASE type
 WHEN 'string' THEN jsonb_typeof(value)='string'
 WHEN 'integer' THEN jsonb_typeof(value)='string' AND (value#>>'{}') ~ '^-?(0|[1-9][0-9]*)$'
 WHEN 'decimal' THEN jsonb_typeof(value)='string' AND (value#>>'{}') ~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'
 WHEN 'boolean' THEN jsonb_typeof(value)='boolean'
 ELSE true END)
);
CREATE TRIGGER settings_updated BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
