import type { Language, LocalizationData } from './repository.js';

type Snapshot = {
  languages: readonly Readonly<Language>[];
  defaultLanguage: string;
  translations: Map<string, Map<string, string>>;
};

export class LocalizationService {
  private snapshot?: Snapshot;
  private pending?: Promise<void>;
  private warned = new Set<string>();

  constructor(
    private readonly readData: () => Promise<LocalizationData>,
    private readonly development = false,
    private readonly warn: (message: string) => void = console.warn,
  ) {}

  load(): Promise<void> { return this.reload(); }

  reload(): Promise<void> {
    // Coalesce concurrent reloads; readers keep a complete previous snapshot.
    if (!this.pending) {
      this.pending = this.refresh().finally(() => { this.pending = undefined; });
    }
    return this.pending;
  }

  private async refresh(): Promise<void> {
    const data = await this.readData();
    const defaults = data.languages.filter((language) => language.is_default);
    if (defaults.length !== 1) throw new Error('Localization requires exactly one active default language. Run database migrations.');
    const translations = new Map(data.languages.map((language) => [language.code, new Map<string, string>()]));
    for (const row of data.translations) {
      if (row.translation_value.trim()) translations.get(row.language_code)?.set(row.translation_key, row.translation_value);
    }
    if (!translations.get(defaults[0].code)?.size) {
      throw new Error('Localization default language has no interface translations. Run database migrations.');
    }
    this.snapshot = {
      languages: Object.freeze(data.languages.map((language) => Object.freeze({ ...language }))),
      defaultLanguage: defaults[0].code,
      translations,
    };
    this.warned.clear();
  }

  private current(): Snapshot {
    if (!this.snapshot) throw new Error('Localization cache has not been loaded.');
    return this.snapshot;
  }

  get languages(): readonly Readonly<Language>[] { return this.current().languages; }
  get defaultLanguage(): string { return this.current().defaultLanguage; }
  isActive(language: string): boolean { return this.current().translations.has(language); }
  resolveLanguage(language?: string): string {
    return language && this.isActive(language) ? language : this.defaultLanguage;
  }

  private lookup(snapshot: Snapshot, language: string, key: string): string {
    const value = snapshot.translations.get(language)?.get(key);
    if (value !== undefined) return value;
    const warningKey = `${language}:${key}`;
    if (this.development && !this.warned.has(warningKey) && this.warned.size < 1000) {
      this.warned.add(warningKey);
      this.warn(`[localization] Missing translation ${warningKey}; trying default language, then key.`);
    }
    return snapshot.translations.get(snapshot.defaultLanguage)?.get(key) ?? key;
  }

  translate(language: string, key: string): string {
    return this.lookup(this.current(), language, key);
  }

  forLanguage(requested?: string) {
    const snapshot = this.current();
    const language = requested && snapshot.translations.has(requested) ? requested : snapshot.defaultLanguage;
    return {
      language,
      languages: snapshot.languages,
      t: (key: string): string => this.lookup(snapshot, language, key),
    };
  }
}
