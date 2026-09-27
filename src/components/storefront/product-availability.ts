/** Below or equal to this many sellable units the card warns about low stock. */
export const LOW_STOCK_THRESHOLD = 3;

export type ProductAvailability = {
  available: boolean;
  availableUnits: number;
  lowStock: boolean;
};

/**
 * Summarizes the sellable units the catalog listing query already returned
 * (`on_hand - reserved` per variant), so a card never needs its own round trip.
 */
export function summarizeAvailability(
  variants: readonly { available: number }[],
): ProductAvailability {
  const availableUnits = variants.reduce(
    (total, variant) => total + Math.max(0, variant.available),
    0,
  );

  return {
    available: availableUnits > 0,
    availableUnits,
    lowStock: availableUnits > 0 && availableUnits <= LOW_STOCK_THRESHOLD,
  };
}
