CREATE TABLE discounts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 priority integer NOT NULL DEFAULT 0,
 starts_at timestamptz,
 ends_at timestamptz,
 before_action text NOT NULL DEFAULT 'removePercent' CHECK(before_action IN('addAmount','addPercent','fixed','removeAmount','removePercent')),
 before_value numeric CHECK(before_value >= 0 AND before_value < 'Infinity'::numeric),
 after_action text NOT NULL DEFAULT 'removeAmount' CHECK(after_action IN('addAmount','addPercent','fixed','removeAmount','removePercent')),
 after_value numeric CHECK(after_value >= 0 AND after_value < 'Infinity'::numeric),
 is_visible boolean NOT NULL DEFAULT false,
 is_visible_on_product boolean NOT NULL DEFAULT false,
 created_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(starts_at IS NULL OR isfinite(starts_at)),
 CHECK(ends_at IS NULL OR isfinite(ends_at)),
 CHECK(starts_at IS NULL OR ends_at IS NULL OR starts_at <= ends_at),
 CHECK(before_action NOT IN('addPercent','removePercent') OR before_value <= 100),
 CHECK(after_action NOT IN('addPercent','removePercent') OR after_value <= 100)
);
CREATE TRIGGER discounts_updated BEFORE UPDATE ON discounts
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE INDEX discounts_visibility_id ON discounts(is_visible,id DESC);
CREATE TABLE discount_translations (
 discount_id bigint NOT NULL REFERENCES discounts(id) ON DELETE RESTRICT,
 language_code text NOT NULL REFERENCES languages(code),
 name text NOT NULL CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(discount_id,language_code)
);
CREATE TRIGGER discount_translations_updated BEFORE UPDATE ON discount_translations
FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE product_discounts (
 product_id bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 discount_id bigint NOT NULL REFERENCES discounts(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(product_id,discount_id)
);
CREATE INDEX product_discounts_discount ON product_discounts(discount_id);
