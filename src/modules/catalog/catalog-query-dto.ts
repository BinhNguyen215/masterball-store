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
