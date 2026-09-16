CREATE TABLE categories (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 parent_id bigint REFERENCES categories(id) ON DELETE RESTRICT CHECK(parent_id <> id),
 slug text NOT NULL CONSTRAINT categories_slug_unique UNIQUE CHECK(char_length(slug)<=120 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 seo_title text CHECK(char_length(seo_title)<=200),
 seo_description text CHECK(char_length(seo_description)<=2000),
 name text NOT NULL CHECK (name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 main_media_reference text,
 is_visible boolean NOT NULL DEFAULT false,
 created_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER categories_updated BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE category_translations (
 category_id bigint NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
 language_code text NOT NULL REFERENCES languages(code),
 name text CHECK (name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 seo_title text CHECK(seo_title IS NULL OR (seo_title=btrim(seo_title) AND char_length(seo_title) BETWEEN 1 AND 200)),
 seo_description text CHECK(seo_description IS NULL OR (seo_description=btrim(seo_description) AND char_length(seo_description) BETWEEN 1 AND 2000)),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(category_id,language_code)
);
CREATE TRIGGER category_translations_updated BEFORE UPDATE ON category_translations
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE category_media (
 category_id bigint NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
 media_reference text NOT NULL CHECK (media_reference <> ''),
 sort_order integer NOT NULL CHECK (sort_order >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(category_id,media_reference),
 UNIQUE(category_id,sort_order) DEFERRABLE INITIALLY DEFERRED
);
CREATE TRIGGER category_media_updated BEFORE UPDATE ON category_media
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

CREATE INDEX categories_visibility_id ON categories(is_visible,id DESC);

CREATE INDEX categories_parent_id ON categories(parent_id,id);
ALTER TABLE products ADD COLUMN category_id bigint REFERENCES categories(id) ON DELETE RESTRICT;
CREATE INDEX products_category_id ON products(category_id);
