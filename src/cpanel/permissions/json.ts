/** JSON.parse validates syntax; this preflight rejects ambiguous duplicate object keys. */
export function rejectDuplicateJsonKeys(source: string): void {
  const tokens = source.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) ?? [];
  const objects: (Set<string> | null)[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === '{') objects.push(new Set());
    else if (token === '[') objects.push(null);
    else if (token === '}' || token === ']') objects.pop();
    else if (token.startsWith('"') && tokens[index + 1] === ':' && objects.at(-1)) {
      const key = JSON.parse(token) as string;
      const keys = objects.at(-1)!;
      if (keys.has(key)) throw new Error('Duplicate JSON object key');
      keys.add(key);
    }
  }
}
