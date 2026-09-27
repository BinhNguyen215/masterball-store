import { AlertTriangle, BadgeCheck } from "lucide-react";

import { formatVietnamDateTime } from "@/components/storefront/storefront-formatters";
import type { ProductReviewSummaryViewModel } from "@/components/storefront/storefront-types";
import { formatCopy, type StorefrontCopy, type StorefrontLocale } from "@/i18n";

type SubmitReviewAction = (formData: FormData) => Promise<void>;

type ProductReviewsProps = {
  /** Server action bound to the product slug; absent without a database. */
  action?: SubmitReviewAction;
  copy: StorefrontCopy["reviews"];
  locale: StorefrontLocale;
  message?: { kind: "error" | "success"; text: string };
  reviews: ProductReviewSummaryViewModel;
};

/** Filled and hollow stars, hidden from assistive tech: the value is announced as n/5. */
function RatingStars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-hidden="true" className="review-stars">
      {`${"★".repeat(filled)}${"☆".repeat(5 - filled)}`}
    </span>
  );
}

/**
 * The moderated review surface: the rating summary, the newest page of published
 * reviews and the purchase-verified submission form. Every review is backed by an
 * order, so the verified marker is shown on all of them rather than per row.
 */
export function ProductReviews({
  action,
  copy,
  locale,
  message,
  reviews,
}: ProductReviewsProps) {
  const hasReviews = reviews.reviewCount > 0 && reviews.averageRating !== null;

  return (
    <section aria-labelledby="product-reviews-title" className="product-reviews">
      <div className="section-heading">
        <h2 id="product-reviews-title">{copy.heading}</h2>
      </div>

      {hasReviews ? (
        <p aria-label={copy.summaryAria} className="review-summary">
          <span className="review-summary-average">
            <RatingStars rating={reviews.averageRating ?? 0} />
            <strong>{(reviews.averageRating ?? 0).toFixed(1)}</strong>
            <span className="sr-only">{copy.averageLabel}</span>
          </span>
          <span className="review-summary-count">
            {formatCopy(copy.countLabel, { count: reviews.reviewCount })}
          </span>
        </p>
      ) : (
        <p className="review-empty">{copy.empty}</p>
      )}

      {reviews.items.length > 0 ? (
        <ul className="review-list">
          {reviews.items.map((review) => (
            <li className="review-item" key={review.id}>
              <div className="review-item-head">
                <span className="review-author">{review.authorName}</span>
                <span className="review-meta">
                  <span className="review-rating">
                    <RatingStars rating={review.rating} />
                    <span className="review-rating-value">{review.rating}/5</span>
                  </span>
                  <time dateTime={review.publishedAt}>
                    {formatVietnamDateTime(review.publishedAt, locale)}
                  </time>
                  <span className="review-verified">
                    <BadgeCheck aria-hidden="true" size={16} strokeWidth={1.8} />
                    {copy.verified}
                  </span>
                </span>
              </div>
              <p className="review-body">{review.body}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {action ? (
        <div className="review-form-panel">
          <h3>{copy.formTitle}</h3>
          <p className="review-form-description">{copy.formDescription}</p>
          {message ? (
            <div
              className="notice"
              role={message.kind === "error" ? "alert" : "status"}
            >
              {message.kind === "error" ? (
                <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
              ) : (
                <BadgeCheck aria-hidden="true" size={20} strokeWidth={1.8} />
              )}
              <p>{message.text}</p>
            </div>
          ) : null}
          <form action={action} className="filter-form review-form">
            <div className="field">
              <label className="field-label" htmlFor="review-author-name">
                {copy.formName}
              </label>
              <input
                autoComplete="name"
                id="review-author-name"
                maxLength={120}
                minLength={2}
                name="authorName"
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="review-order-number">
                {copy.formOrderNumber}
              </label>
              <input
                id="review-order-number"
                maxLength={40}
                name="orderNumber"
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="review-phone">
                {copy.formPhone}
              </label>
              <input
                autoComplete="tel"
                id="review-phone"
                inputMode="tel"
                maxLength={40}
                name="phone"
                required
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="review-rating">
                {copy.formRating}
              </label>
              <select defaultValue="5" id="review-rating" name="rating" required>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {`${value}/5`}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="review-body">
                {copy.formBody}
              </label>
              <textarea
                id="review-body"
                maxLength={2000}
                minLength={10}
                name="body"
                required
                rows={5}
              />
              <p className="field-help">{copy.formBodyHint}</p>
            </div>
            <button className="button button--primary" type="submit">
              {copy.formSubmit}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
