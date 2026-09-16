UPDATE interface_translations SET translation_value = CASE language_code
 WHEN 'tm' THEN 'Üpjin edijileriň birikme sazlamalaryny dolandyryň.'
 WHEN 'ru' THEN 'Управляйте настройками подключения поставщиков.'
 WHEN 'en' THEN 'Manage supplier connection settings.'
 END
WHERE translation_key='cpanel.vendors.subtitle' AND language_code IN ('tm','ru','en');
