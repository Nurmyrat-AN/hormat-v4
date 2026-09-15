import { pool } from '../src/database/pool.js';
import { collectUiKeys, translationIssues } from './localization-integrity.mjs';

try {
  const keys = await collectUiKeys();
  const { rows } = await pool.query('SELECT language_code, translation_key, translation_value FROM interface_translations');
  const issues = translationIssues(keys, rows);
  if (issues.length) throw new Error(issues.join('\n'));
  console.info(`Localization integrity passed: ${keys.length} UI keys have real tm/ru/en database values.`);
  console.info('After changing seed data, reload/restart running servers and verify their actual browser pages.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
