export class InventoryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_QUANTITY"
      | "INVENTORY_NOT_FOUND"
      | "INSUFFICIENT_STOCK"
      | "INVALID_ADJUSTMENT",
  ) {
    super(message);
    this.name = "InventoryError";
  }
}
