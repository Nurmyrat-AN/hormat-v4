-- Storage only: no CouchDB mapping, stock calculation or checkpoint writes.

CREATE TABLE warehouses (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vendor_id bigint NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
 source_id text COLLATE "C" NOT NULL,
 name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (vendor_id, source_id),
 UNIQUE (vendor_id, id)
);
CREATE TRIGGER warehouses_updated BEFORE UPDATE ON warehouses
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

CREATE TABLE currencies (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vendor_id bigint NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
 source_id text COLLATE "C" NOT NULL,
 name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (vendor_id, source_id),
 UNIQUE (vendor_id, id)
);
CREATE TRIGGER currencies_updated BEFORE UPDATE ON currencies
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

CREATE TABLE measures (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vendor_id bigint NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
 source_id text COLLATE "C" NOT NULL,
 name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (vendor_id, source_id),
 UNIQUE (vendor_id, id)
);
CREATE TRIGGER measures_updated BEFORE UPDATE ON measures
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

CREATE TABLE source_products (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vendor_id bigint NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
 source_id text COLLATE "C" NOT NULL,
 name text NOT NULL,
 price numeric,
 measure_id bigint,
 currency_id bigint,
 is_active boolean NOT NULL DEFAULT true,
 property_1 text,
 property_2 text,
 property_3 text,
 property_4 text,
 property_5 text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (vendor_id, source_id),
 UNIQUE (vendor_id, id),
 FOREIGN KEY (vendor_id, measure_id) REFERENCES measures(vendor_id, id) ON DELETE RESTRICT,
 FOREIGN KEY (vendor_id, currency_id) REFERENCES currencies(vendor_id, id) ON DELETE RESTRICT
);
CREATE INDEX source_products_measure_idx ON source_products(measure_id);
CREATE INDEX source_products_currency_idx ON source_products(currency_id);
CREATE TRIGGER source_products_updated BEFORE UPDATE ON source_products
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

CREATE TABLE product_barcodes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vendor_id bigint NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
 product_id bigint NOT NULL,
 barcode text COLLATE "C" NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (product_id, barcode),
 FOREIGN KEY (vendor_id, product_id) REFERENCES source_products(vendor_id, id) ON DELETE RESTRICT
);
CREATE INDEX product_barcodes_vendor_idx ON product_barcodes(vendor_id);
CREATE TRIGGER product_barcodes_updated BEFORE UPDATE ON product_barcodes
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

CREATE TABLE product_stocks (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vendor_id bigint NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
 product_id bigint NOT NULL,
 warehouse_id bigint NOT NULL,
 stock numeric NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (product_id, warehouse_id),
 FOREIGN KEY (vendor_id, product_id) REFERENCES source_products(vendor_id, id) ON DELETE RESTRICT,
 FOREIGN KEY (vendor_id, warehouse_id) REFERENCES warehouses(vendor_id, id) ON DELETE RESTRICT
);
CREATE INDEX product_stocks_vendor_idx ON product_stocks(vendor_id);
CREATE INDEX product_stocks_warehouse_idx ON product_stocks(warehouse_id);
CREATE TRIGGER product_stocks_updated BEFORE UPDATE ON product_stocks
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

CREATE TABLE products (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_product_id bigint NOT NULL REFERENCES source_products(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_source_product_idx ON products(source_product_id);
CREATE TRIGGER products_updated BEFORE UPDATE ON products
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
