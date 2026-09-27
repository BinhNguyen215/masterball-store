/**
 * Recently-viewed slugs, bounded and validated on both write and read.
 *
 * The value is display-only: every slug is re-resolved against published
 * products before it reaches a card, so the cookie needs no signature and can
 * stay readable by the browser. Slug characters come from the catalog slug
 * contract, so a dot is a safe separator and a comma never appears.
 */
export const RECENTLY_VIEWED_COOKIE_NAME = "masterball_recently_viewed";
export const RECENTLY_VIEWED_LIMIT = 10;
export const RECENTLY_VIEWED_RAIL_LIMIT = 4;
export const RECENTLY_VIEWED_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const MAX_SLUG_LENGTH = 160;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  if (!slug || slug.length > MAX_SLUG_LENGTH) return null;
  return SLUG_PATTERN.test(slug) ? slug : null;
}

/** Reads a cookie value into at most `RECENTLY_VIEWED_LIMIT` unique slugs. */
export function parseRecentlyViewedSlugs(value: unknown): string[] {
  if (typeof value !== "string") return [];

  const slugs: string[] = [];
  for (const part of value.split(".")) {
    if (slugs.length >= RECENTLY_VIEWED_LIMIT) break;
    const slug = normalizeSlug(part);
    if (!slug || slugs.includes(slug)) continue;
    slugs.push(slug);
  }
  return slugs;
}

/** Moves `slug` to the front of the list, dropping invalid and duplicate entries. */
export function rememberViewedSlug(slugs: readonly unknown[], slug: unknown): string[] {
  const head = normalizeSlug(slug);
  const ordered = head ? [head] : [];

  for (const candidate of slugs) {
    if (ordered.length >= RECENTLY_VIEWED_LIMIT) break;
    const value = normalizeSlug(candidate);
    if (!value || ordered.includes(value)) continue;
    ordered.push(value);
  }
  return ordered;
}

export function serializeRecentlyViewedSlugs(slugs: readonly string[]): string {
  return slugs.join(".");
}
