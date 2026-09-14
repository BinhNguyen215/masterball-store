import "server-only";

import { cache } from "react";

import type { ProductFilterValues } from "@/components/storefront/product-filter-form";
import type {
  ProductDetailViewModel,
  ProductViewModel,
  TournamentDetailViewModel,
  TournamentStatus,
  TournamentViewModel,
} from "@/components/storefront/storefront-types";
import {
  getStorefrontProductBySlug,
  listStorefrontProducts,
} from "@/modules/catalog/catalog-queries";
import { buildPublicMediaUrl } from "@/modules/media";
import {
  getPublishedTournamentBySlug,
  listPublishedTournaments,
} from "@/modules/tournaments/tournament-service";

const productTypeLabels: Record<string, string> = {
  ACCESSORY: "Phụ kiện",
  SEALED: "Sản phẩm sealed",
  SINGLE: "Thẻ lẻ",
};

function hasStorefrontDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

type CatalogItem = Awaited<
  ReturnType<typeof listStorefrontProducts>
>["items"][number];

function mapProduct(item: CatalogItem): ProductViewModel | null {
  const firstVariant = item.variants[0];
  const priceVnd = item.minimumPriceVnd ?? firstVariant?.priceVnd;

  if (priceVnd === undefined) {
    return null;
  }

  const primaryMedia = item.media[0];
  let image: ProductViewModel["image"];
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (primaryMedia && publicBaseUrl) {
    try {
      image = {
        alt: primaryMedia.altText,
        src: buildPublicMediaUrl(publicBaseUrl, primaryMedia.objectKey),
      };
    } catch {
      image = undefined;
    }
  }

  return {
    available: item.variants.some((variant) => variant.available > 0),
    condition: firstVariant?.condition ?? undefined,
    game: item.game.name,
    image,
    language: firstVariant?.language ?? undefined,
    name: item.title,
    priceVnd,
    productType: productTypeLabels[item.type] ?? item.type,
    setName: item.set?.name ?? undefined,
    slug: item.slug,
  };
}

function mapProductDetail(item: CatalogItem): ProductDetailViewModel | null {
  const summary = mapProduct(item);

  if (!summary) {
    return null;
  }

  const availableUnits = item.variants.reduce(
    (total, variant) => total + Math.max(0, variant.available),
    0,
  );

  return {
    ...summary,
    description: item.description,
    sku: item.variants[0]?.sku ?? "Chưa có SKU",
    stockLabel:
      availableUnits > 0 ? `Còn ${availableUnits} sản phẩm` : "Tạm hết hàng",
    variants: item.variants.map((variant) => ({
      available: variant.available > 0,
      id: variant.variantId,
      label: [
        variant.language,
        variant.condition,
        variant.edition,
        variant.finish,
      ]
        .filter(Boolean)
        .join(" · "),
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
    type: knownType ? [knownType] : [],
  };
}

export async function loadStorefrontHome() {
  if (!hasStorefrontDatabase()) {
    return { configured: false, products: [], tournaments: [] };
  }

  const [catalog, tournaments] = await Promise.all([
    listStorefrontProducts({ pageSize: 4, sort: "featured" }),
    listPublishedTournaments({ limit: 1, timing: "upcoming" }),
  ]);

  return {
    configured: true,
    products: catalog.items.flatMap((item) => {
      const product = mapProduct(item);
      return product ? [product] : [];
    }),
    tournaments: tournaments.map(mapTournament),
  };
}

export async function loadStorefrontProductList(values: ProductFilterValues) {
  if (!hasStorefrontDatabase()) {
    return { configured: false, hasNextPage: false, products: [] };
  }

  const result = await listStorefrontProducts(mapFilters(values));
  return {
    configured: true,
    hasNextPage: result.hasNextPage,
    page: result.page,
    products: result.items.flatMap((item) => {
      const product = mapProduct(item);
      return product ? [product] : [];
    }),
  };
}

export const loadStorefrontProduct = cache(async (slug: string) => {
  if (!hasStorefrontDatabase()) {
    return { configured: false, product: null };
  }

  const product = await getStorefrontProductBySlug(slug);
  return {
    configured: true,
    product: product ? mapProductDetail(product) : null,
  };
});

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

function mapTournament(tournament: PublishedTournament): TournamentViewModel {
  return {
    capacityLabel: tournament.capacity
      ? `${tournament.capacity} người chơi`
      : undefined,
    feeLabel:
      tournament.feeVnd > 0
        ? new Intl.NumberFormat("vi-VN", {
            currency: "VND",
            maximumFractionDigits: 0,
            style: "currency",
          }).format(tournament.feeVnd)
        : "Miễn phí",
    game: tournament.game.name,
    location: tournament.venueName ?? "Thi đấu trực tuyến",
    slug: tournament.slug,
    startsAt: tournament.startsAt.toISOString(),
    status: mapTournamentStatus(tournament.timing),
    title: tournament.title,
  };
}

function mapTournamentDetail(
  tournament: PublishedTournament,
): TournamentDetailViewModel {
  return {
    ...mapTournament(tournament),
    contactHref: tournament.ctaUrl ?? undefined,
    contactLabel: tournament.ctaUrl ? "Xem hướng dẫn tham gia" : undefined,
    endsAt: tournament.endsAt.toISOString(),
    registrationDeadline: tournament.registrationDeadline?.toISOString(),
    summary: tournament.summary,
    rules: tournament.rules
      .split(/\r?\n/)
      .map((rule) => rule.trim())
      .filter(Boolean),
  };
}

export async function loadStorefrontTournaments({
  game,
  status,
  limit,
}: {
  game?: string;
  limit?: number;
  status?: string;
} = {}) {
  if (!hasStorefrontDatabase()) {
    return { configured: false, tournaments: [] };
  }

  const timing = status === "ended" ? "past" : status === "all" ? "all" : "upcoming";
  const tournaments = await listPublishedTournaments({ game, limit, timing });
  const mapped = tournaments.map(mapTournament);
  return {
    configured: true,
    tournaments:
      status === "open" || status === "upcoming"
        ? mapped.filter((tournament) => tournament.status === status)
        : mapped,
  };
}

export const loadStorefrontTournament = cache(async (slug: string) => {
  if (!hasStorefrontDatabase()) {
    return { configured: false, tournament: null };
  }

  const tournament = await getPublishedTournamentBySlug(slug);
  return {
    configured: true,
    tournament: tournament ? mapTournamentDetail(tournament) : null,
  };
});
