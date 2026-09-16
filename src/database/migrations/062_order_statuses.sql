CREATE TABLE order_statuses (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=4000),
 icon_media_reference text,
 sort_order integer NOT NULL DEFAULT 0,
 is_visible boolean NOT NULL DEFAULT false,
 is_default boolean NOT NULL DEFAULT false,
 created_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT order_statuses_default_visible CHECK(NOT is_default OR is_visible)
);
CREATE UNIQUE INDEX order_statuses_one_default ON order_statuses(is_default) WHERE is_default;
CREATE INDEX order_statuses_order ON order_statuses(sort_order,id);
CREATE TRIGGER order_statuses_updated BEFORE UPDATE ON order_statuses FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE order_status_translations (
 order_status_id bigint NOT NULL REFERENCES order_statuses(id) ON DELETE RESTRICT,
 language_code text NOT NULL REFERENCES languages(code),
 name text CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 description text CHECK(description=btrim(description) AND char_length(description) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(order_status_id,language_code),
 CHECK(name IS NOT NULL OR description IS NOT NULL)
);
CREATE TRIGGER order_status_translations_updated BEFORE UPDATE ON order_status_translations FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
