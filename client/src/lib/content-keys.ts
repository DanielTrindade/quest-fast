type ContentKeyed<T> = { item: T; key: string };

/**
 * Keys for read-only lists whose rows carry no id: the row's own content
 * identifies it, and a per-content counter keeps equal rows apart. The list
 * keeps the same keys across re-renders, without falling back to the array
 * position, which would attach one row's DOM to another on any filter.
 */
export function contentKeys<T>(items: readonly T[]): ContentKeyed<T>[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = JSON.stringify(item) ?? String(item);
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return { item, key: occurrence === 1 ? base : `${base}#${occurrence}` };
  });
}
