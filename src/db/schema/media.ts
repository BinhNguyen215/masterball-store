import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { productVariants, products } from "./catalog";

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    byteSize: integer("byte_size").notNull(),
    altText: text("alt_text").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("media_assets_object_key_unique").on(table.objectKey),
    check("media_assets_width_check", sql`${table.width} > 0`),
    check("media_assets_height_check", sql`${table.height} > 0`),
    check("media_assets_byte_size_check", sql`${table.byteSize} > 0`),
    check("media_assets_alt_text_check", sql`length(trim(${table.altText})) > 0`),
    check("media_assets_sort_order_check", sql`${table.sortOrder} >= 0`),
    index("media_assets_product_sort_idx").on(
      table.productId,
      table.sortOrder,
    ),
    index("media_assets_variant_id_idx").on(table.variantId),
  ],
);
