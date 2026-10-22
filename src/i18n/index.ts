import { en, type Dictionary } from "./dictionaries/en";

export type Locale = "en";
export const DEFAULT_LOCALE: Locale = "en";

const dictionaries: Record<Locale, Dictionary> = { en };

/** Hindi support adds "hi" to Locale and a dictionaries/hi.ts file. */
export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale];
}
