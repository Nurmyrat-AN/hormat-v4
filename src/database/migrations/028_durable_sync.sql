-- Durable source binding survives restarts; changing a source requires a future explicit reset.
CREATE TABLE vendor_sync_sources (
 vendor_id bigint PRIMARY KEY REFERENCES vendors(id) ON DELETE RESTRICT,
 source_url text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE transaction_types (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 transaction_kind text NOT NULL,
 type_code integer NOT NULL,
 name text NOT NULL,
 short_name text NOT NULL,
 book_1_effect smallint NOT NULL CHECK (book_1_effect BETWEEN -1 AND 1),
 book_2_effect smallint NOT NULL CHECK (book_2_effect BETWEEN -1 AND 1),
 customer_1_effect smallint NOT NULL CHECK (customer_1_effect BETWEEN -1 AND 1),
 customer_2_effect smallint NOT NULL CHECK (customer_2_effect BETWEEN -1 AND 1),
 warehouse_1_effect smallint NOT NULL CHECK (warehouse_1_effect BETWEEN -1 AND 1),
 warehouse_2_effect smallint NOT NULL CHECK (warehouse_2_effect BETWEEN -1 AND 1),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(transaction_kind,type_code)
);
CREATE TRIGGER transaction_types_updated BEFORE UPDATE ON transaction_types
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE TABLE source_stock_movements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 vendor_id bigint NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
 source_document_id text COLLATE "C" NOT NULL,
 product_id bigint NOT NULL,
 warehouse_id bigint NOT NULL,
 stock_delta numeric NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(vendor_id,source_document_id,product_id,warehouse_id),
 FOREIGN KEY(vendor_id,product_id) REFERENCES source_products(vendor_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(vendor_id,warehouse_id) REFERENCES warehouses(vendor_id,id) ON DELETE RESTRICT
);
CREATE INDEX source_stock_movements_product_idx ON source_stock_movements(product_id);
CREATE INDEX source_stock_movements_warehouse_idx ON source_stock_movements(warehouse_id);
CREATE TRIGGER source_stock_movements_updated BEFORE UPDATE ON source_stock_movements
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();

INSERT INTO transaction_types(
  transaction_kind,
  type_code,
  name,
  short_name,
  book_1_effect,
  book_2_effect,
  customer_1_effect,
  customer_2_effect,
  warehouse_1_effect,
  warehouse_2_effect
) VALUES

('fatura',101,'Inbound/Purchase','In./Purch.',-1,0,1,0,1,0),
('fatura',102,'Inbound/Return','In./Rtrn',-1,0,1,0,1,0),
('fatura',103,'Inbound/Other','In./Other',-1,0,1,0,1,0),

('fatura',201,'Outbound/Sale','Out./Sale',-1,0,-1,0,-1,0),
('fatura',202,'Outbound/Return','Out./Rtrn.',-1,0,-1,0,-1,0),
('fatura',203,'Outbound/Expense','Out./Expn',-1,0,-1,0,-1,0),
('fatura',204,'Outbound/Other','Out./Othr.',-1,0,-1,0,-1,0),

('fatura',601,'Warehouse to warehouse transfer','Wrhs. trnsf.',0,0,0,0,-1,1),

('kasa_islemi',101,'Inbound/Payment','In./Paym',1,0,1,0,0,0),
('kasa_islemi',102,'Inbound/Deposit','In./Dpst',1,0,-1,0,0,0),
('kasa_islemi',103,'Inbound/Loan','In./Loan',1,0,1,0,0,0),
('kasa_islemi',104,'Inbound/Other','In./Other',1,0,1,0,0,0),

('kasa_islemi',201,'Outbound/Payment','Out./Paym.',-1,0,-1,0,0,0),
('kasa_islemi',202,'Outbound/Expense','Out./Expns',-1,0,-1,0,0,0),
('kasa_islemi',203,'Outbound/Loan','Out./Loan',-1,0,-1,0,0,0),
('kasa_islemi',204,'Outbound/Other','Out./Other',-1,0,-1,0,0,0),

('kasa_islemi',400,'Book to book transfer','Book transf.',-1,1,0,0,0,0),
('kasa_islemi',500,'Customer to customer transfer','Customer transf.',-1,-1,1,-1,0,0),

('kasa_islemi',1001,'Initial balance: Credit','Init./Crdt.',-1,0,1,0,0,0),
('kasa_islemi',1002,'Initial balance: Debt','Init./Debt',-1,0,-1,0,0,0),

('kasa_islemi',1101,'Inbound product cheapened','In. prdc. chp.',-1,0,-1,0,0,0),
('kasa_islemi',1102,'Inbound product''s price increased','In. prdc. prc. incr',-1,0,1,0,0,0),
('kasa_islemi',1201,'Outbound product cheapened','Out prdc. chp.',-1,0,1,0,0,0),
('kasa_islemi',1202,'Outbound product''s price increased','Out. prdc. prc. incr.',-1,0,-1,0,0,0),

('kasa_islemi',1301,'Service provided (sold)','Srv. prov.',-1,0,-1,0,0,0),
('kasa_islemi',1302,'Service received (bought)','Srv. recv.',-1,0,1,0,0,0)

ON CONFLICT(transaction_kind,type_code)
DO UPDATE SET
  name=EXCLUDED.name,
  short_name=EXCLUDED.short_name,
  book_1_effect=EXCLUDED.book_1_effect,
  book_2_effect=EXCLUDED.book_2_effect,
  customer_1_effect=EXCLUDED.customer_1_effect,
  customer_2_effect=EXCLUDED.customer_2_effect,
  warehouse_1_effect=EXCLUDED.warehouse_1_effect,
  warehouse_2_effect=EXCLUDED.warehouse_2_effect,
  updated_at=now();
