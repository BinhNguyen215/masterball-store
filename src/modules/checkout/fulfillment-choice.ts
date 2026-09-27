/**
 * Store pickup is a delivery choice, not a column on `orders`. The domain
 * records it in the two fields checkout already owns, so no migration is
 * needed and the choice stays readable from SQL or the admin console:
 *
 * - `orders.shipping_vnd` is always 0 for a pickup order (the shopping rule in
 *   `shipping-fee.ts` owns that number).
 * - `orders.customer_note` starts with `PICKUP_NOTE_TAG`, followed by the
 *   customer's own note when they wrote one.
 *
 * Pure and dependency-free: the checkout client, the checkout service, and the
 * order pages all read the same tag.
 */
export const PICKUP_NOTE_TAG = "[PICKUP]";

export type FulfillmentChoice = "DELIVERY" | "PICKUP";

export const FULFILLMENT_CHOICES = ["DELIVERY", "PICKUP"] as const;

export function isFulfillmentChoice(value: unknown): value is FulfillmentChoice {
  return value === "DELIVERY" || value === "PICKUP";
}

/**
 * The exact text persisted in `orders.customer_note`. Delivery notes are stored
 * verbatim; a pickup note is tagged so the choice survives without a column.
 */
export function encodeOrderNote(
  choice: FulfillmentChoice,
  note?: string | null,
): string | null {
  const trimmed = note?.trim() ?? "";
  if (choice === "DELIVERY") return trimmed || null;
  return trimmed ? `${PICKUP_NOTE_TAG} ${trimmed}` : PICKUP_NOTE_TAG;
}

/**
 * Reads the choice back out of the persisted note. The tag is authoritative:
 * `shipping_vnd` alone cannot distinguish pickup from a free-shipping delivery.
 */
export function readFulfillmentChoice(input: {
  customerNote?: string | null;
}): FulfillmentChoice {
  return input.customerNote?.trimStart().startsWith(PICKUP_NOTE_TAG)
    ? "PICKUP"
    : "DELIVERY";
}
