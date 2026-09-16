INSERT INTO interface_translations(language_code,translation_key,translation_value) VALUES
('tm','cpanel.currencies.searchVendorCurrency','Üpjin ediji.Walýuta boýunça gözlemek'),
('ru','cpanel.currencies.searchVendorCurrency','Поиск Поставщик.Валюта'),
('en','cpanel.currencies.searchVendorCurrency','Search Vendor.Currency'),
('tm','cpanel.currencies.editVendor','Üpjin edijiniň walýutasyny üýtgetmek'),
('ru','cpanel.currencies.editVendor','Редактировать валюту поставщика'),
('en','cpanel.currencies.editVendor','Edit Vendor Currency'),
('tm','cpanel.currencies.vendorIdentity','Üpjin ediji.Walýuta'),
('ru','cpanel.currencies.vendorIdentity','Поставщик.Валюта'),
('en','cpanel.currencies.vendorIdentity','Vendor.Currency'),
('tm','cpanel.currencies.saveRate','Kursy saklamak'),
('ru','cpanel.currencies.saveRate','Сохранить курс'),
('en','cpanel.currencies.saveRate','Save Rate'),
('tm','cpanel.currencies.lockTranslations','Terjimeleri goşmak üçin ilki walýutany dörediň.'),
('ru','cpanel.currencies.lockTranslations','Сначала создайте валюту, чтобы добавить переводы.'),
('en','cpanel.currencies.lockTranslations','Create the Currency first to add translations.');
UPDATE interface_translations SET translation_value=CASE language_code WHEN 'tm' THEN 'Üpjin edijileriň walýutalary' WHEN 'ru' THEN 'Валюты поставщиков' WHEN 'en' THEN 'Vendor Currencies' END WHERE translation_key='cpanel.currencies.vendors' AND language_code IN('tm','ru','en');

INSERT INTO interface_translations(language_code,translation_key,translation_value) VALUES
('tm','cpanel.currencies.invalidRate','Noldan uly onluk kursy giriziň ýa-da sazlanmadyk ýagdaý üçin boş goýuň.'),
('ru','cpanel.currencies.invalidRate','Введите десятичный курс больше нуля или оставьте поле пустым: не настроено.'),
('en','cpanel.currencies.invalidRate','Enter a decimal rate greater than zero, or leave empty for Not configured.');
