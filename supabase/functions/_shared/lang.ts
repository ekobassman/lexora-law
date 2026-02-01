export const SUPPORTED_LANGS = [
  "DE","EN","IT","FR","ES","TR","RO","PL","AR","RU","UK"
] as const;

export type SupportedLang = typeof SUPPORTED_LANGS[number];

export function normLang(input?: string): SupportedLang {
  const v = String(input || "EN").trim().toUpperCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(v) ? (v as SupportedLang) : "EN";
}

export const LOCALE_MAP: Record<SupportedLang, string> = {
  DE: "de-DE",
  EN: "en-US",
  IT: "it-IT",
  FR: "fr-FR",
  ES: "es-ES",
  TR: "tr-TR",
  RO: "ro-RO",
  PL: "pl-PL",
  AR: "ar-SA",
  RU: "ru-RU",
  UK: "uk-UA",
};
