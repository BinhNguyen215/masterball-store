import type { StorefrontImage } from "@/components/storefront/storefront-types";
import { buildPublicMediaUrl } from "@/modules/media";

export type ProductMediaAsset = {
  altText: string;
  mimeType: string;
  objectKey: string;
};

/**
 * Resolves every stored media asset into a gallery image, primary first, which
 * is the order the catalog query already returns (sort order, then id).
 *
 * A missing or unusable `S3_PUBLIC_BASE_URL` yields no gallery at all so the
 * detail page keeps the previous single-image behaviour instead of rendering
 * broken sources. Non-image assets are skipped for the same reason.
 */
export function buildProductImages(
  media: readonly ProductMediaAsset[],
  options: { fallbackAlt: string; publicBaseUrl?: string },
): StorefrontImage[] {
  const publicBaseUrl = options.publicBaseUrl?.trim();
  if (!publicBaseUrl) return [];

  const images: StorefrontImage[] = [];
  for (const asset of media) {
    if (!asset.mimeType.startsWith("image/")) continue;

    let src: string;
    try {
      src = buildPublicMediaUrl(publicBaseUrl, asset.objectKey);
    } catch {
      continue;
    }
    if (images.some((image) => image.src === src)) continue;

    images.push({
      alt: asset.altText.trim() || options.fallbackAlt,
      src,
    });
  }
  return images;
}
