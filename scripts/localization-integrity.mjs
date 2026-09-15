import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Deliberately small convention: every UI translation call uses a literal key.
// This is a key inventory/check, never a source of translated values.
export function keysInSource(source, filename = 'source') {
  const keys = [];
  for (const match of source.matchAll(/\bt\s*\(/g)) {
    const literal = source.slice(match.index).match(/^t\s*\(\s*(['"])([a-z][\w]*(?:\.[a-z][\w]*)+)\1\s*\)/);
    if (!literal) throw new Error(`${filename}: use a literal semantic key in t(); dynamic calls cannot be audited reliably`);
    keys.push(literal[2]);
  }
  // Navigation stores literal key metadata and prepares labels through the shared translator.
  for (const match of source.matchAll(/\btranslationKey\s*:\s*(['"])([a-z][\w]*(?:\.[a-z][\w]*)+)\1/g)) keys.push(match[2]);
  return keys;
}

export async function collectUiKeys(root = 'src') {
  const keys = new Set();
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['vendor', 'database', 'localization'].includes(entry.name) && entry.isDirectory()) continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (/\.(ejs|ts|js)$/.test(entry.name)) {
        for (const key of keysInSource(await readFile(filename, 'utf8'), filename)) keys.add(key);
      }
    }
  }
  await visit(root);
  // The language route also emits translated validation messages.
  const filename = path.join(root, 'localization/http.ts');
  for (const key of keysInSource(await readFile(filename, 'utf8'), filename)) keys.add(key);
  return [...keys].sort();
}

export function translationIssues(keys, rows, requiredLanguages = ['tm', 'ru', 'en']) {
  const values = new Map(rows.map(row => [`${row.language_code}:${row.translation_key}`, row.translation_value]));
  const issues = [];
  for (const key of keys) {
    for (const language of requiredLanguages) {
      const value = values.get(`${language}:${key}`);
      if (typeof value !== 'string') issues.push(`${language}:${key}: missing translation`);
      else if (!value.trim() || value.trim() === key || /^(TODO|TRANSLATE|TBD|-)$/i.test(value.trim())) {
        issues.push(`${language}:${key}: placeholder/invalid translation`);
      }
    }
  }
  return issues;
}
