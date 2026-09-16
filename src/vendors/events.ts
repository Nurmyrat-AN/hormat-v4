export type VendorChangedField = 'name' | 'url' | 'username' | 'password' | 'is_active';
export interface VendorChanged {
  readonly vendorId: string;
  readonly changeType: 'create' | 'update' | 'status';
  readonly changedFields: readonly VendorChangedField[];
}
/** Process-local, post-commit notifications. Observer failures cannot undo a commit. */
export class VendorEvents {
  private listeners = new Set<(event: VendorChanged) => void>();
  subscribe(listener: (event: VendorChanged) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  publish(event: VendorChanged): void {
    const safe = Object.freeze({vendorId: event.vendorId, changeType: event.changeType,
      changedFields: Object.freeze([...event.changedFields])});
    for (const listener of this.listeners) {
      try { listener(safe); } catch { console.error('Vendor lifecycle observer failed.'); }
    }
  }
}
export const vendorEvents = new VendorEvents();
