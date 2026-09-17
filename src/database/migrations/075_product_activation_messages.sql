INSERT INTO interface_translations(language_code,translation_key,translation_value) VALUES
('tm','cpanel.products.saved','Üýtgeşmeler saklandy.'),
('ru','cpanel.products.saved','Изменения сохранены.'),
('en','cpanel.products.saved','Changes saved.'),
('tm','cpanel.products.diagnosticHelp','Häzirki saklanan şertler. Marka we kategoriýa ýagdaýy maglumat üçin görkezilýär.'),
('ru','cpanel.products.diagnosticHelp','Текущие сохранённые условия. Видимость бренда и категории показана для информации.'),
('en','cpanel.products.diagnosticHelp','Current saved conditions. Brand and Category visibility are informational.'),
('tm','cpanel.products.conflict','Maglumat üýtgedi ýa-da slug eýýäm ulanylýar. Gaýtadan açyp barlaň.'),
('ru','cpanel.products.conflict','Данные изменились или slug уже занят. Откройте запись заново и проверьте.'),
('en','cpanel.products.conflict','Data changed or the slug is already used. Reopen the record and check.')
ON CONFLICT(language_code,translation_key) DO UPDATE SET translation_value=excluded.translation_value;
