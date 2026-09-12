import { ar } from "./dictionaries/ar";
import { en } from "./dictionaries/en";
import type { Locale } from "./config";

const dictionaries = { ar, en } as const;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export type { Dictionary } from "./dictionaries/ar";
export * from "./config";
