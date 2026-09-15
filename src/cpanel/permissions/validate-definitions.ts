/** Fail early on invalid metadata rather than silently overriding duplicate keys. */
export function validatePermissionDefinitions(groups: unknown): void {
  const invalid = () => { throw new Error('Invalid permission definition registry'); };
  const semantic = (value: unknown) => typeof value === 'string' && /^[a-z][\w]*(?:\.[a-z][\w]*)+$/.test(value);
  if (!Array.isArray(groups) || !groups.length) return invalid();
  const ids = new Set<string>(), keys = new Set<string>();
  let system = false;
  for (const group of groups) {
    if (!group || typeof group.id !== 'string' || !/^[a-z][a-zA-Z0-9_]*$/.test(group.id) || ids.has(group.id) || !semantic(group.translationKey) || !Array.isArray(group.permissions) || !group.permissions.length) return invalid();
    ids.add(group.id);
    for (const item of group.permissions) {
      if (!item || typeof item.key !== 'string' || (item.key !== 'superuser' && !semantic(item.key)) || keys.has(item.key) ||
        !['boolean','integer','decimal','string','json'].includes(item.valueType) || typeof item.assignable !== 'boolean' || !semantic(item.translationKey)) return invalid();
      keys.add(item.key);
      if (item.key === 'superuser') {
        if (item.assignable || item.valueType !== 'boolean') return invalid();
        system = true;
      }
    }
  }
  if (!system) invalid();
}
