function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("th-TH")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ");
}

export function supportQueryMatches(value: string, query: string) {
  const normalizedValue = normalize(value);
  const normalizedQuery = normalize(query);

  if (!normalizedValue || !normalizedQuery) return false;
  return normalizedValue === normalizedQuery
    || normalizedValue.includes(normalizedQuery)
    || normalizedQuery.includes(normalizedValue);
}