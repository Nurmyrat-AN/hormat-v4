CREATE TABLE brands (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL CHECK (name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 main_media_reference text,
 is_visible boolean NOT NULL DEFAULT false,
 created_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER brands_updated BEFORE UPDATE ON brands
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE brand_translations (
 brand_id bigint NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
 language_code text NOT NULL REFERENCES languages(code),
 name text NOT NULL CHECK (name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(brand_id,language_code)
);
CREATE TRIGGER brand_translations_updated BEFORE UPDATE ON brand_translations
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE brand_media (
 brand_id bigint NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
 media_reference text NOT NULL CHECK (media_reference <> ''),
 sort_order integer NOT NULL CHECK (sort_order >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(brand_id,media_reference),
 UNIQUE(brand_id,sort_order) DEFERRABLE INITIALLY DEFERRED
);
CREATE TRIGGER brand_media_updated BEFORE UPDATE ON brand_media
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

CREATE INDEX brands_visibility_id ON brands(is_visible,id DESC);
