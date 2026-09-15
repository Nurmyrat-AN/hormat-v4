import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { bootstrapSuperuser } from './bootstrap.js';
import { pool } from '../../database/pool.js';

// Interactive input avoids writing a password to .env, command history or source files.
async function input(label: string, value: string | undefined, hidden = false): Promise<string> {
  if (value) return value;
  if (!process.stdin.isTTY) throw new Error(`Set the bootstrap environment variables or run bootstrap in an interactive terminal (${label}).`);
  const output = hidden ? new Writable({ write(_chunk, _encoding, done) { done(); } }) : process.stdout;
  const readline = createInterface({ input: process.stdin, output, terminal: true });
  if (hidden) process.stdout.write(`${label}: `);
  try { return await readline.question(hidden ? '' : `${label}: `); }
  finally { readline.close(); if (hidden) process.stdout.write('\n'); }
}
try {
  const name = await input('Name', process.env.CPANEL_SUPERUSER_NAME);
  const email = await input('Email', process.env.CPANEL_SUPERUSER_EMAIL);
  const password = await input('Password (hidden, minimum 12 characters)', process.env.CPANEL_SUPERUSER_PASSWORD, true);
  delete process.env.CPANEL_SUPERUSER_PASSWORD;
  const result = await bootstrapSuperuser({ name, email, password, phone: process.env.CPANEL_SUPERUSER_PHONE,
    job: process.env.CPANEL_SUPERUSER_JOB, avatarUrl: process.env.CPANEL_SUPERUSER_AVATAR_URL });
  console.info(result.created ? 'Initial Super User created.' : 'Super User already exists; profile, password and permissions unchanged.');
} catch (error) {
  console.error('Super User bootstrap failed:', error instanceof Error ? error.message : 'Unknown error');
  process.exitCode = 1;
} finally { delete process.env.CPANEL_SUPERUSER_PASSWORD; await pool.end(); }
