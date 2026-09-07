// Street/road-type indicator words that hurt geocoding search quality when kept
// verbatim (e.g. "רחוב חי טייב בחדרה" geocodes worse than "חי טייב חדרה").
const LOCATION_TYPE_PREFIX_WORDS = new Set([
  "רחוב",
  "ברחוב",
  "שדרות",
  "בשדרות",
  "שד'",
  "בשד'",
  "כביש",
  "בכביש",
  "סמטת",
  "בסמטת",
]);

/**
 * Cleans up a free-text location phrase (from either the local Hebrew parser or
 * Gemini) into a geocoder-friendly search string: drops street/road-type filler
 * words, and strips a leading Hebrew preposition (ל/ב/מ) from the trailing word
 * (typically the city), e.g. "בחדרה" -> "חדרה".
 */
export function normalizeLocationQueryForGeocoding(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (!trimmed) {
    return trimmed;
  }

  const tokens = trimmed.split(/\s+/);

  while (tokens.length > 1 && LOCATION_TYPE_PREFIX_WORDS.has(tokens[0])) {
    tokens.shift();
  }

  if (tokens.length > 1) {
    const lastIndex = tokens.length - 1;
    const lastToken = tokens[lastIndex];
    if (lastToken.length > 3 && /^[בלמ]/.test(lastToken)) {
      tokens[lastIndex] = lastToken.slice(1);
    }
  }

  return tokens.join(" ");
}
