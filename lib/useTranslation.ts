import { useLanguage } from "./LanguageContext";
import { translate, type TranslationKey } from "./translations";

export function useTranslation() {
  const { language } = useLanguage();
  const t = (key: TranslationKey) => translate(key, language);
  return { t, language };
}
