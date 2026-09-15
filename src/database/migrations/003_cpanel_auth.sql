CREATE TABLE cpanel_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (btrim(name) <> ''),
  phone text,
  job text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cpanel_user_auth (
  user_id bigint PRIMARY KEY REFERENCES cpanel_users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND length(email) <= 254),
  password_hash text NOT NULL CHECK (password_hash LIKE '$argon2id$%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cpanel_user_permissions (
  user_id bigint NOT NULL REFERENCES cpanel_users(id) ON DELETE CASCADE,
  key text NOT NULL CHECK (btrim(key) <> ''),
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
-- Anonymous sessions support server-side CSRF protection on the login form.
-- Only a SHA-256 digest of the random bearer token is persisted.
CREATE TABLE cpanel_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id bigint REFERENCES cpanel_users(id) ON DELETE CASCADE,
  csrf_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX cpanel_sessions_user_id ON cpanel_sessions(user_id);
CREATE INDEX cpanel_sessions_expires_at ON cpanel_sessions(expires_at);
CREATE FUNCTION cpanel_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER cpanel_users_updated BEFORE UPDATE ON cpanel_users
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TRIGGER cpanel_auth_updated BEFORE UPDATE ON cpanel_user_auth
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TRIGGER cpanel_permissions_updated BEFORE UPDATE ON cpanel_user_permissions
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
