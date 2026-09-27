export type StorefrontImage = {
  src: string;
  alt: string;
};

export type ProductViewModel = {
  slug: string;
  name: string;
  game: string;
  setName?: string;
  productType: string;
  language?: string;
  condition?: string;
  priceVnd: number;
  image?: StorefrontImage;
  available: boolean;
  /** Sellable units across every active variant (`on_hand - reserved`). */
  availableUnits: number;
  /** True when the product is sellable but nearly gone. */
  lowStock: boolean;
};

export type ProductDetailViewModel = ProductViewModel & {
  sku: string;
  description: string;
  stockLabel: string;
  /** Every stored image asset, primary first; empty when no asset resolves. */
  images: StorefrontImage[];
  variants: Array<{
    id: string;
    label: string;
    available: boolean;
  }>;
};

/** One published review, already narrowed to what the storefront list shows. */
export type ProductReviewViewModel = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  /** ISO instant; the row's `published_at`, never null for a published review. */
  publishedAt: string;
};

/**
 * The moderated rating plus the capped newest-first page the product page shows.
 * `reviewCount` is the moderated total the summary states, so a list capped at
 * `REVIEW_LIST_LIMIT` still tells the shopper how many reviews exist.
 */
export type ProductReviewSummaryViewModel = {
  averageRating: number | null;
  reviewCount: number;
  items: ProductReviewViewModel[];
};

export type CartLineItemViewModel = {
  lineId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  variantLabel: string;
  quantity: number;
  unitPriceVnd: number;
  image?: StorefrontImage;
  warning?: string;
};

export type TournamentStatus = "upcoming" | "open" | "ended" | "cancelled";

export type TournamentViewModel = {
  slug: string;
  title: string;
  game: string;
  startsAt: string;
  location: string;
  status: TournamentStatus;
  feeLabel?: string;
  capacityLabel?: string;
};

export type TournamentDetailViewModel = TournamentViewModel & {
  summary: string;
  endsAt?: string;
  registrationDeadline?: string;
  rules: string[];
  contactLabel?: string;
  contactHref?: string;
};

export type OrderTimelineEntry = {
  id: string;
  dimensionLabel: string;
  statusLabel: string;
  createdAt: string;
};

export type OrderStatusViewModel = {
  reference: string;
  statusLabel: string;
  createdAt: string;
  subtotalVnd: number;
  shippingVnd: number;
  discountVnd: number;
  totalVnd: number;
  paymentMethodLabel: string;
  paymentStatusLabel: string;
  fulfillmentStatusLabel: string;
  trackingNumber: string | null;
  timeline: OrderTimelineEntry[];
  items: Array<{
    lineId: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPriceVnd: number;
    lineTotalVnd: number;
  }>;
};
