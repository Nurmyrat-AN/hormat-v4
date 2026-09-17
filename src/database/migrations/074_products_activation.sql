-- Extend the existing source-linked identities without replacing any relationships.
ALTER TABLE products
 ADD COLUMN name text,
 ADD COLUMN is_visible boolean NOT NULL DEFAULT false,
 ADD COLUMN is_placement_product boolean NOT NULL DEFAULT false,
 ADD COLUMN show_as_in_stock boolean NOT NULL DEFAULT false,
 ADD COLUMN hide_when_out_of_stock boolean NOT NULL DEFAULT false,
 ADD COLUMN price_action text,
 ADD COLUMN price_value numeric,
 ADD COLUMN slug text,
 ADD COLUMN seo_title text,
 ADD COLUMN seo_description text,
 ADD COLUMN short_description text,
 ADD COLUMN description_html text,
 ADD COLUMN created_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 ADD COLUMN updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL;
UPDATE products p SET name=COALESCE(NULLIF(btrim(s.name),''),'Product '||p.id) FROM source_products s WHERE s.id=p.source_product_id;
ALTER TABLE products ALTER COLUMN name SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT products_name_valid CHECK(length(btrim(name))>0),
 ADD CONSTRAINT products_price_rule_valid CHECK(
 (price_action IS NULL AND price_value IS NULL) OR
 (price_action IS NOT NULL AND price_value IS NOT NULL AND price_action IN('addAmount','addPercent','fixed','removeAmount','removePercent') AND price_value>=0 AND price_value<'Infinity'::numeric)),
 ADD CONSTRAINT products_slug_valid CHECK(slug IS NULL OR (length(slug)<=120 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')),
 ADD CONSTRAINT products_slug_unique UNIQUE(slug);
-- Protect source identity even against accidentally over-broad future UPDATEs.
CREATE FUNCTION product_source_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.source_product_id IS DISTINCT FROM OLD.source_product_id THEN RAISE EXCEPTION 'PRODUCT_SOURCE_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER products_source_immutable BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION product_source_immutable();
CREATE TABLE product_translations (
 product_id bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 language_code text NOT NULL REFERENCES languages(code),
 name text, short_description text, description_html text, seo_title text, seo_description text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(product_id,language_code)
);
CREATE TRIGGER product_translations_updated BEFORE UPDATE ON product_translations FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE product_media (
 product_id bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
 media_reference text NOT NULL,
 sort_order integer NOT NULL CHECK(sort_order>=0),
 is_primary boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(product_id,media_reference),
 UNIQUE(product_id,sort_order) DEFERRABLE INITIALLY DEFERRED
);
CREATE UNIQUE INDEX product_media_one_primary ON product_media(product_id) WHERE is_primary;
CREATE TRIGGER product_media_updated BEFORE UPDATE ON product_media FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
