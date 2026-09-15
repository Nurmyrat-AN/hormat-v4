import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { config } from '../../src/config/env.js';
import { pool } from '../../src/database/pool.js';
import { migrate } from '../../src/database/migrate.js';
import { bootstrapSuperuser } from '../../src/cpanel/auth/bootstrap.js';
import { SessionRepository } from '../../src/cpanel/auth/sessions.js';
import { PasswordChangeRepository } from '../../src/cpanel/auth/password-change-repository.js';
import { changePassword } from '../../src/cpanel/auth/password-change.js';
import { verifyPassword } from '../../src/cpanel/auth/password.js';
const schema = `password_test_${randomUUID().replaceAll('-', '')}`;
const db = new pg.Pool({ ...config.database, options: `-c search_path=${schema}` });
const sessions = new SessionRepository(db);
const repository = new PasswordChangeRepository(db);
const old = 'Original test password 123';
const next = 'Replacement test password 456';
before(async () => { await pool.query(`CREATE SCHEMA ${schema}`); await migrate(db); });
after(async () => { await db.end(); await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end(); });
const user = () => bootstrapSuperuser({ name: 'Password test', email: `${randomUUID()}@example.invalid`, password: old }, db);
const snapshot = async (id: string) => (await db.query('SELECT to_jsonb(u) profile,to_jsonb(a) auth,(SELECT jsonb_agg(p) FROM cpanel_user_permissions p WHERE p.user_id=u.id) permissions FROM cpanel_users u JOIN cpanel_user_auth a ON a.user_id=u.id WHERE u.id=$1', [id])).rows[0];

test('validation, atomic password replacement, unchanged profile/permissions and session isolation', async () => {
  const a = await user(), b = await user();
  const current = await sessions.create(a.id), other = await sessions.create(a.id), unrelated = await sessions.create(b.id);
  const before = await snapshot(a.id);
  for (const [input, expected] of [
    [{}, 'required'],
    [{ currentPassword: 'wrong', newPassword: next, confirmPassword: next }, 'incorrect'],
    [{ currentPassword: old, newPassword: 'short', confirmPassword: 'short' }, 'policy'],
    [{ currentPassword: old, newPassword: 'ä'.repeat(600), confirmPassword: 'ä'.repeat(600) }, 'policy'],
    [{ currentPassword: old, newPassword: next, confirmPassword: old }, 'mismatch'],
    [{ currentPassword: old, newPassword: old, confirmPassword: old }, 'same'],
  ] as const) {
    assert.equal(await changePassword(a.id, current.session.token_hash, input, repository), expected);
    assert.deepEqual(await snapshot(a.id), before);
  }
  assert.equal(await changePassword(a.id, current.session.token_hash, { currentPassword: old, newPassword: next, confirmPassword: next }, repository), 'success');
  const after = await snapshot(a.id);
  assert.deepEqual(after.profile, before.profile); assert.deepEqual(after.permissions, before.permissions);
  assert.equal(after.auth.email, before.auth.email);
  assert.notEqual(after.auth.updated_at, before.auth.updated_at);
  assert.equal(await verifyPassword(after.auth.password_hash, old), false);
  assert.equal(await verifyPassword(after.auth.password_hash, next), true);
  assert.ok(!JSON.stringify(after).includes(next));
  assert.ok(await sessions.find(current.token)); assert.equal(await sessions.find(other.token), undefined); assert.ok(await sessions.find(unrelated.token));
  // A login that verified the old hash cannot create a session after this commit.
  await assert.rejects(sessions.create(a.id, undefined, before.auth.password_hash), /Credentials changed/);
});

test('invalidated context and concurrent changes cannot reuse stale authority', async () => {
  const a = await user(); const first = await sessions.create(a.id), second = await sessions.create(a.id);
  const input = { currentPassword: old, newPassword: next, confirmPassword: next };
  const results = await Promise.allSettled([changePassword(a.id, first.session.token_hash, input, repository), changePassword(a.id, second.session.token_hash, input, repository)]);
  assert.equal(results.filter(r => r.status === 'fulfilled' && r.value === 'success').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
});

test('session invalidation failure rolls back password update', async () => {
  const a = await user(); const current = await sessions.create(a.id); await sessions.create(a.id);
  const before = await snapshot(a.id);
  await db.query("CREATE FUNCTION deny_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END $$; CREATE TRIGGER fail_delete BEFORE DELETE ON cpanel_sessions FOR EACH ROW EXECUTE FUNCTION deny_session_delete()");
  try { await assert.rejects(changePassword(a.id, current.session.token_hash, { currentPassword: old, newPassword: next, confirmPassword: next }, repository)); }
  finally { await db.query('DROP TRIGGER fail_delete ON cpanel_sessions'); }
  assert.deepEqual(await snapshot(a.id), before);
  assert.equal((await db.query('SELECT * FROM cpanel_sessions WHERE user_id=$1', [a.id])).rowCount, 2);
});
