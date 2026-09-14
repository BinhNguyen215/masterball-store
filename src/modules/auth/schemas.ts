import { z } from "zod";

const identifier = z.string().trim().min(1).max(128);
const text = z.string().trim().max(2_000);
const optionalIdentifier = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().uuid().nullable(),
);
const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().date().optional(),
);
const optionalShortText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
  z.string().max(250).nullable(),
);
const checkbox = z.preprocess((value) => value === "on", z.boolean());

export const productMutationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create"),
    title: z.string().trim().min(2).max(180),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
    gameId: identifier,
    setId: optionalIdentifier,
    type: z.enum(["SEALED", "SINGLE", "ACCESSORY"]),
    description: text,
    featured: checkbox,
    seoTitle: optionalShortText,
    seoDescription: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
      z.string().max(500).nullable(),
    ),
  }),
  z.object({
    operation: z.literal("update-product"),
    productId: identifier,
    version: z.coerce.number().int().positive(),
    title: z.string().trim().min(2).max(180),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
    gameId: identifier,
    setId: optionalIdentifier,
    type: z.enum(["SEALED", "SINGLE", "ACCESSORY"]),
    description: text,
    featured: checkbox,
    seoTitle: optionalShortText,
    seoDescription: z.preprocess(
      (value) => (typeof value === "string" && value.trim() ? value.trim() : null),
      z.string().max(500).nullable(),
    ),
  }),
  z.object({
    operation: z.literal("create-variant"),
    productId: identifier,
    sku: z.string().trim().min(1).max(120),
    language: z.string().trim().min(1).max(50),
    condition: z.string().trim().max(80).optional(),
    edition: z.string().trim().max(80).optional(),
    finish: z.string().trim().max(80).optional(),
    priceVnd: z.coerce.number().int().nonnegative().max(2_147_483_647),
    weightGram: z.coerce.number().int().nonnegative().max(2_147_483_647).default(0),
  }),
  z.object({
    operation: z.literal("update-variant"),
    variantId: identifier,
    version: z.coerce.number().int().positive(),
    sku: z.string().trim().min(1).max(120),
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    language: z.string().trim().min(1).max(50),
    condition: z.string().trim().max(80).optional(),
    edition: z.string().trim().max(80).optional(),
    finish: z.string().trim().max(80).optional(),
    priceVnd: z.coerce.number().int().nonnegative().max(2_147_483_647),
    weightGram: z.coerce.number().int().nonnegative().max(2_147_483_647),
  }),
  z.object({
    operation: z.literal("status"),
    productId: identifier,
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    version: z.coerce.number().int().positive(),
  }),
  z.object({
    operation: z.literal("create-game"),
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  }),
  z.object({
    operation: z.literal("game-status"),
    gameId: identifier,
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  }),
  z.object({
    operation: z.literal("create-set"),
    gameId: identifier,
    name: z.string().trim().min(1).max(160),
    code: z.string().trim().min(1).max(80),
    releaseDate: optionalDate,
  }),
  z.object({
    operation: z.literal("set-status"),
    setId: identifier,
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  }),
  z.object({
    operation: z.literal("create-tag"),
    name: z.string().trim().min(1).max(120),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160),
  }),
  z.object({
    operation: z.literal("replace-tags"),
    productId: identifier,
    tagIds: z.string().transform((value) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ).pipe(z.array(z.string().uuid()).max(50)),
  }),
]);

export const inventoryMutationSchema = z.object({
  variantId: identifier,
  delta: z.coerce.number().int().min(-100_000).max(100_000).refine((value) => value !== 0),
  reason: z.string().trim().min(3).max(240),
});

export const orderMutationSchema = z.object({
  orderId: identifier,
  targetStatus: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  trackingCode: z.string().trim().max(120).optional(),
  note: z.string().trim().max(500).optional(),
  version: z.coerce.number().int().positive(),
});

export const paymentMutationSchema = z.object({
  paymentId: z.string().uuid(),
  operation: z.literal("reconcile"),
});

const dateTime = z.string().trim().min(1).transform((value, context) => {
  const withZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
    ? `${value}:00+07:00`
    : value;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) {
    context.addIssue({ code: "custom", message: "Thời gian không hợp lệ." });
    return z.NEVER;
  }
  return parsed.toISOString();
});

export const tournamentMutationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("create"),
    title: z.string().trim().min(2).max(180),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(180),
    gameId: identifier,
    summary: z.string().trim().min(2).max(1_000),
    venueName: z.string().trim().min(2).max(240),
    startsAt: dateTime,
    endsAt: dateTime,
    registrationDeadline: dateTime.optional(),
    rules: z.string().trim().min(2).max(10_000),
  }).superRefine((value, context) => {
    if (Date.parse(value.startsAt) >= Date.parse(value.endsAt)) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "Thời gian kết thúc phải sau thời gian bắt đầu." });
    }
    if (value.registrationDeadline && Date.parse(value.registrationDeadline) > Date.parse(value.startsAt)) {
      context.addIssue({ code: "custom", path: ["registrationDeadline"], message: "Hạn đăng ký không thể sau giờ bắt đầu." });
    }
  }),
  z.object({
    operation: z.literal("status"),
    tournamentId: identifier,
    status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED", "CANCELLED"]),
    currentStatus: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"]),
    publishAt: dateTime.optional(),
    version: z.coerce.number().int().positive(),
  }),
]);

export const importQuerySchema = z.object({
  dryRun: z.enum(["true", "false"]).default("true").transform((value) => value === "true"),
});
