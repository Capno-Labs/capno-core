/**
 * The display face (Inter Tight 900, src/fonts/) is a ~4 KB SUBSET: it only
 * contains the glyphs below. Any other character silently falls back to
 * Arial Black mid-headline, so display type is for static authored copy that
 * passes `isDisplaySafe` — never scenario titles, names, emails or other
 * user data. Lowercase is fine: `.display` uppercases in CSS.
 *
 * Glyph set (dumped from the font's cmap): space ! & ' ( ) , - . / 0-9 : ; ?
 * A-Z plus en dash, em dash and the right single quote.
 */
const DISPLAY_SAFE = /^[A-Za-z0-9 !&'(),\-./:;?–—’]+$/;

export function isDisplaySafe(text: string): boolean {
  return DISPLAY_SAFE.test(text);
}
