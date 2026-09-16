import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { config } from '../../src/config/env.js';
import { migrate } from '../../src/database/migrate.js';
import { pool } from '../../src/database/pool.js';
import { readLocalizationData } from '../../src/localization/repository.js';
import { LocalizationService } from '../../src/localization/service.js';
import { collectUiKeys, translationIssues } from '../../scripts/localization-integrity.mjs';

const schema = `localization_test_${randomUUID().replaceAll('-', '')}`;
const database = new pg.Pool({ ...config.database, options: `-c search_path=${schema}` });
let created = false;
before(async () => {
  await pool.query(`CREATE SCHEMA ${schema}`);
  created = true;
  await migrate(database);
});
after(async () => {
  await database.end();
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
});

async function rejectsTransaction(sql: string, code: string): Promise<void> {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(async () => { await client.query(sql); await client.query('COMMIT'); }, { code });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

test('migration creates the initial languages, complete seed values and runs only once', async () => {
  const { rows } = await database.query('SELECT code, is_default, is_active FROM languages ORDER BY sort_order');
  assert.deepEqual(rows, [
    { code: 'tm', is_default: true, is_active: true },
    { code: 'ru', is_default: false, is_active: true },
    { code: 'en', is_default: false, is_active: true },
  ]);
  const keys = await database.query('SELECT translation_key, count(*)::int AS count FROM interface_translations GROUP BY translation_key');
  assert.equal(keys.rows.length, 753);
  assert.ok(keys.rows.every((row) => row.count === 3));
  await migrate(database);
  assert.equal((await database.query('SELECT * FROM schema_migrations')).rows.length, 70);
  assert.equal((await database.query('SELECT * FROM interface_translations')).rows.length, 2259);
});

test('fresh migrations cover every current UI key with real required-language values', async () => {
  const keys = await collectUiKeys();
  assert.equal(keys.length, 710);
  const { rows } = await database.query('SELECT language_code, translation_key, translation_value FROM interface_translations');
  assert.deepEqual(translationIssues(keys, rows), []);
});

test('database rejects duplicate, absent, inactive defaults and truncate; accepts an atomic switch', async () => {
  await rejectsTransaction("UPDATE languages SET is_default = true WHERE code = 'ru'", '23505');
  await rejectsTransaction("UPDATE languages SET is_default = false WHERE code = 'tm'", '23514');
  await rejectsTransaction("DELETE FROM languages WHERE code = 'tm'", '23514');
  await rejectsTransaction("UPDATE languages SET is_active = false WHERE code = 'tm'", '23514');
  await rejectsTransaction('TRUNCATE languages CASCADE', '23514');
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query("UPDATE languages SET is_default = false WHERE code = 'tm'");
    await client.query("UPDATE languages SET is_default = true WHERE code = 'ru'");
    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    assert.equal((await client.query('SELECT code FROM languages WHERE is_default')).rows[0].code, 'ru');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('translation keys are unique per language, nonempty and linked to registered languages', async () => {
  await rejectsTransaction("INSERT INTO interface_translations VALUES ('tm', 'frontend.title', 'duplicate')", '23505');
  await rejectsTransaction("INSERT INTO interface_translations VALUES ('unknown', 'common.example', 'value')", '23503');
  await rejectsTransaction("UPDATE interface_translations SET translation_value = ' ' WHERE language_code = 'en'", '23514');
});

function start(extra: Record<string, string> = {}) {
  const args = process.env.TEST_PRODUCTION === '1' ? ['dist/server.js'] : ['--import', 'tsx', 'src/server.ts'];
  const child = spawn(process.execPath, args, {
    env: { ...process.env, PGOPTIONS: `-c search_path=${schema}`, HOST: '127.0.0.1', PORT: '3107', NODE_ENV: 'test', ...extra, VENDOR_SYNC_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout!.on('data', (data) => { output += data; });
  child.stderr!.on('data', (data) => { output += data; });
  const exited = once(child, 'exit');
  return { child, exited, output: () => output };
}
async function waitForReady(server: ReturnType<typeof start>) {
  for (let i = 0; i < 200 && !server.output().includes('listening on'); i++) {
    assert.equal(server.child.exitCode, null, server.output());
    await delay(50);
  }
  assert.ok(server.output().includes('listening on'), server.output());
}
async function stop(server: ReturnType<typeof start>) {
  if (server.child.exitCode !== null) return;
  server.child.kill('SIGTERM');
  const timer = setTimeout(() => server.child.kill('SIGKILL'), 12000);
  try {
    const [code] = await server.exited;
    assert.equal(code, 0, server.output());
  } finally { clearTimeout(timer); }
}

test('real server uses database active-language registry; inactive cookie and switch are rejected', { timeout: 20000 }, async () => {
  await database.query("INSERT INTO languages (code, display_name, is_active) VALUES ('zz-test', 'Inactive test language', false)");
  const server = start();
  try {
    await waitForReady(server);
    for (const route of ['/', '/cpanel']) {
      const response = await fetch(`http://127.0.0.1:3107${route}`, { headers: { Cookie: 'hormat_lang=zz-test' } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-language'), 'tm');
    }
    const response = await fetch('http://127.0.0.1:3107/language', {
      method: 'POST', body: new URLSearchParams({ language: 'zz-test' }), redirect: 'manual',
    });
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('set-cookie'), null);
    // Existing cached translations remain usable when the database stops accepting this key.
    await database.query("DELETE FROM interface_translations WHERE language_code = 'ru' AND translation_key = 'frontend.title'");
    const cached = await fetch('http://127.0.0.1:3107/', { headers: { Cookie: 'hormat_lang=ru' } });
    assert.ok((await cached.text()).includes('Главная страница'));
  } finally { await stop(server); }
});

test('PostgreSQL reload reflects added languages, translation edits and the default fallback', async () => {
  const service = new LocalizationService(() => readLocalizationData(database));
  await service.load();
  assert.equal(service.isActive('zz-test'), false);
  assert.equal(service.translate('ru', 'frontend.title'), 'Baş sahypa');
  await database.query("INSERT INTO languages (code, display_name, is_active) VALUES ('de', 'Deutsch', true)");
  await database.query("INSERT INTO interface_translations VALUES ('de', 'frontend.title', 'Startseite')");
  assert.equal(service.isActive('de'), false);
  await service.reload();
  assert.equal(service.forLanguage('de').t('frontend.title'), 'Startseite');
  assert.equal(service.translate('de', 'cpanel.title'), 'Dolandyryş paneli');
  assert.equal(service.translate('de', 'missing.key'), 'missing.key');
});

test('startup with invalid credentials or absent localization tables fails before listening', { timeout: 20000 }, async () => {
  for (const extra of [{ DB_PASSWORD: 'invalid-test-password' }, { PGOPTIONS: '-c search_path=pg_catalog' }]) {
    const server = start(extra);
    const timer = setTimeout(() => server.child.kill('SIGKILL'), 8000);
    try {
      const [code] = await server.exited;
      assert.equal(code, 1, server.output());
      assert.ok(server.output().includes('Localization startup failed'), server.output());
      assert.ok(!server.output().includes('listening on'));
    } finally { clearTimeout(timer); if (server.child.exitCode === null) server.child.kill('SIGKILL'); }
  }
});

test('development refresh signal replaces a stale cache without restarting the server', { timeout: 20000 }, async () => {
  const server = start({ NODE_ENV: 'development' });
  try {
    await waitForReady(server);
    await database.query("UPDATE interface_translations SET translation_value = 'Reload verified' WHERE language_code = 'tm' AND translation_key = 'frontend.title'");
    const before = await fetch('http://127.0.0.1:3107/');
    assert.ok((await before.text()).includes('Baş sahypa'));
    server.child.kill('SIGUSR2');
    for (let i = 0; i < 100 && !server.output().includes('cache reloaded'); i++) await delay(50);
    assert.ok(server.output().includes('cache reloaded'), server.output());
    const after = await fetch('http://127.0.0.1:3107/');
    assert.ok((await after.text()).includes('Reload verified'));
  } finally { await stop(server); }
});
