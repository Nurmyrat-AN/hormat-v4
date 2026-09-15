import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keysInSource, translationIssues } from '../../scripts/localization-integrity.mjs';

test('integrity detects a newly used key absent from database seed data', () => {
  const keys = keysInSource("<%= t('cpanel.login.newLabel') %>");
  assert.equal(translationIssues(keys, []).length, 3);
});

test('integrity detects an omitted language and key-as-value or placeholder translations', () => {
  const key = 'common.save';
  const row = (language_code: string, translation_value: string) => ({ language_code, translation_key: key, translation_value });
  assert.deepEqual(translationIssues([key], [row('tm', 'Ýatda sakla'), row('ru', 'Сохранить')]), ['en:common.save: missing translation']);
  for (const value of [key, 'TODO', 'TRANSLATE', '-', '  ']) {
    assert.match(translationIssues([key], [row('tm', 'Ýatda sakla'), row('ru', 'Сохранить'), row('en', value)])[0], /invalid/);
  }
});

test('integrity recognizes literal EJS/server calls and rejects unauditable dynamic keys', () => {
  assert.deepEqual(keysInSource("response.locals.t('errors.notFound'); <%= t(\"cpanel.title\") %>"), ['errors.notFound', 'cpanel.title']);
  assert.throws(() => keysInSource("t('cpanel.login.feature' + suffix)"), /literal/);
  assert.throws(() => keysInSource('t(key)'), /literal/);
});
