CREATE TABLE languages (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'),
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT languages_default_active CHECK (NOT is_default OR is_active)
);

CREATE UNIQUE INDEX languages_one_default ON languages (is_default) WHERE is_default;

-- A partial unique index prevents two defaults; this deferred check prevents zero.
-- Switch defaults by clearing the old flag and setting the new one in ONE transaction.
CREATE FUNCTION check_language_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM languages WHERE is_default AND is_active) THEN
    RAISE EXCEPTION 'Exactly one active default interface language is required'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER languages_require_default
AFTER INSERT OR UPDATE OR DELETE ON languages
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_language_default();

-- TRUNCATE does not fire row constraint triggers and would remove the default.
CREATE FUNCTION prevent_languages_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Cannot truncate languages: an active default language is required'
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER languages_no_truncate BEFORE TRUNCATE ON languages
FOR EACH STATEMENT EXECUTE FUNCTION prevent_languages_truncate();

CREATE TABLE interface_translations (
  language_code text NOT NULL REFERENCES languages(code) ON UPDATE CASCADE ON DELETE CASCADE,
  translation_key text NOT NULL CHECK (translation_key ~ '^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$'),
  translation_value text NOT NULL CHECK (btrim(translation_value) <> ''),
  PRIMARY KEY (language_code, translation_key)
);

INSERT INTO languages (code, display_name, is_default, sort_order) VALUES
  ('tm', 'Türkmen', true, 0), ('ru', 'Русский', false, 1), ('en', 'English', false, 2);

INSERT INTO interface_translations (language_code, translation_key, translation_value) VALUES
  ('tm', 'frontend.title', 'Baş sahypa'),
  ('ru', 'frontend.title', 'Главная страница'),
  ('en', 'frontend.title', 'Frontend'),
  ('tm', 'cpanel.title', 'Dolandyryş paneli'),
  ('ru', 'cpanel.title', 'Панель управления'),
  ('en', 'cpanel.title', 'CPanel'),
  ('tm', 'errors.notFound', 'Sahypa tapylmady'),
  ('ru', 'errors.notFound', 'Страница не найдена'),
  ('en', 'errors.notFound', 'Not Found'),
  ('tm', 'errors.internalServer', 'Serweriň içerki ýalňyşlygy'),
  ('ru', 'errors.internalServer', 'Внутренняя ошибка сервера'),
  ('en', 'errors.internalServer', 'Internal Server Error'),
  ('tm', 'errors.invalidLanguage', 'Saýlanan dil elýeterli däl'),
  ('ru', 'errors.invalidLanguage', 'Выбранный язык недоступен'),
  ('en', 'errors.invalidLanguage', 'Selected language is unavailable'),
  ('tm', 'errors.invalidRequest', 'Nädogry haýyş'),
  ('ru', 'errors.invalidRequest', 'Некорректный запрос'),
  ('en', 'errors.invalidRequest', 'Invalid request');
