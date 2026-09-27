/**
 * A Google Maps search link for a free-text address. Uses the documented Maps
 * URL API, which needs no key and opens the address in the customer's own app
 * or browser tab.
 */
export function buildGoogleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
