CREATE TABLE frontend_currencies (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name text NOT NULL CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 code text NOT NULL CHECK(code=btrim(code) AND char_length(code) BETWEEN 1 AND 200),
 symbol text NOT NULL CHECK(symbol=btrim(symbol) AND char_length(symbol) BETWEEN 1 AND 200),
 rate numeric CHECK(rate > 0 AND rate < 'Infinity'::numeric),
 is_visible boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 0,
 created_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER frontend_currencies_updated BEFORE UPDATE ON frontend_currencies
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE INDEX frontend_currencies_order ON frontend_currencies(sort_order,id);
CREATE TABLE frontend_currency_translations (
 frontend_currency_id bigint NOT NULL REFERENCES frontend_currencies(id) ON DELETE RESTRICT,
 language_code text NOT NULL REFERENCES languages(code),
 name text NOT NULL CHECK(name=btrim(name) AND char_length(name) BETWEEN 1 AND 200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(frontend_currency_id,language_code)
);
CREATE TRIGGER frontend_currency_translations_updated BEFORE UPDATE ON frontend_currency_translations
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE vendor_currency_rates (
 vendor_id bigint NOT NULL,
 currency_id bigint PRIMARY KEY,
 rate numeric NOT NULL CHECK(rate > 0 AND rate < 'Infinity'::numeric),
 updated_by bigint REFERENCES cpanel_users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(vendor_id,currency_id) REFERENCES currencies(vendor_id,id) ON DELETE RESTRICT
);
CREATE TRIGGER vendor_currency_rates_updated BEFORE UPDATE ON vendor_currency_rates
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
