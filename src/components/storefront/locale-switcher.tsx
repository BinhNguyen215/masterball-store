import { Globe } from "lucide-react";

import { getStorefrontCopy, STOREFRONT_LOCALES, type StorefrontLocale } from "@/i18n";

type LocaleSwitcherProps = {
  action: (formData: FormData) => Promise<void>;
  locale: StorefrontLocale;
};

/**
 * Progressive-enhancement switcher: each locale is a submit button that writes
 * the locale cookie through a server action, so the correct language is already
 * rendered on the server for the next request.
 */
export function LocaleSwitcher({ action, locale }: LocaleSwitcherProps) {
  const copy = getStorefrontCopy(locale).chrome.language;

  return (
    <form action={action} className="locale-switcher">
      <Globe aria-hidden="true" className="locale-switcher-icon" size={16} strokeWidth={1.8} />
      <span className="sr-only">{copy.label}</span>
      {STOREFRONT_LOCALES.map((value) => (
        <button
          aria-pressed={value === locale}
          className="locale-option"
          key={value}
          name="locale"
          type="submit"
          value={value}
        >
          {copy.options[value]}
        </button>
      ))}
    </form>
  );
}
