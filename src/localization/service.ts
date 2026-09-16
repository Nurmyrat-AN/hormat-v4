import type { Language, LocalizationData } from './repository.js';

type Snapshot = {
  languages: readonly Readonly<Language>[];
  defaultLanguage: string;
  anyTranslation: Map<string, string>;
  translations: Map<string, Map<string, string>>;
};

export class LocalizationService {
  private snapshot?: Snapshot;
  private pending?: Promise<void>;
  private warned = new Set<string>();
  private revision = 0;
  private loadedRevision = 0;

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

  /** Committed registry writes invalidate the existing cache, never individual lookups. */
  invalidate(): void { this.revision++; }

  async ensureFresh(): Promise<void> {
    while (this.loadedRevision !== this.revision) {
      // A load already in progress may have read a snapshot from before the commit.
      if (this.pending) await this.pending;
      if (this.loadedRevision !== this.revision) await this.reload();
    }
  }

  private async refresh(): Promise<void> {
    const revision = this.revision;
    const data = await this.readData();
    const active = data.languages.filter(language => language.is_active !== false);
    const defaults = active.filter((language) => language.is_default);
    if (defaults.length !== 1) throw new Error('Localization requires exactly one active default language. Run database migrations.');
    const translations = new Map(data.languages.map((language) => [language.code, new Map<string, string>()]));
    for (const row of data.translations) {
      if (row.translation_value?.trim()) translations.get(row.language_code)?.set(row.translation_key, row.translation_value);
    }
    const ordered = [...data.languages].sort((a,b) => Number(b.is_active !== false)-Number(a.is_active !== false) || (a.sort_order ?? 0)-(b.sort_order ?? 0) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    const anyTranslation = new Map<string,string>();
    for (const language of ordered) for (const [key,value] of translations.get(language.code) ?? []) {
      if (!anyTranslation.has(key)) anyTranslation.set(key,value);
    }
    this.snapshot = {
      languages: Object.freeze(active.map((language) => Object.freeze({ ...language }))),
      defaultLanguage: defaults[0].code,
      translations,
      anyTranslation,
    };
    this.loadedRevision = revision;
    this.warned.clear();
  }

  private current(): Snapshot {
    if (!this.snapshot) throw new Error('Localization cache has not been loaded.');
    return this.snapshot;
  }

  get languages(): readonly Readonly<Language>[] { return this.current().languages; }
  get defaultLanguage(): string { return this.current().defaultLanguage; }
  isActive(language: string): boolean { return this.current().languages.some(item => item.code === language); }
  resolveLanguage(language?: string): string {
    return language && this.isActive(language) ? language : this.defaultLanguage;
  }

  private lookup(snapshot: Snapshot, language: string, key: string): string {
    const value = snapshot.translations.get(language)?.get(key);
    if (value !== undefined) return value;
    const warningKey = `${language}:${key}`;
    if (this.development && !this.warned.has(warningKey) && this.warned.size < 1000) {
      this.warned.add(warningKey);
      this.warn(`[localization] Missing translation ${warningKey}; trying default language, then any available translation, then key.`);
    }
    return snapshot.translations.get(snapshot.defaultLanguage)?.get(key) ?? snapshot.anyTranslation.get(key) ?? key;
  }

  translate(language: string, key: string): string {
    return this.lookup(this.current(), language, key);
  }

  forLanguage(requested?: string) {
    const snapshot = this.current();
    const language = requested && snapshot.languages.some(item => item.code === requested) ? requested : snapshot.defaultLanguage;
    return {
      language,
      languages: snapshot.languages,
      t: (key: string): string => this.lookup(snapshot, language, key),
    };
  }
}
