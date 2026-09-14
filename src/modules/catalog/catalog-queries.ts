import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  ilike,
  inArray,
  max,
  min,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { getDb } from "@/db";
import {
  games,
  inventories,
  mediaAssets,
  productSets,
  productVariants,
  products,
  tags,
} from "@/db/schema";

import {
  parseStorefrontProductQuery,
  type StorefrontProductQuery,
  type StorefrontProductQueryInput,
} from "./catalog-query-dto";

function storefrontConditions(query: StorefrontProductQuery): SQL[] {
  const conditions: SQL[] = [
    eq(products.status, "ACTIVE"),
    eq(productVariants.status, "ACTIVE"),
    eq(games.status, "ACTIVE"),
  ];

  if (query.q) {
    const pattern = `%${query.q}%`;
    conditions.push(
      or(
        ilike(products.title, pattern),
        ilike(products.slug, pattern),
        ilike(productVariants.sku, pattern),
      )!,
    );
  }
  if (query.game.length) conditions.push(inArray(games.slug, query.game));
  if (query.set.length) conditions.push(inArray(productSets.code, query.set));
  if (query.type.length) conditions.push(inArray(products.type, query.type));
  if (query.language.length) {
    conditions.push(inArray(productVariants.language, query.language));
  }
  if (query.condition.length) {
    conditions.push(inArray(productVariants.condition, query.condition));
  }
  if (query.minPrice !== undefined) {
    conditions.push(sql`${productVariants.priceVnd} >= ${query.minPrice}`);
  }
  if (query.maxPrice !== undefined) {
    conditions.push(sql`${productVariants.priceVnd} <= ${query.maxPrice}`);
  }
  if (query.availability === "in-stock") {
    conditions.push(sql`${inventories.onHand} - ${inventories.reserved} > 0`);
  } else if (query.availability === "out-of-stock") {
    conditions.push(sql`${inventories.onHand} - ${inventories.reserved} = 0`);
  }
  return conditions;
}

function storefrontOrder(query: StorefrontProductQuery) {
  const minimumPrice = min(productVariants.priceVnd);
  switch (query.sort) {
    case "newest":
      return [desc(products.publishedAt), desc(products.id)] as const;
    case "price-asc":
      return [asc(minimumPrice), asc(products.id)] as const;
    case "price-desc":
      return [desc(minimumPrice), asc(products.id)] as const;
    case "title-asc":
      return [asc(products.title), asc(products.id)] as const;
    case "featured":
    default:
      return [
        desc(products.featured),
        desc(products.publishedAt),
        desc(products.id),
      ] as const;
  }
}

async function loadStorefrontProducts(productIds: string[]) {
  if (!productIds.length) return [];
  const db = getDb();
  const [variantRows, imageRows] = await Promise.all([
    db
      .select({
        productId: products.id,
        title: products.title,
        slug: products.slug,
        description: products.description,
        type: products.type,
        featured: products.featured,
        seoTitle: products.seoTitle,
        seoDescription: products.seoDescription,
        game: { id: games.id, name: games.name, slug: games.slug },
        set: { id: productSets.id, name: productSets.name, code: productSets.code },
        variantId: productVariants.id,
        sku: productVariants.sku,
        language: productVariants.language,
        condition: productVariants.condition,
        edition: productVariants.edition,
        finish: productVariants.finish,
        attributes: productVariants.attributes,
        priceVnd: productVariants.priceVnd,
        available: sql<number>`${inventories.onHand} - ${inventories.reserved}`,
      })
      .from(products)
      .innerJoin(games, eq(games.id, products.gameId))
      .leftJoin(productSets, eq(productSets.id, products.setId))
      .innerJoin(productVariants, eq(productVariants.productId, products.id))
      .innerJoin(inventories, eq(inventories.variantId, productVariants.id))
      .where(
        and(
          inArray(products.id, productIds),
          eq(products.status, "ACTIVE"),
          eq(productVariants.status, "ACTIVE"),
        ),
      )
      .orderBy(asc(productVariants.priceVnd), asc(productVariants.sku)),
    db
      .select({
        id: mediaAssets.id,
        productId: mediaAssets.productId,
        variantId: mediaAssets.variantId,
        objectKey: mediaAssets.objectKey,
        mimeType: mediaAssets.mimeType,
        width: mediaAssets.width,
        height: mediaAssets.height,
        altText: mediaAssets.altText,
        sortOrder: mediaAssets.sortOrder,
      })
      .from(mediaAssets)
      .where(inArray(mediaAssets.productId, productIds))
      .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id)),
  ]);

  const items = new Map<string, (typeof variantRows)[number] & {
    variants: Array<Omit<(typeof variantRows)[number], "productId" | "title" | "slug" | "description" | "type" | "featured" | "seoTitle" | "seoDescription" | "game" | "set">>;
    media: typeof imageRows;
  }>();

  for (const row of variantRows) {
    let item = items.get(row.productId);
    if (!item) {
      item = { ...row, variants: [], media: [] };
      items.set(row.productId, item);
    }
    item.variants.push({
      variantId: row.variantId,
      sku: row.sku,
      language: row.language,
      condition: row.condition,
      edition: row.edition,
      finish: row.finish,
      attributes: row.attributes,
      priceVnd: row.priceVnd,
      available: row.available,
    });
  }
  for (const image of imageRows) items.get(image.productId)?.media.push(image);
  return productIds.flatMap((id) => {
    const item = items.get(id);
    if (!item) return [];
    return [{
      productId: item.productId,
      title: item.title,
      slug: item.slug,
      description: item.description,
      type: item.type,
      featured: item.featured,
      seoTitle: item.seoTitle,
      seoDescription: item.seoDescription,
      game: item.game,
      set: item.set,
      variants: item.variants,
      media: item.media,
    }];
  });
}

export async function listStorefrontProducts(
  input: StorefrontProductQueryInput = {},
) {
  const query = parseStorefrontProductQuery(input);
  const db = getDb();
  const conditions = storefrontConditions(query);
  const rows = await db
    .select({
      id: products.id,
      minimumPriceVnd: min(productVariants.priceVnd).mapWith(Number),
      maximumPriceVnd: max(productVariants.priceVnd).mapWith(Number),
    })
    .from(products)
    .innerJoin(games, eq(games.id, products.gameId))
    .leftJoin(productSets, eq(productSets.id, products.setId))
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .innerJoin(inventories, eq(inventories.variantId, productVariants.id))
    .where(and(...conditions))
    .groupBy(products.id)
    .orderBy(...storefrontOrder(query))
    .limit(query.pageSize + 1)
    .offset((query.page - 1) * query.pageSize);

  const hasNextPage = rows.length > query.pageSize;
  const pageRows = rows.slice(0, query.pageSize);
  const items = await loadStorefrontProducts(pageRows.map((row) => row.id));
  const prices = new Map(pageRows.map((row) => [row.id, row]));

  return {
    items: items.map((item) => ({ ...item, ...prices.get(item.productId) })),
    page: query.page,
    pageSize: query.pageSize,
    hasNextPage,
  };
}

export async function getStorefrontProductBySlug(slug: string) {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;
  const [row] = await getDb()
    .select({ id: products.id })
    .from(products)
    .innerJoin(games, eq(games.id, products.gameId))
    .where(
      and(
        eq(products.slug, normalizedSlug),
        eq(products.status, "ACTIVE"),
        eq(games.status, "ACTIVE"),
      ),
    )
    .limit(1);
  if (!row) return null;
  return (await loadStorefrontProducts([row.id]))[0] ?? null;
}

export async function listPublishedProductSitemapEntries() {
  return getDb()
    .select({ slug: products.slug, updatedAt: products.updatedAt })
    .from(products)
    .innerJoin(games, eq(games.id, products.gameId))
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.status, "ACTIVE"),
        eq(games.status, "ACTIVE"),
        eq(productVariants.status, "ACTIVE"),
      ),
    )
    .groupBy(products.id)
    .orderBy(asc(products.slug));
}

export async function listAdminCatalogReferences() {
  const db = getDb();
  const [gameRows, setRows, tagRows] = await Promise.all([
    db
      .select({
        id: games.id,
        name: games.name,
        slug: games.slug,
        status: games.status,
      })
      .from(games)
      .orderBy(asc(games.name), asc(games.id)),
    db
      .select({
        id: productSets.id,
        name: productSets.name,
        code: productSets.code,
        status: productSets.status,
        gameName: games.name,
      })
      .from(productSets)
      .innerJoin(games, eq(games.id, productSets.gameId))
      .orderBy(asc(games.name), asc(productSets.name), asc(productSets.id)),
    db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(tags)
      .orderBy(asc(tags.name), asc(tags.id)),
  ]);

  return { games: gameRows, sets: setRows, tags: tagRows };
}

export async function listAdminProducts(input: {
  limit?: number;
  offset?: number;
  q?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
} = {}) {
  const limit = Math.max(1, Math.min(200, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const conditions: SQL[] = [];
  if (input.q?.trim()) {
    const pattern = `%${input.q.trim()}%`;
    conditions.push(or(
      ilike(products.title, pattern),
      ilike(products.slug, pattern),
      ilike(productVariants.sku, pattern),
    )!);
  }
  if (input.status) conditions.push(eq(products.status, input.status));
  const where = conditions.length ? and(...conditions) : undefined;
  const db = getDb();
  const [items, [totalRow]] = await Promise.all([
    db
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      type: products.type,
      status: products.status,
      version: products.version,
      gameName: games.name,
      setName: productSets.name,
      variants: sql<string>`coalesce(string_agg(${productVariants.sku} || ' (' || ${productVariants.id}::text || ')', ', ' order by ${productVariants.sku}), '')`,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(games, eq(games.id, products.gameId))
    .leftJoin(productSets, eq(productSets.id, products.setId))
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(where)
    .groupBy(products.id, games.name, productSets.name)
    .orderBy(desc(products.updatedAt), desc(products.id))
    .limit(limit)
    .offset(offset),
    db
      .select({ count: countDistinct(products.id) })
      .from(products)
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .where(where),
  ]);
  return { items, total: Number(totalRow?.count ?? 0) };
}
