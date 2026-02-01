import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import de from "./locales/de.json";
import it from "./locales/it.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import tr from "./locales/tr.json";
import ro from "./locales/ro.json";
import pl from "./locales/pl.json";
import ru from "./locales/ru.json";
import uk from "./locales/uk.json";
import ar from "./locales/ar.json";

const resources = {
  de: { translation: de },
  it: { translation: it },
  en: { translation: en },
  fr: { translation: fr },
  es: { translation: es },
  tr: { translation: tr },
  ro: { translation: ro },
  pl: { translation: pl },
  ru: { translation: ru },
  uk: { translation: uk },
  ar: { translation: ar },
};

function detectInitialLanguage(): string {
  // Priority: localStorage > browser language > default
  // Use consistent key with LanguageContext
  const stored = localStorage.getItem("lexora-language");
  if (stored) {
    const lang = stored.toLowerCase();
    if (lang in resources) return lang;
  }
  
  const browser = navigator.language.slice(0, 2).toLowerCase();
  if (browser in resources) return browser;
  
  return "de"; // Default
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectInitialLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    keySeparator: ".",
    nsSeparator: false,
    saveMissing: false,
    debug: false,
  });

export default i18n;
