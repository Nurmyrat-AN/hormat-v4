CREATE TABLE vendors (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL CHECK (btrim(name) <> ''),
 url text NOT NULL CHECK (btrim(url) <> ''),
 username text NOT NULL CHECK (btrim(username) <> ''),
 password_encrypted text NOT NULL CHECK (password_encrypted ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'),
 is_active boolean NOT NULL DEFAULT true,
 last_sequence text,
 date_last_sync timestamptz,
 date_last_operation timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER vendors_updated BEFORE UPDATE ON vendors
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
