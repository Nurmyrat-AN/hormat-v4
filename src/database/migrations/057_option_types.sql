CREATE TABLE payment_types (
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
 CONSTRAINT payment_types_default_visible CHECK(NOT is_default OR is_visible)
);
CREATE UNIQUE INDEX payment_types_one_default ON payment_types(is_default) WHERE is_default;
CREATE INDEX payment_types_order ON payment_types(sort_order,id);
CREATE TRIGGER payment_types_updated BEFORE UPDATE ON payment_types FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE payment_type_translations (
 payment_type_id bigint NOT NULL REFERENCES payment_types(id) ON DELETE RESTRICT,
 language_code text NOT NULL REFERENCES languages(code),
 name text CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 description text CHECK(description=btrim(description) AND char_length(description) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(payment_type_id,language_code),
 CHECK(name IS NOT NULL OR description IS NOT NULL)
);
CREATE TRIGGER payment_type_translations_updated BEFORE UPDATE ON payment_type_translations FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE delivery_types (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 description text NOT NULL DEFAULT '' CHECK(char_length(description)<=4000),
 icon_media_reference text,
 sort_order integer NOT NULL DEFAULT 0,
 is_visible boolean NOT NULL DEFAULT false,
 is_default boolean NOT NULL DEFAULT false,
 is_free boolean NOT NULL DEFAULT true,
 price numeric NOT NULL DEFAULT 0 CHECK(price>=0 AND price<'Infinity'::numeric),
 CONSTRAINT delivery_free_price CHECK(NOT is_free OR price=0),
 created_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT delivery_types_default_visible CHECK(NOT is_default OR is_visible)
);
CREATE UNIQUE INDEX delivery_types_one_default ON delivery_types(is_default) WHERE is_default;
CREATE INDEX delivery_types_order ON delivery_types(sort_order,id);
CREATE TRIGGER delivery_types_updated BEFORE UPDATE ON delivery_types FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE delivery_type_translations (
 delivery_type_id bigint NOT NULL REFERENCES delivery_types(id) ON DELETE RESTRICT,
 language_code text NOT NULL REFERENCES languages(code),
 name text CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 description text CHECK(description=btrim(description) AND char_length(description) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(delivery_type_id,language_code),
 CHECK(name IS NOT NULL OR description IS NOT NULL)
);
CREATE TRIGGER delivery_type_translations_updated BEFORE UPDATE ON delivery_type_translations FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
