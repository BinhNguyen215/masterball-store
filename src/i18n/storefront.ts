export const STOREFRONT_LOCALES = ["vi", "en"] as const;

export type StorefrontLocale = (typeof STOREFRONT_LOCALES)[number];

/** Readable by the browser on purpose: a preference, not a credential. */
export const STOREFRONT_LOCALE_COOKIE = "masterball_locale";
export const STOREFRONT_LOCALE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isStorefrontLocale(value: unknown): value is StorefrontLocale {
  return typeof value === "string" && STOREFRONT_LOCALES.includes(value as StorefrontLocale);
}

type CopyTree = { readonly [key: string]: string | CopyTree };

/**
 * Declares one surface's bilingual copy. Both locales must have the same key
 * shape, which TypeScript enforces through the shared generic.
 */
export function defineCopy<T extends CopyTree>(
  copy: { [K in StorefrontLocale]: T },
): { [K in StorefrontLocale]: T } {
  return copy;
}

/** Fills `{placeholder}` tokens in a copy string. */
export function formatCopy(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
