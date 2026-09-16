import { pool } from '../database/pool.js';
import type { Pool } from 'pg';

export interface Language {
  code: string;
  display_name: string;
  is_default: boolean;
  is_active?: boolean;
  sort_order?: number;
}
export interface LocalizationData {
  languages: Language[];
  translations: { language_code: string; translation_key: string; translation_value: string | null }[];
}

export async function readLocalizationData(database: Pool = pool): Promise<LocalizationData> {
  const client = await database.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const languages = await client.query<Language>(
      'SELECT code, display_name, is_default, is_active, sort_order FROM languages ORDER BY is_active DESC, sort_order, code',
    );
    const translations = await client.query<LocalizationData['translations'][number]>(`
      SELECT language_code, translation_key, translation_value
      FROM interface_translations
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
