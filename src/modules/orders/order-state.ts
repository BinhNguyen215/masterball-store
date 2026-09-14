export const orderTransitions = {
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["CANCELLED", "COMPLETED"],
  CANCELLED: [],
  COMPLETED: [],
} as const;

export const fulfillmentTransitions = {
  UNFULFILLED: ["PROCESSING"],
  PROCESSING: ["SHIPPED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: ["RETURNED"],
  RETURNED: [],
} as const;

export const paymentTransitions = {
  UNPAID: ["PENDING", "PAID", "FAILED"],
  PENDING: ["PAID", "FAILED", "MANUAL_REVIEW"],
  PAID: ["PARTIALLY_REFUNDED", "REFUNDED", "MANUAL_REVIEW"],
  FAILED: ["PENDING", "MANUAL_REVIEW"],
  PARTIALLY_REFUNDED: ["REFUNDED", "MANUAL_REVIEW"],
  REFUNDED: [],
  MANUAL_REVIEW: ["PAID", "REFUNDED", "FAILED"],
} as const;

type TransitionMap = Record<string, readonly string[]>;

export function canTransition(
  transitions: TransitionMap,
  from: string,
  to: string,
): boolean {
  return from === to || (transitions[from]?.includes(to) ?? false);
}
