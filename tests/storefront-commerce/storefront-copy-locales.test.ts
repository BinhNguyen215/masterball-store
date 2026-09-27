import { describe, expect, it } from "vitest";

import { getStorefrontCopy, type StorefrontLocale } from "@/i18n";

/**
 * A storefront page must render exactly one language, so the two copy trees are
 * checked against each other: no Vietnamese may leak into the English tree and
 * no key may silently ship the same untranslated value to both locales.
 */
const VIETNAMESE_LETTERS =
  /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

/** Proper nouns and data placeholders that are intentionally identical. */
const SHARED_VALUES = new Set([
  "chrome.language.options.vi",
  "chrome.language.options.en",
  "home.heroEyebrow",
  "home.categoryPokemonName",
  "home.categoryRiftboundName",
  "catalog.filters.gamePokemon",
  "catalog.filters.gameRiftbound",
  "catalog.filters.priceMinPlaceholder",
  "checkout.checkout.email",
  "checkout.checkout.phonePlaceholder",
  "orders.orderNumberPlaceholder",
  "orders.phonePlaceholder",
  "orders.itemLine",
  "orders.paymentMethodVnpay",
  "tournaments.filter.gamePokemon",
  "tournaments.filter.gameRiftbound",
]);

/** The switcher shows each language in its own script. */
const VIETNAMESE_IN_ENGLISH = new Set([
  "chrome.language.options.vi",
  "home.categoryPokemonName",
  "catalog.filters.gamePokemon",
  "tournaments.filter.gamePokemon",
]);

function leafEntries(value: unknown, prefix = ""): [string, string][] {
  if (typeof value === "string") return [[prefix, value]];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leafEntries(item, `${prefix}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      leafEntries(item, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

function copyLeaves(locale: StorefrontLocale) {
  return leafEntries(getStorefrontCopy(locale));
}

describe("storefront copy locales", () => {
  it("keeps Vietnamese text out of the English copy tree", () => {
    const offenders = copyLeaves("en").filter(
      ([path, value]) =>
        VIETNAMESE_LETTERS.test(value) && !VIETNAMESE_IN_ENGLISH.has(path),
    );

    expect(offenders).toEqual([]);
  });

  it("translates every key instead of reusing one string for both locales", () => {
    const english = new Map(copyLeaves("en"));
    const untranslated = copyLeaves("vi").filter(
      ([path, value]) => english.get(path) === value && !SHARED_VALUES.has(path),
    );

    expect(untranslated).toEqual([]);
  });

  it("declares the same keys for both locales", () => {
    const viPaths = copyLeaves("vi").map(([path]) => path);
    const enPaths = copyLeaves("en").map(([path]) => path);

    expect(enPaths).toEqual(viPaths);
  });
});
