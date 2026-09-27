"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import type { StorefrontImage } from "@/components/storefront/storefront-types";
import { formatCopy } from "@/i18n/storefront";

export type ProductGalleryLabels = {
  /** Accessible name of the thumbnail group. */
  label: string;
  /** Accessible name of one thumbnail; receives `{index}`. */
  thumbnail: string;
};

type ProductGalleryProps = {
  /** Fallback used when the product has no resolvable media asset. */
  fallback?: StorefrontImage;
  images: StorefrontImage[];
  labels: ProductGalleryLabels;
};

/**
 * Primary image plus thumbnails. Selection lives on the client so a thumbnail is
 * a real button: it is tabbable, announces the pressed state, and the arrow keys
 * move between thumbnails without leaving the gallery.
 */
export function ProductGallery({ fallback, images, labels }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const resolved = images.length > 0 ? images : fallback ? [fallback] : [];
  const active = resolved[Math.min(activeIndex, resolved.length - 1)];

  if (!active) {
    return (
      <div className="product-gallery">
        <span aria-hidden="true" className="capture-mark hero-capture" />
      </div>
    );
  }

  const select = (index: number, focus: boolean) => {
    const next = (index + resolved.length) % resolved.length;
    setActiveIndex(next);
    if (focus) thumbnailRefs.current[next]?.focus();
  };

  return (
    <div className="product-gallery-frame">
      <div className="product-gallery">
        <Image
          alt={active.alt}
          fill
          priority
          sizes="(max-width: 1023px) 100vw, 58vw"
          src={active.src}
        />
      </div>
      {resolved.length > 1 ? (
        <ul aria-label={labels.label} className="product-gallery-thumbs">
          {resolved.map((image, index) => (
            <li key={image.src}>
              <button
                aria-label={formatCopy(labels.thumbnail, { index: index + 1 })}
                aria-pressed={index === activeIndex}
                className="product-gallery-thumb"
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    event.preventDefault();
                    select(index + 1, true);
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    event.preventDefault();
                    select(index - 1, true);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    select(0, true);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    select(resolved.length - 1, true);
                  }
                }}
                ref={(element) => {
                  thumbnailRefs.current[index] = element;
                }}
                type="button"
              >
                <Image alt="" height={96} src={image.src} width={96} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
