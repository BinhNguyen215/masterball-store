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
};

export type ProductDetailViewModel = ProductViewModel & {
  sku: string;
  description: string;
  stockLabel: string;
  variants: Array<{
    id: string;
    label: string;
    available: boolean;
  }>;
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

export type OrderStatusViewModel = {
  reference: string;
  statusLabel: string;
  createdAt: string;
  subtotalVnd: number;
  shippingVnd: number;
  totalVnd: number;
  paymentMethodLabel: string;
  paymentStatusLabel: string;
  fulfillmentStatusLabel: string;
  items: Array<{
    lineId: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPriceVnd: number;
    lineTotalVnd: number;
  }>;
};
