UPDATE interface_translations SET translation_value = CASE language_code
 WHEN 'tm' THEN 'Bu media HORMAT-da ulanylýan bolup biler. Adyny üýtgetmek ýa-da pozmak suratlaryň we faýllaryň elýeterli bolmazlygyna sebäp bolup biler.'
 WHEN 'ru' THEN 'Эти файлы могут использоваться в HORMAT. Переименование или удаление может привести к неработающим изображениям и ссылкам на файлы.'
 WHEN 'en' THEN 'This media may be used by HORMAT. Renaming or deleting it may cause broken images or missing files.'
 END
WHERE translation_key = 'cpanel.media.risk' AND language_code IN ('tm','ru','en');
