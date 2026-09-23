import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_COLLECTION =
  "https://www.nshop.com.vn/collections/the-bai-pokemon-tcg-ocg-chinh-hang/products.json";
const OUTPUT_PATH = resolve("data/nshop-pokemon.json");
const PAGE_LIMIT = 250;
const MAX_PAGES = 1_000;
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_DELAY_MS = 250;

const PRODUCT_TYPE_MAP: Record<string, "SEALED" | "SINGLE" | "ACCESSORY"> = {
  "PKM Collection": "SEALED",
  "PKM Pack": "SEALED",
  "PKM Elite": "SEALED",
  "PKM Deck": "SEALED",
  "PKM TIN": "SEALED",
};

type SourceImage = { src?: unknown; alt?: unknown };
type SourceVariant = {
  id?: unknown;
  price?: unknown;
  available?: unknown;
  title?: unknown;
  sku?: unknown;
};
type SourceProduct = {
  id?: unknown;
  handle?: unknown;
  title?: unknown;
  body_html?: unknown;
  product_type?: unknown;
  tags?: unknown;
  images?: unknown;
};

type Snapshot = {
  sourceUrl: string;
  fetchedAt: string;
  products: Array<{
    sourceId: string;
    sourceUrl: string;
    slug: string;
    title: string;
    description: string;
    productType: "SEALED" | "SINGLE" | "ACCESSORY";
    language: string;
    images: Array<{ url: string; alt: string }>;
    variants: Array<{
      sourceId: string;
      sourceSku: string;
      title: string;
      priceVnd: number;
      available: boolean;
    }>;
  }>;
};

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid ${label}.`);
  return value.trim();
}

function sourceId(value: unknown, label: string): string {
  if (!(typeof value === "number" && Number.isSafeInteger(value) && value > 0) &&
      !(typeof value === "string" && /^[1-9]\d*$/.test(value))) {
    throw new Error(`Invalid ${label}: expected a positive numeric ID.`);
  }
  return String(value);
}

function plainText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function inferLanguage(tags: string, title: string): string {
  const text = `${tags} ${title}`.toLowerCase();
  if (/\b(english|eng|tiếng anh|tieng anh)\b/.test(text)) return "en";
  if (/\b(japanese|japan|jp|tiếng nhật|tieng nhat)\b/.test(text)) return "ja";
  if (/\b(vietnamese|vietnam|việt|viet)\b/.test(text)) return "vi";
  return "other";
}

function inferProductType(value: unknown): "SEALED" | "SINGLE" | "ACCESSORY" {
  const sourceType = requiredString(value, "product_type");
  const mapped = PRODUCT_TYPE_MAP[sourceType];
  if (mapped) return mapped;
  const normalized = sourceType.toLowerCase();
  if (/accessor|sleeve|album|binder|holder/.test(normalized)) return "ACCESSORY";
  if (/single|card|individual/.test(normalized)) return "SINGLE";
  throw new Error(`Unmapped nShop product_type ${JSON.stringify(sourceType)}; refusing to guess.`);
}

async function fetchPage(page: number): Promise<SourceProduct[]> {
  const url = `${SOURCE_COLLECTION}?limit=${PAGE_LIMIT}&page=${page}`;
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const response = await fetch(url, { headers: { accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`nShop page ${page} returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { products?: unknown }).products)) {
    throw new Error(`nShop page ${page} did not contain a products array.`);
  }
  return (payload as { products: SourceProduct[] }).products;
}

function mapProduct(source: SourceProduct): Snapshot["products"][number] {
  const id = sourceId(source.id, "product ID");
  const slug = requiredString(source.handle, `slug for product ${id}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid slug ${JSON.stringify(slug)}.`);
  const title = requiredString(source.title, `title for product ${id}`);
  const sourceUrl = `https://www.nshop.com.vn/products/${encodeURIComponent(slug)}`;
  const rawDescription = typeof source.body_html === "string" ? plainText(source.body_html) : "";
  // The source URL is recorded on the product record and in variant attributes;
  // it must not leak into customer-facing copy.
  const description = rawDescription || "No description provided by nShop.";
  const imagesRaw = Array.isArray(source.images) ? source.images : [];
  const images = imagesRaw.map((image, index) => {
    if (!image || typeof image !== "object") throw new Error(`Invalid image ${index + 1} for product ${id}.`);
    const item = image as SourceImage;
    const rawUrl = requiredString(item.src, `image URL for product ${id}`);
    const url = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
    if (!/^https?:\/\//.test(url)) throw new Error(`Invalid image URL for product ${id}.`);
    return { url, alt: typeof item.alt === "string" && item.alt.trim() ? item.alt.trim() : title };
  });
  const variantsRaw = Array.isArray((source as { variants?: unknown }).variants)
    ? ((source as { variants: SourceVariant[] }).variants)
    : [];
  if (!variantsRaw.length) throw new Error(`Product ${id} has no variants.`);
  const variantIds = new Set<string>();
  const variants = variantsRaw.map((variant, index) => {
    const variantId = sourceId(variant.id, `variant ID for product ${id}`);
    if (variantIds.has(variantId)) throw new Error(`Duplicate variant ID ${variantId}.`);
    variantIds.add(variantId);
    const price = typeof variant.price === "number" ? variant.price : Number(variant.price);
    if (!Number.isSafeInteger(price) || price < 0 || price > 1_000_000_000_000) {
      throw new Error(`Invalid VND price for product ${id}, variant ${index + 1}.`);
    }
    return {
      sourceId: variantId,
      sourceSku: `NSHOP-${variantId}`,
      title: requiredString(variant.title, `variant title for product ${id}`),
      priceVnd: price,
      available: variant.available === true,
    };
  });
  return {
    sourceId: id,
    sourceUrl,
    slug,
    title,
    description,
    productType: inferProductType(source.product_type),
    language: inferLanguage(typeof source.tags === "string" ? source.tags : "", title),
    images,
    variants,
  };
}

async function main() {
  const products: SourceProduct[] = [];
  const seenProductIds = new Set<string>();
  const pageEvidence: Array<{ page: number; count: number; firstId?: string; lastId?: string }> = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageProducts = await fetchPage(page);
    const ids = pageProducts.map((product) => sourceId(product.id, `product ID on page ${page}`));
    pageEvidence.push({ page, count: ids.length, firstId: ids[0], lastId: ids.at(-1) });
    if (pageProducts.length === 0) break;
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index || seenProductIds.has(id));
    if (duplicates.length) throw new Error(`Repeated product IDs detected on page ${page}: ${duplicates.join(", ")}.`);
    ids.forEach((id) => seenProductIds.add(id));
    products.push(...pageProducts);
    if (page < MAX_PAGES) await new Promise((resolveDelay) => setTimeout(resolveDelay, PAGE_DELAY_MS));
    if (page === MAX_PAGES) throw new Error(`Reached page safety limit (${MAX_PAGES}) before an empty page.`);
  }
  if (!pageEvidence.at(-1) || pageEvidence.at(-1)?.count !== 0) throw new Error("Paging did not terminate with an empty page.");
  const mapped = products.map(mapProduct);
  const snapshot: Snapshot = {
    sourceUrl: SOURCE_COLLECTION,
    fetchedAt: new Date().toISOString(),
    products: mapped,
  };
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const tempPath = `${OUTPUT_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(tempPath, OUTPUT_PATH);
  const typeCounts = Object.fromEntries(Object.entries(mapped.reduce<Record<string, number>>((counts, product) => {
    counts[product.productType] = (counts[product.productType] ?? 0) + 1;
    return counts;
  }, {})));
  const languageUnknown = mapped.filter((product) => product.language === "other").length;
  console.log(JSON.stringify({ pages: pageEvidence, products: mapped.length, variants: mapped.reduce((n, p) => n + p.variants.length, 0), typeMappings: PRODUCT_TYPE_MAP, typeCounts, languageUnknown }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "nShop catalog fetch failed.");
  process.exitCode = 1;
});
