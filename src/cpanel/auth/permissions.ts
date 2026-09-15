import { authRepository, type AuthRepository } from './repository.js';

// Construct only from server-validated identity, once per request. Never cache across requests.
export class PermissionContext {
  private values?: Promise<Map<string, unknown>>;
  constructor(private readonly userId: string | undefined, private readonly repository: AuthRepository = authRepository) {}
  private load(): Promise<Map<string, unknown>> {
    return this.values ??= this.userId ? this.repository.permissions(this.userId) : Promise.resolve(new Map());
  }
  async getPermissionValue(key: string): Promise<unknown> { return (await this.load()).get(key); }
  async hasPermission(key: string): Promise<boolean> {
    const values = await this.load();
    return values.get('superuser') === true || values.get(key) === true;
  }
}
