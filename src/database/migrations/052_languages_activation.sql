-- Reuse the existing registry and its default/active constraints; preserve every row.
-- Fresh installs run all seeds in one transaction. Flush their deferred checks
-- before altering the registry, then restore the normal deferred contract.
SET CONSTRAINTS languages_require_default IMMEDIATE;
ALTER TABLE languages ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE languages ALTER COLUMN is_active SET DEFAULT false;
CREATE TRIGGER languages_updated BEFORE UPDATE ON languages
 FOR EACH ROW EXECUTE FUNCTION cpanel_touch_updated_at();
CREATE FUNCTION prevent_language_code_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.code IS DISTINCT FROM OLD.code THEN
  RAISE EXCEPTION 'Language code is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER languages_immutable_code BEFORE UPDATE OF code ON languages
 FOR EACH ROW EXECUTE FUNCTION prevent_language_code_change();
SET CONSTRAINTS languages_require_default DEFERRED;
