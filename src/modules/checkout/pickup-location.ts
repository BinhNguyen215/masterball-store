/**
 * The counter customers collect an order from. Read from the deployment
 * environment through the same keys the storefront contact block uses
 * (`src/components/storefront/store-contact.tsx`), so the address a shopper
 * sees at checkout is the address published in the footer.
 *
 * Returns null when the deployment has no address configured: pickup is then
 * hidden everywhere rather than promised against a guess.
 */
export type PickupLocation = {
  address: string;
  storeName: string | null;
};

export function readPickupLocation(
  environment: Record<string, string | undefined> = process.env,
): PickupLocation | null {
  const address = environment.STORE_CONTACT_ADDRESS?.trim();
  if (!address) return null;
  return {
    address,
    storeName: environment.STORE_CONTACT_LEGAL_NAME?.trim() || null,
  };
}
