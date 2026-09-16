-- Support deterministic name pagination, globally and scoped to a Vendor.
CREATE INDEX source_products_name_id ON source_products(name,id);
CREATE INDEX source_products_vendor_name_id ON source_products(vendor_id,name,id);
INSERT INTO interface_translations(language_code,translation_key,translation_value) VALUES
('tm','cpanel.sourceProducts.failed','Çeşme maglumatlaryny ýükläp bolmady. Täzeden synanyşyň.'),
('ru','cpanel.sourceProducts.failed','Не удалось загрузить данные источника. Повторите попытку.'),
('en','cpanel.sourceProducts.failed','Could not load source data. Please retry.'),
('tm','cpanel.sourceProducts.refine','Ilkinji 50 wariant görkezilýär. Gözlegi daraldyň.'),
('ru','cpanel.sourceProducts.refine','Показаны первые 50 вариантов. Уточните поиск.'),
('en','cpanel.sourceProducts.refine','Showing the first 50 options. Refine your search.');
