/** Whether `text` contains every word of `query`, ignoring case in the screen's language. An empty query matches all. */
export function matches(text: string, query: string, locale: string): boolean {
  const haystack = text.toLocaleLowerCase(locale);
  return query
    .trim()
    .toLocaleLowerCase(locale)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}
