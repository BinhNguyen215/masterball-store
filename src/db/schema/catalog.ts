import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const catalogStatusEnum = pgEnum("catalog_status", [
  "DRAFT",
  "ACTIVE",
  "ARCHIVED",
]);

export const productTypeEnum = pgEnum("product_type", [
  "SEALED",
  "SINGLE",
  "ACCESSORY",
]);

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: catalogStatusEnum("status").default("DRAFT").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const productSets = pgTable(
  "product_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    releaseDate: date("release_date", { mode: "string" }),
    status: catalogStatusEnum("status").default("DRAFT").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("product_sets_game_code_unique").on(table.gameId, table.code),
    unique("product_sets_game_id_id_unique").on(table.gameId, table.id),
    index("product_sets_game_status_idx").on(table.gameId, table.status),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    setId: uuid("set_id"),
    type: productTypeEnum("type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").default("").notNull(),
    status: catalogStatusEnum("status").default("DRAFT").notNull(),
    featured: boolean("featured").default(false).notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    version: integer("version").default(1).notNull(),
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      name: "products_game_set_fk",
      columns: [table.gameId, table.setId],
      foreignColumns: [productSets.gameId, productSets.id],
    }).onDelete("restrict"),
    index("products_storefront_idx").on(
      table.status,
      table.featured,
      table.publishedAt,
    ),
    index("products_game_set_idx").on(table.gameId, table.setId),
    check("products_version_check", sql`${table.version} > 0`),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    sku: text("sku").notNull().unique(),
    status: catalogStatusEnum("status").default("DRAFT").notNull(),
    language: text("language").notNull(),
    condition: text("condition"),
    edition: text("edition"),
    finish: text("finish"),
    attributes: jsonb("attributes")
      .$type<Record<string, string | number | boolean>>()
      .default({})
      .notNull(),
    priceVnd: integer("price_vnd").notNull(),
    weightGram: integer("weight_gram").default(0).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check("product_variants_price_vnd_check", sql`${table.priceVnd} >= 0`),
    check("product_variants_weight_gram_check", sql`${table.weightGram} >= 0`),
    check("product_variants_version_check", sql`${table.version} > 0`),
    index("product_variants_product_status_idx").on(
      table.productId,
      table.status,
    ),
    index("product_variants_filter_idx").on(
      table.language,
      table.condition,
      table.priceVnd,
    ),
  ],
);

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const productTags = pgTable(
  "product_tags",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      name: "product_tags_pk",
      columns: [table.productId, table.tagId],
    }),
    index("product_tags_tag_id_idx").on(table.tagId),
  ],
);
