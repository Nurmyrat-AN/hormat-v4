import { pool } from '../database/pool.js';
import type { Pool } from 'pg';

export interface Language {
  code: string;
  display_name: string;
  is_default: boolean;
}
export interface LocalizationData {
  languages: Language[];
  translations: { language_code: string; translation_key: string; translation_value: string }[];
}

export async function readLocalizationData(database: Pool = pool): Promise<LocalizationData> {
  const client = await database.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const languages = await client.query<Language>(
      'SELECT code, display_name, is_default FROM languages WHERE is_active ORDER BY sort_order, code',
    );
    const translations = await client.query<LocalizationData['translations'][number]>(`
      SELECT language_code, translation_key, translation_value
      FROM interface_translations JOIN languages ON code = language_code WHERE is_active
    `);
    await client.query('COMMIT');
    return { languages: languages.rows, translations: translations.rows };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
