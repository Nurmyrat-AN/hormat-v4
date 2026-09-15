INSERT INTO interface_translations(language_code,translation_key,translation_value) VALUES
('tm','cpanel.users.allStatuses','Ählisi'),
('ru','cpanel.users.allStatuses','Все'),
('en','cpanel.users.allStatuses','All'),
('tm','cpanel.users.superuser','Baş ulanyjy'),
('ru','cpanel.users.superuser','Суперпользователь'),
('en','cpanel.users.superuser','Super User'),
('tm','cpanel.users.protected','Baş ulanyjy goralýar. Şahsy maglumatlaryny we parolyny diňe öz profilinde üýtgedip biler.'),
('ru','cpanel.users.protected','Суперпользователь защищён. Личные данные и пароль он изменяет только в своём профиле.'),
('en','cpanel.users.protected','Super User is protected. Personal information and password can only be changed in their own profile.')
ON CONFLICT(language_code,translation_key) DO UPDATE SET translation_value=EXCLUDED.translation_value;
UPDATE interface_translations SET translation_value=CASE language_code
 WHEN 'tm' THEN 'Süzgüçleri arassalamak' WHEN 'ru' THEN 'Сбросить фильтры' WHEN 'en' THEN 'Reset filters' END
WHERE translation_key='cpanel.users.clear' AND language_code IN ('tm','ru','en');
