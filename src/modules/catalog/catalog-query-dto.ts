import { z } from "zod";

const listValue = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item).split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}, z.array(z.string().min(1)).max(30));

const optionalInteger = (minimum: number) =>
  z.preprocess(
    (value) => (value === undefined || value === null || value === "" ? undefined : value),
    z.coerce.number().int().min(minimum).optional(),
  );

export const storefrontProductQuerySchema = z
  .object({
    q: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
      z.string().max(100).optional(),
    ),
    game: listValue,
    set: listValue,
    tag: listValue,
    type: listValue.pipe(z.array(z.enum(["SEALED", "SINGLE", "ACCESSORY"]))),
    language: listValue,
    condition: listValue,
    availability: z.enum(["all", "in-stock", "out-of-stock"]).default("all"),
    minPrice: optionalInteger(0),
    maxPrice: optionalInteger(0),
    sort: z
      .enum(["featured", "newest", "price-asc", "price-desc", "title-asc"])
      .default("featured"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(24),
  })
  .superRefine((value, context) => {
    if (
      value.minPrice !== undefined &&
      value.maxPrice !== undefined &&
      value.minPrice > value.maxPrice
    ) {
      context.addIssue({
        code: "custom",
        message: "minPrice must not exceed maxPrice",
        path: ["minPrice"],
      });
    }
  });

export type StorefrontProductQuery = z.infer<typeof storefrontProductQuerySchema>;
export type StorefrontProductQueryInput =
  | URLSearchParams
  | Record<string, unknown>;

function normalizeInput(input: StorefrontProductQueryInput): Record<string, unknown> {
  if (!(input instanceof URLSearchParams)) return input;
  const normalized: Record<string, string | string[]> = {};
  for (const key of new Set(input.keys())) {
    const values = input.getAll(key);
    normalized[key] = values.length > 1 ? values : (values[0] ?? "");
  }
  return normalized;
}

export function parseStorefrontProductQuery(
  input: StorefrontProductQueryInput = {},
): StorefrontProductQuery {
  return storefrontProductQuerySchema.parse(normalizeInput(input));
}

const STOREFRONT_LIST_KEYS = [
  "game",
  "set",
  "tag",
  "type",
  "language",
  "condition",
] as const;
const MAX_LIST_ITEMS = 30;
const MAX_SEARCH_LENGTH = 100;
const MAX_SLUG_LENGTH = 160;
/** Mirrors the catalog slug contract, so only reachable tags survive sanitizing. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PAGE_SIZE = 48;
const MAX_PAGE_NUMBER = 1_000;
const DEFAULT_PAGE_SIZE = 24;
const PRODUCT_TYPES = ["SEALED", "SINGLE", "ACCESSORY"] as const;
const AVAILABILITY_VALUES = ["all", "in-stock", "out-of-stock"] as const;
const SORT_VALUES = [
  "featured",
  "newest",
  "price-asc",
  "price-desc",
  "title-asc",
] as const;

function scalarValue(value: unknown): string | undefined {
  const candidate = Array.isArray(value)
    ? value.find((item) => typeof item === "string" && item.trim())
    : value;
  if (typeof candidate !== "string") return undefined;
  const trimmed = candidate.trim();
  return trimmed === "" ? undefined : trimmed;
}

function listValues(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [value];
  return items
    .flatMap((item) =>
      item === undefined || item === null ? [] : String(item).split(","),
    )
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST_ITEMS);
}

function boundedInteger(value: unknown, minimum: number, maximum?: number) {
  const raw = scalarValue(value);
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum) return undefined;
  if (maximum !== undefined && parsed > maximum) return undefined;
  return parsed;
}

function isMember<T extends readonly string[]>(
  values: T,
  value: string | undefined,
): value is T[number] {
  return value !== undefined && values.includes(value);
}

/**
 * Coerces untrusted storefront URL parameters into the accepted query shape.
 * Public catalog links carry user- and crawler-authored values, so a malformed
 * or oversized parameter must degrade to a bounded query instead of failing the
 * render. Programmatic callers keep the strict `parseStorefrontProductQuery`
 * contract.
 */
export function sanitizeStorefrontProductQueryInput(
  input: StorefrontProductQueryInput = {},
): Record<string, unknown> {
  const source = normalizeInput(input);
  const sanitized: Record<string, unknown> = {};

  const query = scalarValue(source.q)?.slice(0, MAX_SEARCH_LENGTH);
  if (query) sanitized.q = query;

  for (const key of STOREFRONT_LIST_KEYS) {
    let values = listValues(source[key]);
    if (key === "type") {
      values = values
        .map((value) => value.toUpperCase())
        .filter((value) =>
          isMember(PRODUCT_TYPES, value as (typeof PRODUCT_TYPES)[number]),
        );
    }
    if (key === "tag") {
      // Tag slugs are the only list parameter matched against a slug column, so
      // anything outside the catalog slug contract is dropped instead of quoted.
      values = [
        ...new Set(
          values
            .map((value) => value.toLowerCase())
            .filter(
              (value) =>
                value.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(value),
            ),
        ),
      ];
    }
    if (values.length) sanitized[key] = values;
  }

  const availability = scalarValue(source.availability);
  sanitized.availability = isMember(AVAILABILITY_VALUES, availability)
    ? availability
    : "all";

  const sort = scalarValue(source.sort);
  sanitized.sort = isMember(SORT_VALUES, sort) ? sort : "featured";

  let minPrice = boundedInteger(source.minPrice, 0);
  let maxPrice = boundedInteger(source.maxPrice, 0);
  // A contradictory range is dropped rather than rejected.
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    minPrice = undefined;
    maxPrice = undefined;
  }
  if (minPrice !== undefined) sanitized.minPrice = minPrice;
  if (maxPrice !== undefined) sanitized.maxPrice = maxPrice;

  // A page number is also an OFFSET multiplier, so an unbounded value would ask
  // Postgres to skip an arbitrary number of rows.
  sanitized.page = boundedInteger(source.page, 1, MAX_PAGE_NUMBER) ?? 1;
  sanitized.pageSize =
    boundedInteger(source.pageSize, 1, MAX_PAGE_SIZE) ?? DEFAULT_PAGE_SIZE;

  return sanitized;
}
