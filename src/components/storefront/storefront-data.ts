import "server-only";

import { cache } from "react";

import { buildProductImages } from "@/components/storefront/product-images";
import { summarizeAvailability } from "@/components/storefront/product-availability";
import type { ProductFilterValues } from "@/components/storefront/product-filter-form";
import { RECENTLY_VIEWED_RAIL_LIMIT } from "@/components/storefront/recently-viewed";
import { readRecentlyViewedSlugs } from "@/components/storefront/recently-viewed-storage";
import { formatVnd } from "@/components/storefront/storefront-formatters";
import { formatCopy, getStorefrontCopy, type StorefrontCopy, type StorefrontLocale } from "@/i18n";
import type {
  ProductDetailViewModel,
  ProductReviewSummaryViewModel,
  ProductViewModel,
  StorefrontImage,
  TournamentDetailViewModel,
  TournamentStatus,
  TournamentViewModel,
} from "@/components/storefront/storefront-types";
import {
  getProductReviewSummary,
  listPublishedProductReviews,
  type ReviewRow,
} from "@/modules/reviews";
import {
  getStorefrontProductBySlug,
  listRelatedStorefrontProducts,
  listStorefrontProducts,
  listStorefrontProductsBySlugs,
  listStorefrontTags,
  type StorefrontProduct,
} from "@/modules/catalog/catalog-queries";
import {
  getPublishedTournamentBySlug,
  listPublishedTournaments,
} from "@/modules/tournaments/tournament-service";

type StorefrontLabels = {
  locale: StorefrontLocale;
  catalog: StorefrontCopy["catalog"];
  product: StorefrontCopy["product"];
  tournaments: StorefrontCopy["tournaments"];
};

function labelsFor(locale: StorefrontLocale): StorefrontLabels {
  const copy = getStorefrontCopy(locale);
  return {
    locale,
    catalog: copy.catalog,
    product: copy.product,
    tournaments: copy.tournaments,
  };
}

function hasStorefrontDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

type CatalogProductItem = StorefrontProduct & { minimumPriceVnd?: number | null };

/** Every resolvable image asset for a product, primary first. */
function productImages(item: CatalogProductItem): StorefrontImage[] {
  return buildProductImages(item.media, {
    fallbackAlt: item.title,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  });
}

function mapProduct(
  item: CatalogProductItem,
  labels: StorefrontLabels,
  images: StorefrontImage[] = productImages(item),
): ProductViewModel | null {
  const firstVariant = item.variants[0];
  const priceVnd = item.minimumPriceVnd ?? firstVariant?.priceVnd;

  if (priceVnd === undefined) {
    return null;
  }

  let image = images[0];
  const localImage = firstVariant?.attributes.localImage;
  if (!image && typeof localImage === "string" && /^\/images\/nshop\/[0-9]+\.webp$/.test(localImage)) {
    image = { alt: item.title, src: localImage };
  }
  if (!image && item.game.slug === "riftbound") {
    image = { alt: item.title, src: `/images/riftbound/${item.slug}.jpg` };
  }
  if (!image) {
    image = { alt: item.title, src: "/images/tcg-hero.webp" };
  }

  return {
    ...summarizeAvailability(item.variants),
    condition: firstVariant?.condition ?? undefined,
    game: item.game.name,
    image,
    language: firstVariant?.language ?? undefined,
    name: item.title,
    priceVnd,
    productType: labels.catalog.productType[item.type] ?? item.type,
    setName: item.set?.name ?? undefined,
    slug: item.slug,
  };
}

function mapProductDetail(
  item: CatalogProductItem,
  labels: StorefrontLabels,
): ProductDetailViewModel | null {
  const images = productImages(item);
  const summary = mapProduct(item, labels, images);

  if (!summary) {
    return null;
  }

  return {
    ...summary,
    description: item.description,
    images,
    sku: item.variants[0]?.sku ?? labels.product.noSku,
    stockLabel:
      summary.availableUnits > 0
        ? formatCopy(labels.product.stockAvailable, {
            count: summary.availableUnits,
          })
        : labels.product.outOfStock,
    variants: item.variants.map((variant) => ({
      available: variant.available > 0,
      id: variant.variantId,
      label:
        [
          variant.language,
          variant.condition,
          variant.edition,
          variant.finish,
        ]
          .filter(Boolean)
          .join(" · ") || variant.sku,
    })),
  };
}

function mapFilters(values: ProductFilterValues) {
  const type = values.type?.toUpperCase();
  const knownType =
    type === "SEALED" || type === "SINGLE" || type === "ACCESSORY"
      ? type
      : undefined;

  const knownSort = [
    "featured",
    "newest",
    "price-asc",
    "price-desc",
    "title-asc",
  ].includes(values.sort === "name-asc" ? "title-asc" : (values.sort ?? ""))
    ? values.sort === "name-asc"
      ? "title-asc"
      : values.sort
    : "featured";

  return {
    availability:
      values.availability === "in-stock" ||
      values.availability === "out-of-stock"
        ? values.availability
        : "all",
    condition: values.condition ? [values.condition] : [],
    game: values.game ? [values.game] : [],
    language: values.language ? [values.language] : [],
    maxPrice: values.maxPrice,
    minPrice: values.minPrice,
    page: values.page,
    q: values.query,
    set: values.set ? [values.set] : [],
    sort: knownSort,
    tag: values.tag ? [values.tag] : [],
    type: knownType ? [knownType] : [],
  };
}

export async function loadStorefrontHome(locale: StorefrontLocale = "vi") {
  const labels = labelsFor(locale);
  if (!hasStorefrontDatabase()) {
    return { configured: false, products: [], tournaments: [] };
  }

  const [catalog, tournaments] = await Promise.all([
    listStorefrontProducts({ pageSize: 4, sort: "featured" }),
    listPublishedTournaments({ limit: 1, timing: "upcoming" }),
  ]);

  return {
    configured: true,
    products: mapCatalogItems(catalog.items, labels),
    tournaments: tournaments.map((tournament) => mapTournament(tournament, labels)),
  };
}

export async function loadStorefrontProductList(
  values: ProductFilterValues,
  locale: StorefrontLocale = "vi",
) {
  const labels = labelsFor(locale);
  if (!hasStorefrontDatabase()) {
    return { configured: false, hasNextPage: false, products: [] };
  }

  const result = await listStorefrontProducts(mapFilters(values));
  return {
    configured: true,
    hasNextPage: result.hasNextPage,
    page: result.page,
    products: mapCatalogItems(result.items, labels),
  };
}

const emptyProductDetail: {
  configured: boolean;
  product: ProductDetailViewModel | null;
  recentlyViewed: ProductViewModel[];
  related: ProductViewModel[];
  reviews: ProductReviewSummaryViewModel;
  shouldRecordView: boolean;
} = {
  configured: true,
  product: null,
  recentlyViewed: [],
  related: [],
  reviews: { averageRating: null, items: [], reviewCount: 0 },
  shouldRecordView: false,
};

/** The storefront list shows at most this many reviews; the total is stated. */
const REVIEW_LIST_LIMIT = 10;

/**
 * Narrows a published review row to the storefront shape. A published row always
 * carries `published_at`, and falling back to `created_at` keeps the date total
 * for a row an operator published without a timestamp.
 */
function mapProductReviews(
  summary: { averageRating: number | null; reviewCount: number },
  published: ReviewRow[],
): ProductReviewSummaryViewModel {
  return {
    averageRating: summary.averageRating,
    reviewCount: summary.reviewCount,
    items: published.slice(0, REVIEW_LIST_LIMIT).map((review) => ({
      authorName: review.authorName,
      body: review.body,
      id: review.id,
      publishedAt: (review.publishedAt ?? review.createdAt).toISOString(),
      rating: review.rating,
    })),
  };
}

function mapCatalogItems(
  items: StorefrontProduct[],
  labels: StorefrontLabels,
): ProductViewModel[] {
  return items.flatMap((item) => {
    const product = mapProduct(item, labels);
    return product ? [product] : [];
  });
}

/**
 * Tag options for the catalog filter: only tags already carried by a published
 * product, so every offered filter can return results.
 */
export const loadStorefrontTags = cache(async () => {
  if (!hasStorefrontDatabase()) return [];
  return listStorefrontTags();
});

export const loadStorefrontProduct = cache(
  async (slug: string, locale: StorefrontLocale = "vi") => {
    const labels = labelsFor(locale);
    if (!hasStorefrontDatabase()) {
      return { ...emptyProductDetail, configured: false };
    }

    const item = await getStorefrontProductBySlug(slug);
    const product = item ? mapProductDetail(item, labels) : null;
    if (!item || !product) {
      return emptyProductDetail;
    }

    const viewedSlugs = await readRecentlyViewedSlugs();
    const [related, recentlyViewed, reviewSummary, reviewPage] = await Promise.all([
      listRelatedStorefrontProducts({
        gameId: item.game.id,
        productId: item.productId,
        setId: item.set?.id ?? null,
      }),
      listStorefrontProductsBySlugs(
        viewedSlugs.filter((viewed) => viewed !== item.slug),
        RECENTLY_VIEWED_RAIL_LIMIT,
      ),
      getProductReviewSummary(item.productId),
      listPublishedProductReviews(item.productId, { limit: REVIEW_LIST_LIMIT }),
    ]);

    return {
      configured: true,
      product,
      recentlyViewed: mapCatalogItems(recentlyViewed, labels),
      related: mapCatalogItems(related, labels),
      reviews: mapProductReviews(reviewSummary, reviewPage.items),
      // A visit that is already at the head of the cookie needs no write.
      shouldRecordView: viewedSlugs[0] !== item.slug,
    };
  },
);

type PublishedTournament = Awaited<
  ReturnType<typeof listPublishedTournaments>
>[number];

function mapTournamentStatus(
  timing: PublishedTournament["timing"],
): TournamentStatus {
  switch (timing) {
    case "CANCELLED":
      return "cancelled";
    case "ENDED":
      return "ended";
    case "IN_PROGRESS":
      return "open";
    case "UPCOMING":
      return "upcoming";
  }
}

function mapTournament(tournament: PublishedTournament, labels: StorefrontLabels): TournamentViewModel {
  return {
    capacityLabel: tournament.capacity
      ? formatCopy(labels.tournaments.capacityLabel, { count: tournament.capacity })
      : undefined,
    feeLabel:
      tournament.feeVnd > 0
        ? formatVnd(tournament.feeVnd, labels.locale)
        : labels.tournaments.freeEntry,
    game: tournament.game.name,
    location: tournament.venueName ?? labels.tournaments.onlineVenue,
    slug: tournament.slug,
    startsAt: tournament.startsAt.toISOString(),
    status: mapTournamentStatus(tournament.timing),
    title: tournament.title,
  };
}

function mapTournamentDetail(
  tournament: PublishedTournament,
  labels: StorefrontLabels,
): TournamentDetailViewModel {
  return {
    ...mapTournament(tournament, labels),
    contactHref: tournament.ctaUrl ?? undefined,
    contactLabel: tournament.ctaUrl ? labels.tournaments.registerCta : undefined,
    endsAt: tournament.endsAt.toISOString(),
    registrationDeadline: tournament.registrationDeadline?.toISOString(),
    summary: tournament.summary,
    rules: tournament.rules
      .split(/\r?\n/)
      .map((rule) => rule.trim())
      .filter(Boolean),
  };
}

export async function loadStorefrontTournaments(
  locale: StorefrontLocale,
  {
    game,
    status,
    limit,
  }: {
    game?: string;
    limit?: number;
    status?: string;
  } = {},
) {
  const labels = labelsFor(locale);
  if (!hasStorefrontDatabase()) {
    return { configured: false, tournaments: [] };
  }

  const timing = status === "ended" ? "past" : status === "all" ? "all" : "upcoming";
  const tournaments = await listPublishedTournaments({ game, limit, timing });
  const mapped = tournaments.map((tournament) => mapTournament(tournament, labels));
  return {
    configured: true,
    tournaments:
      status === "open" || status === "upcoming"
        ? mapped.filter((tournament) => tournament.status === status)
        : mapped,
  };
}

export const loadStorefrontTournament = cache(
  async (slug: string, locale: StorefrontLocale = "vi") => {
  const labels = labelsFor(locale);
  if (!hasStorefrontDatabase()) {
    return { configured: false, tournament: null };
  }

  const tournament = await getPublishedTournamentBySlug(slug);
  return {
    configured: true,
    tournament: tournament ? mapTournamentDetail(tournament, labels) : null,
  };
});
