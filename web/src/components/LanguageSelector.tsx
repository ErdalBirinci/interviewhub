import { useTranslation } from "../i18n/useTranslation";
import { GlobeIcon, ChevronDownIcon } from "../components/icons";

export default function LanguageSelector() {
  const { t, currentLanguage, supportedLanguages, changeLanguage } = useTranslation();

  return (
    <div className="lang-selector">
      <button
        className="lang-selector__trigger btn btn--ghost btn--sm"
        aria-haspopup="listbox"
        aria-expanded="false"
        aria-label={t("nav.language")}
        title={t("nav.language")}
      >
        <GlobeIcon size={18} />
        <span className="lang-selector__current">
          {supportedLanguages.find((l) => l.code === currentLanguage)?.nativeName ?? currentLanguage}
        </span>
        <ChevronDownIcon size={14} />
      </button>

      <ul className="lang-selector__dropdown" role="listbox" aria-label={t("nav.language")}>
        {supportedLanguages.map((lang) => (
          <li key={lang.code} role="option" aria-selected={lang.code === currentLanguage}>
            <button
              className={`lang-selector__option ${lang.code === currentLanguage ? "lang-selector__option--active" : ""}`}
              onClick={() => changeLanguage(lang.code)}
            >
              <span className="lang-selector__name">{lang.nativeName}</span>
              <span className="lang-selector__english">{lang.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}