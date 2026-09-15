import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import { config } from '../../src/config/env.js';
import { pool } from '../../src/database/pool.js';
import { migrate } from '../../src/database/migrate.js';
import { bootstrapSuperuser } from '../../src/cpanel/auth/bootstrap.js';
import { verifyPassword } from '../../src/cpanel/auth/password.js';
import { AuthRepository } from '../../src/cpanel/auth/repository.js';
import { PermissionContext } from '../../src/cpanel/auth/permissions.js';
import { SessionRepository, tokenHash } from '../../src/cpanel/auth/sessions.js';

const schema = `auth_test_${randomUUID().replaceAll('-', '')}`;
const database = new pg.Pool({ ...config.database, options: `-c search_path=${schema}` });
const repository = new AuthRepository(database);
const sessions = new SessionRepository(database);
const input = { name: 'Test Super User', email: ' ADMIN@EXAMPLE.INVALID ', password: randomBytes(24).toString('hex'), phone: '123', job: 'Manager' };
let id: string;
before(async () => { await pool.query(`CREATE SCHEMA ${schema}`); await migrate(database); });
after(async () => { await database.end(); await pool.query(`DROP SCHEMA ${schema} CASCADE`); await pool.end(); });

test('bootstrap is atomic, concurrent-idempotent and never overwrites existing credentials/profile', async () => {
  const results = await Promise.all([bootstrapSuperuser(input, database), bootstrapSuperuser(input, database)]);
  assert.equal(results.filter(r => r.created).length, 1);
  id = results[0].id;
  assert.equal(results[1].id, id);
  const credentials = await repository.credentials('admin@example.invalid');
  assert.ok(credentials);
  assert.equal(credentials.password_hash.split('$')[1], 'argon2id');
  assert.deepEqual(credentials.password_hash.split('$')[3].split(',').sort(), ['m=65536', 'p=1', 't=3']);
  assert.notEqual(credentials.password_hash, input.password);
  assert.equal(await verifyPassword(credentials.password_hash, input.password), true);
  assert.equal(await verifyPassword(credentials.password_hash, randomBytes(20).toString('hex')), false);
  await bootstrapSuperuser({ ...input, name: 'Changed', password: randomBytes(20).toString('hex') }, database);
  assert.equal((await repository.user(id))?.name, input.name);
  assert.equal((await repository.credentials('admin@example.invalid'))?.password_hash, credentials.password_hash);
  assert.deepEqual([...await repository.permissions(id)], [['superuser', true]]);
  const context = new PermissionContext(id, repository);
  assert.equal(await context.hasPermission('arbitrary.future.action'), true);
  assert.equal(await context.getPermissionValue('arbitrary.future.limit'), undefined);
  assert.equal(await new PermissionContext(undefined, repository).hasPermission('superuser'), false);
});

test('database integrity, typed permissions, request caching, default deny and FK cascades', async () => {
  const { rows: [user] } = await database.query("INSERT INTO cpanel_users(name,job) VALUES('Normal user','Super User') RETURNING id");
  const hash = (await repository.credentials('admin@example.invalid'))!.password_hash;
  await assert.rejects(database.query('INSERT INTO cpanel_user_auth(user_id,email,password_hash) VALUES($1,$2,$3)', [user.id, 'admin@example.invalid', hash]), { code: '23505' });
  await assert.rejects(database.query('INSERT INTO cpanel_user_auth(user_id,email,password_hash) VALUES($1,$2,$3)', [user.id, 'UPPER@example.invalid', hash]), { code: '23514' });
  await assert.rejects(database.query('INSERT INTO cpanel_user_auth(user_id,email,password_hash) VALUES($1,$2,$3)', [user.id, 'normal@example.invalid', 'plaintext']), { code: '23514' });
  await assert.rejects(database.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES(999999,'x','true')"), { code: '23503' });
  await database.query('INSERT INTO cpanel_user_auth(user_id,email,password_hash) VALUES($1,$2,$3)', [user.id, 'normal@example.invalid', hash]);
  for (const [key, value] of Object.entries({ yes: true, no: false, limit: 10, text: 'true', config: { x: 1 }, superuser: 'true' })) {
    await database.query('INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,$2,$3)', [user.id, key, JSON.stringify(value)]);
  }
  await assert.rejects(database.query("INSERT INTO cpanel_user_permissions(user_id,key,value) VALUES($1,'yes','false')", [user.id]), { code: '23505' });
  let loads = 0;
  const counting = new AuthRepository(database);
  counting.permissions = async userId => { loads++; return repository.permissions(userId); };
  const permissions = new PermissionContext(user.id, counting);
  assert.equal(await permissions.hasPermission('yes'), true);
  for (const key of ['no', 'missing', 'limit', 'text', 'config']) assert.equal(await permissions.hasPermission(key), false);
  assert.equal(await permissions.getPermissionValue('limit'), 10);
  assert.deepEqual(await permissions.getPermissionValue('config'), { x: 1 });
  assert.equal(loads, 1);
  await database.query("UPDATE cpanel_user_permissions SET value='false' WHERE user_id=$1 AND key='yes'", [user.id]);
  assert.equal(await new PermissionContext(user.id, repository).hasPermission('yes'), false);
  await assert.rejects(bootstrapSuperuser({ ...input, email: 'normal@example.invalid' }, database), /non-superuser/);
  const session = await sessions.create(user.id);
  await database.query('DELETE FROM cpanel_users WHERE id=$1', [user.id]);
  assert.equal(await repository.credentials('normal@example.invalid'), undefined);
  assert.equal((await repository.permissions(user.id)).size, 0);
  assert.equal(await sessions.find(session.token), undefined);
});

test('session rotation, expiry, restart persistence and explicit destruction', async () => {
  const anonymous = await sessions.create();
  const authenticated = await sessions.create(id, anonymous.session.token_hash);
  assert.notEqual(anonymous.token, authenticated.token);
  assert.equal(await sessions.find(anonymous.token), undefined);
  assert.equal((await new SessionRepository(database).find(authenticated.token))?.user_id, id);
  assert.equal(authenticated.session.token_hash, tokenHash(authenticated.token));
  assert.notEqual(authenticated.session.token_hash, authenticated.token);
  await sessions.destroy(authenticated.session.token_hash);
  assert.equal(await sessions.find(authenticated.token), undefined);
  const expired = await sessions.create(id);
  await database.query("UPDATE cpanel_sessions SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [expired.session.token_hash]);
  assert.equal(await sessions.find(expired.token), undefined);
  await assert.rejects(sessions.create(id, expired.session.token_hash), /expired/);
});

test('bootstrap rolls back profile and credentials when permission insertion fails', async () => {
  const before = Number((await database.query('SELECT count(*) FROM cpanel_users')).rows[0].count);
  await database.query(`CREATE FUNCTION test_reject_permission() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test rollback'; END; $$;
    CREATE TRIGGER test_permission_failure BEFORE INSERT ON cpanel_user_permissions FOR EACH ROW EXECUTE FUNCTION test_reject_permission();`);
  try {
    await assert.rejects(bootstrapSuperuser({ ...input, email: 'rollback@example.invalid' }, database), /test rollback/);
    assert.equal(Number((await database.query('SELECT count(*) FROM cpanel_users')).rows[0].count), before);
    assert.equal(await repository.credentials('rollback@example.invalid'), undefined);
  } finally {
    await database.query('DROP TRIGGER test_permission_failure ON cpanel_user_permissions; DROP FUNCTION test_reject_permission()');
  }
});
