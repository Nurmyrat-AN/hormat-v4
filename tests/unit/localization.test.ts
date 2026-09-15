import { test } from 'node:test';
import assert from 'node:assert/strict';
import ejs from 'ejs';
import { LocalizationService } from '../../src/localization/service.js';
import { readLanguageCookie } from '../../src/localization/http.js';
import type { LocalizationData } from '../../src/localization/repository.js';

function data(): LocalizationData {
  return {
    languages: [
      { code: 'tm', display_name: 'Türkmen', is_default: true },
      { code: 'ru', display_name: 'Русский', is_default: false },
      { code: 'en', display_name: 'English', is_default: false },
    ],
    translations: [
      { language_code: 'tm', translation_key: 'common.save', translation_value: 'Ýatda sakla' },
      { language_code: 'ru', translation_key: 'common.save', translation_value: 'Сохранить' },
      { language_code: 'en', translation_key: 'common.save', translation_value: 'Save' },
      { language_code: 'tm', translation_key: 'common.cancel', translation_value: 'Ýatyr' },
    ],
  };
}

test('lookups use memory; requested language, default, key fallback and deduplicated warnings', async () => {
  let reads = 0;
  const warnings: string[] = [];
  const service = new LocalizationService(async () => { reads++; return data(); }, true, (message) => warnings.push(message));
  assert.throws(() => service.translate('tm', 'common.save'), /not been loaded/);
  await service.load();
  assert.equal(service.defaultLanguage, 'tm');
  for (const [code, value] of [['tm', 'Ýatda sakla'], ['ru', 'Сохранить'], ['en', 'Save']]) {
    assert.equal(service.forLanguage(code).t('common.save'), value);
  }
  assert.equal(service.translate('ru', 'common.cancel'), 'Ýatyr');
  assert.equal(service.translate('ru', 'missing.key'), 'missing.key');
  assert.equal(service.translate('ru', 'missing.key'), 'missing.key');
  assert.equal(warnings.length, 2);
  for (let i = 0; i < 100; i++) service.translate('en', 'common.save');
  assert.equal(reads, 1, 'No data-source calls during translation lookup');
  assert.equal(service.resolveLanguage('unknown'), 'tm');
  assert.equal(service.resolveLanguage(), 'tm');
});

test('reload is atomic, coalesces calls, retains old data on failure and supports additional languages', async () => {
  let source = data();
  let fail = false;
  let release: (() => void) | undefined;
  let pause: Promise<void> | undefined;
  const service = new LocalizationService(async () => {
    if (pause) await pause;
    if (fail) throw new Error('Database unavailable');
    return source;
  });
  await service.load();
  const oldRequest = service.forLanguage('en');
  source = data();
  source.languages.push({ code: 'de', display_name: 'Deutsch', is_default: false });
  source.translations.push({ language_code: 'de', translation_key: 'common.save', translation_value: 'Speichern' });
  source.translations.find((row) => row.language_code === 'en')!.translation_value = 'Updated';
  pause = new Promise<void>((resolve) => { release = resolve; });
  const first = service.reload();
  assert.equal(first, service.reload());
  assert.equal(service.translate('en', 'common.save'), 'Save');
  release!();
  await first;
  assert.equal(service.translate('en', 'common.save'), 'Updated');
  assert.equal(oldRequest.t('common.save'), 'Save', 'A request keeps its own consistent snapshot');
  assert.equal(service.translate('de', 'common.save'), 'Speichern');
  fail = true;
  await assert.rejects(service.reload(), /Database unavailable/);
  assert.equal(service.translate('de', 'common.save'), 'Speichern');
  fail = false;
  source.languages = source.languages.filter((language) => language.code !== 'en');
  await service.reload();
  assert.equal(service.isActive('en'), false);
  assert.equal(service.forLanguage('en').language, 'tm');
});

test('unusable cache fails initialization; empty values fall back; production does not warn', async () => {
  for (const defaults of [0, 2]) {
    const source = data();
    source.languages.forEach((language, index) => { language.is_default = index < defaults; });
    await assert.rejects(new LocalizationService(async () => source).load(), /exactly one/);
  }
  await assert.rejects(new LocalizationService(async () => ({ languages: [], translations: [] })).load(), /exactly one/);
  await assert.rejects(new LocalizationService(async () => ({ ...data(), translations: [] })).load(), /no interface translations/);
  const source = data();
  source.translations.find((row) => row.language_code === 'ru')!.translation_value = '  ';
  const service = new LocalizationService(async () => source, false, () => assert.fail('Production warning'));
  await service.load();
  assert.equal(service.translate('ru', 'common.save'), 'Ýatda sakla');
  assert.equal(service.translate('en', 'missing.key'), 'missing.key');
});

test('cookie decoding tolerates malformed and unrelated input', () => {
  assert.equal(readLanguageCookie('other=1; hormat_lang=ru; x=2'), 'ru');
  assert.equal(readLanguageCookie('hormat_lang=%65%6e'), 'en');
  assert.equal(readLanguageCookie('hormat_lang=%XX'), undefined);
  assert.equal(readLanguageCookie('other_hormat_lang=ru'), undefined);
  assert.equal(readLanguageCookie(), undefined);
});

test('real EJS page escapes translation values', async () => {
  const source = data();
  source.translations.push({ language_code: 'tm', translation_key: 'frontend.title', translation_value: '<script>alert(1)</script>' });
  const service = new LocalizationService(async () => source);
  await service.load();
  const html = await ejs.renderFile('src/views/frontend/pages/index.ejs', { ...service.forLanguage(), isDevelopment: false });
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
});
