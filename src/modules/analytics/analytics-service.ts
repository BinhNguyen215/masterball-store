import { and, asc, count, desc, eq, gte, lt, ne, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import {
  emailOutbox,
  inventories,
  orderItems,
  orders,
  payments,
  productReviews,
  productVariants,
  products,
  tournamentRegistrations,
} from "@/db/schema";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rolling window for the revenue section, mirrored for the comparison window. */
export const REVENUE_WINDOW_DAYS = 30;
const SALES_WINDOW_DAYS = 90;
export const STALE_COD_DAYS = 7;

/** Every list is capped; the dashboards show a head line, never the full table. */
export const ATTENTION_LIMIT = 10;
const LOW_STOCK_LIMIT = 10;
const TOP_PRODUCT_LIMIT = 5;
/** Bounds the status group-bys: both enums have fewer members than this. */
const STATUS_GROUP_LIMIT = 8;
/** A variant with no configured reorder point is still "low" at 3 units or less. */
const LOW_STOCK_FALLBACK_THRESHOLD = 3;

/**
 * Postgres returns `bigint`/`numeric` aggregates as strings; the dashboard only
 * ever shows counts and VND totals that fit comfortably in a JS number.
 */
function toFiniteNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export type RevenueDirection = "up" | "down" | "flat";

export type RevenueTrend = {
  deltaVnd: number;
  /** `null` when the previous window collected nothing, so no ratio exists. */
  deltaPercent: number | null;
  direction: RevenueDirection;
};

/**
 * Direction of the revenue move between two windows. Kept pure so the
 * divide-by-zero and flat cases are covered without a database.
 */
export function computeRevenueTrend(
  currentVnd: number,
  previousVnd: number,
): RevenueTrend {
  const deltaVnd = currentVnd - previousVnd;
  return {
    deltaVnd,
    deltaPercent: previousVnd > 0 ? (deltaVnd / previousVnd) * 100 : null,
    direction: deltaVnd > 0 ? "up" : deltaVnd < 0 ? "down" : "flat",
  };
}

export type RevenueSummary = {
  windowDays: number;
  collectedVnd: number;
  previousCollectedVnd: number;
  paidOrders: number;
  trend: RevenueTrend;
};

export type StatusCount = { status: string; total: number };

export type AttentionOrder = {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  totalVnd: number;
  createdAt: Date;
  reservationExpiresAt: Date | null;
};

export type AttentionBucket = {
  /** Total matching rows, not just the ones returned in `items`. */
  total: number;
  items: AttentionOrder[];
};

export type AttentionQueues = {
  expiredReservations: AttentionBucket;
  manualReview: AttentionBucket;
  staleCod: AttentionBucket;
};

export type TopProduct = {
  title: string;
  unitsSold: number;
  revenueVnd: number;
};

export type LowStockItem = {
  variantId: string;
  sku: string;
  productTitle: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
};

export type EmailQueueStatus = {
  status: string;
  total: number;
  oldestPendingAt: Date | null;
};

export type OperationsQueue = {
  emailByStatus: EmailQueueStatus[];
  oldestPendingEmailAt: Date | null;
  pendingTournamentRegistrations: number;
  pendingProductReviews: number;
};

export type AnalyticsOverview = {
  generatedAt: Date;
  revenue: RevenueSummary;
  orderStatus: StatusCount[];
  paymentStatus: StatusCount[];
  attention: AttentionQueues;
  topProducts: TopProduct[];
  lowStock: LowStockItem[];
  operations: OperationsQueue;
};

type AttentionRow = AttentionOrder & { total: unknown };

function toBucket(rows: AttentionRow[]): AttentionBucket {
  return {
    total: rows.length > 0 ? toFiniteNumber(rows[0].total) : 0,
    items: rows.map((row) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      orderStatus: row.orderStatus,
      paymentStatus: row.paymentStatus,
      totalVnd: row.totalVnd,
      createdAt: row.createdAt,
      reservationExpiresAt: row.reservationExpiresAt,
    })),
  };
}

/**
 * Read-only operations snapshot. Every figure comes from one bounded aggregate
 * or one capped list query; the sections are independent, so they run as a
 * single parallel fan-out instead of a sequence of round-trips.
 */
export async function getAnalyticsOverview(now: Date = new Date()): Promise<AnalyticsOverview> {
  const db = getDb();

  const windowStart = new Date(now.getTime() - REVENUE_WINDOW_DAYS * DAY_MS);
  const previousWindowStart = new Date(
    now.getTime() - 2 * REVENUE_WINDOW_DAYS * DAY_MS,
  );
  const salesWindowStart = new Date(now.getTime() - SALES_WINDOW_DAYS * DAY_MS);
  const staleCodCutoff = new Date(now.getTime() - STALE_COD_DAYS * DAY_MS);

  // `payments.created_at` is the column the `payments(created_at, id)` index
  // covers, so a single range scan serves both windows via FILTER aggregates.
  const revenueQuery = db
    .select({
      collectedVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.createdAt} >= ${windowStart}), 0)`,
      previousCollectedVnd: sql<number>`coalesce(sum(${payments.amountVnd}) filter (where ${payments.createdAt} < ${windowStart}), 0)`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.status, "PAID"),
        gte(payments.createdAt, previousWindowStart),
      ),
    )
    .limit(1);

  // Uses orders(payment_status, created_at).
  const paidOrdersQuery = db
    .select({ total: count() })
    .from(orders)
    .where(
      and(eq(orders.paymentStatus, "PAID"), gte(orders.createdAt, windowStart)),
    )
    .limit(1);

  // Both group-bys are index-only scans over (status, created_at) and are
  // capped at the enum arity, so no unbounded aggregation reaches the driver.
  const orderStatusQuery = db
    .select({ status: orders.orderStatus, total: count() })
    .from(orders)
    .groupBy(orders.orderStatus)
    .orderBy(desc(count()))
    .limit(STATUS_GROUP_LIMIT);

  const paymentStatusQuery = db
    .select({ status: orders.paymentStatus, total: count() })
    .from(orders)
    .groupBy(orders.paymentStatus)
    .orderBy(desc(count()))
    .limit(STATUS_GROUP_LIMIT);

  const availableExpr = sql<number>`(${inventories.onHand} - ${inventories.reserved})`;

  const attentionQuery = (where: SQL | undefined, order: SQL) =>
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        orderStatus: orders.orderStatus,
        paymentStatus: orders.paymentStatus,
        totalVnd: orders.totalVnd,
        createdAt: orders.createdAt,
        reservationExpiresAt: orders.reservationExpiresAt,
        // Counted by the window function so the list and its total arrive in a
        // single bounded query instead of a second COUNT over the same rows.
        total: sql<number>`count(*) over ()`,
      })
      .from(orders)
      .where(where)
      .orderBy(order)
      .limit(ATTENTION_LIMIT);

  const expiredReservationsQuery = attentionQuery(
    and(
      eq(orders.orderStatus, "PENDING_PAYMENT"),
      lt(orders.reservationExpiresAt, now),
    ),
    asc(orders.reservationExpiresAt),
  );

  // Uses orders(payment_status, created_at).
  const manualReviewQuery = attentionQuery(
    eq(orders.paymentStatus, "MANUAL_REVIEW"),
    asc(orders.createdAt),
  );

  const staleCodQuery = attentionQuery(
    and(
      eq(orders.paymentMethod, "COD"),
      eq(orders.paymentStatus, "UNPAID"),
      // A cancelled order will never be collected, so it is not actionable.
      ne(orders.orderStatus, "CANCELLED"),
      lt(orders.createdAt, staleCodCutoff),
    ),
    asc(orders.createdAt),
  );

  const unitsSoldExpr = sql<number>`sum(${orderItems.quantity})`;
  const productRevenueExpr = sql<number>`sum(${orderItems.lineTotalVnd})`;

  // Windowed on the order's own created_at (indexed) rather than the line's, so
  // the join drives from a bounded range of orders.
  const topProductsQuery = db
    .select({
      title: orderItems.productTitle,
      unitsSold: unitsSoldExpr,
      revenueVnd: productRevenueExpr,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        ne(orders.orderStatus, "CANCELLED"),
        gte(orders.createdAt, salesWindowStart),
      ),
    )
    .groupBy(orderItems.productTitle)
    .orderBy(desc(unitsSoldExpr), desc(productRevenueExpr))
    .limit(TOP_PRODUCT_LIMIT);

  const lowStockQuery = db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      productTitle: products.title,
      onHand: inventories.onHand,
      reserved: inventories.reserved,
      reorderPoint: inventories.reorderPoint,
      available: availableExpr,
    })
    .from(inventories)
    .innerJoin(productVariants, eq(productVariants.id, inventories.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      sql`${availableExpr} <= case when ${inventories.reorderPoint} = 0 then ${LOW_STOCK_FALLBACK_THRESHOLD} else ${inventories.reorderPoint} end`,
    )
    .orderBy(asc(availableExpr), asc(inventories.updatedAt), asc(productVariants.sku))
    .limit(LOW_STOCK_LIMIT);

  // One grouped pass over email_outbox(status, next_attempt_at) yields both the
  // per-status counts and the oldest scheduled attempt for the pending group.
  const emailStatusQuery = db
    .select({
      status: emailOutbox.status,
      total: count(),
      oldestPendingAt: sql<Date | null>`min(${emailOutbox.nextAttemptAt})`,
    })
    .from(emailOutbox)
    .groupBy(emailOutbox.status)
    .limit(STATUS_GROUP_LIMIT);

  const pendingRegistrationsQuery = db
    .select({ total: count() })
    .from(tournamentRegistrations)
    .where(eq(tournamentRegistrations.status, "REGISTERED"))
    .limit(1);

  // Uses product_reviews(status, created_at).
  const pendingReviewsQuery = db
    .select({ total: count() })
    .from(productReviews)
    .where(eq(productReviews.status, "PENDING"))
    .limit(1);

  const [
    [revenueRow],
    [paidOrderRow],
    orderStatusRows,
    paymentStatusRows,
    expiredReservationRows,
    manualReviewRows,
    staleCodRows,
    topProductRows,
    lowStockRows,
    emailStatusRows,
    [pendingRegistrationRow],
    [pendingReviewRow],
  ] = await Promise.all([
    revenueQuery,
    paidOrdersQuery,
    orderStatusQuery,
    paymentStatusQuery,
    expiredReservationsQuery,
    manualReviewQuery,
    staleCodQuery,
    topProductsQuery,
    lowStockQuery,
    emailStatusQuery,
    pendingRegistrationsQuery,
    pendingReviewsQuery,
  ]);

  const collectedVnd = toFiniteNumber(revenueRow?.collectedVnd);
  const previousCollectedVnd = toFiniteNumber(revenueRow?.previousCollectedVnd);

  const emailByStatus: EmailQueueStatus[] = emailStatusRows.map((row) => ({
    status: row.status,
    total: toFiniteNumber(row.total),
    oldestPendingAt: row.oldestPendingAt ?? null,
  }));

  return {
    generatedAt: now,
    revenue: {
      windowDays: REVENUE_WINDOW_DAYS,
      collectedVnd,
      previousCollectedVnd,
      paidOrders: toFiniteNumber(paidOrderRow?.total),
      trend: computeRevenueTrend(collectedVnd, previousCollectedVnd),
    },
    orderStatus: orderStatusRows.map((row) => ({
      status: row.status,
      total: toFiniteNumber(row.total),
    })),
    paymentStatus: paymentStatusRows.map((row) => ({
      status: row.status,
      total: toFiniteNumber(row.total),
    })),
    attention: {
      expiredReservations: toBucket(expiredReservationRows as AttentionRow[]),
      manualReview: toBucket(manualReviewRows as AttentionRow[]),
      staleCod: toBucket(staleCodRows as AttentionRow[]),
    },
    topProducts: topProductRows.map((row) => ({
      title: row.title,
      unitsSold: toFiniteNumber(row.unitsSold),
      revenueVnd: toFiniteNumber(row.revenueVnd),
    })),
    lowStock: lowStockRows.map((row) => ({
      variantId: row.variantId,
      sku: row.sku,
      productTitle: row.productTitle,
      onHand: row.onHand,
      reserved: row.reserved,
      reorderPoint: row.reorderPoint,
      available: toFiniteNumber(row.available),
    })),
    operations: {
      emailByStatus,
      oldestPendingEmailAt:
        emailByStatus.find((row) => row.status === "PENDING")?.oldestPendingAt ??
        null,
      pendingTournamentRegistrations: toFiniteNumber(pendingRegistrationRow?.total),
      pendingProductReviews: toFiniteNumber(pendingReviewRow?.total),
    },
  };
}
