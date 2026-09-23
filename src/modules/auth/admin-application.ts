import "server-only";

import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import { getEmailEnvironment } from "@/config/environment";
import { listAuditLogs } from "@/modules/audit";
import {
  createGame,
  createProduct,
  createProductSet,
  createProductVariant,
  createTag,
  importProductsCsv,
  listAdminCatalogReferences,
  listAdminProducts,
  replaceProductTags,
  setGameStatus,
  setProductSetStatus,
  setProductStatus,
  updateProduct,
  updateProductVariant,
} from "@/modules/catalog";
import { processEmailOutbox } from "@/modules/email";
import { adjustInventory, listAdminInventory } from "@/modules/inventory";
import { expirePendingOrders, listAdminOrders, transitionOrder } from "@/modules/orders";
import {
  inspectVnpayReturn,
  listAdminPayments,
  processVnpayIpn,
  reconcilePaymentByQuery,
} from "@/modules/payments";
import { createTournament, listAdminTournaments, publishScheduledTournaments, transitionTournament, updateTournament } from "@/modules/tournaments";

export type AdminResource =
  | "products"
  | "catalog-references"
  | "inventory"
  | "orders"
  | "payments"
  | "tournaments"
  | "audit";

export type AdminRow = {
  id: string;
  cells: Record<string, string | number | null>;
};

export type AdminList = {
  columns: { key: string; label: string }[];
  items: AdminRow[];
  total: number;
};

export class IntegrationUnavailableError extends Error {
  constructor(readonly integration: string) {
    super(`The ${integration} domain integration is unavailable.`);
    this.name = "IntegrationUnavailableError";
  }
}

type CatalogImportResult = Awaited<ReturnType<typeof importProductsCsv>>;

export const SCHEDULED_JOBS = ["release-expired", "publish-scheduled", "process-email-outbox"] as const;

export type ScheduledJobName = (typeof SCHEDULED_JOBS)[number];

export const scheduledJobSchema = z.enum(SCHEDULED_JOBS);

export type ScheduledJobResult = {
  job: ScheduledJobName;
  summary: string;
};

function summarizeJobResult(name: ScheduledJobName, value: unknown): string {
  if (Array.isArray(value)) return `${value.length} bản ghi đã xử lý`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const parts = Object.entries(record)
      .filter(([, entry]) => typeof entry === "number")
      .map(([key, entry]) => `${key}: ${entry}`);
    if (parts.length) return parts.join(", ");
  }
  return "Đã chạy xong";
}

export type AdminApplication = {
  list(resource: AdminResource, query: URLSearchParams): Promise<AdminList>;
  createProduct(input: Record<string, unknown>, actorId: string): Promise<void>;
  updateProduct(input: Record<string, unknown>, actorId: string): Promise<void>;
  createProductVariant(input: Record<string, unknown>, actorId: string): Promise<void>;
  updateProductVariant(input: Record<string, unknown>, actorId: string): Promise<void>;
  setProductStatus(input: Record<string, unknown>, actorId: string): Promise<void>;
  createGame(input: Record<string, unknown>, actorId: string): Promise<void>;
  setGameStatus(input: Record<string, unknown>, actorId: string): Promise<void>;
  createProductSet(input: Record<string, unknown>, actorId: string): Promise<void>;
  setProductSetStatus(input: Record<string, unknown>, actorId: string): Promise<void>;
  createTag(input: Record<string, unknown>, actorId: string): Promise<void>;
  replaceProductTags(input: Record<string, unknown>, actorId: string): Promise<void>;
  adjustInventory(input: Record<string, unknown>, actorId: string): Promise<void>;
  transitionOrder(input: Record<string, unknown>, actorId: string): Promise<void>;
  reconcilePayment(input: Record<string, unknown>, actorId: string, ipAddress: string): Promise<void>;
  createTournament(input: Record<string, unknown>, actorId: string): Promise<void>;
  updateTournament(input: Record<string, unknown>, actorId: string): Promise<void>;
  setTournamentStatus(input: Record<string, unknown>, actorId: string): Promise<void>;
  importProductsCsv(input: { csv: string; dryRun: boolean; actorId: string }): Promise<CatalogImportResult>;
  publishScheduled(now: Date): Promise<unknown>;
  releaseExpired(now: Date): Promise<unknown>;
  processEmailOutbox(now: Date): Promise<unknown>;
  runScheduledJob(name: ScheduledJobName, now: Date): Promise<ScheduledJobResult>;
  processVnpayIpn(query: URLSearchParams): Promise<{ rspCode: string; message: string }>;
  inspectVnpayReturn(query: URLSearchParams): Promise<{ valid: boolean; status: string }>;
};

function unavailable(name: string): never {
  throw new IntegrationUnavailableError(name);
}

function text(value: unknown): string {
  if (value instanceof Date) return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }).format(value);
  return value === null || value === undefined ? "—" : String(value);
}

function vnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
}

const AUDIT_VALUE_LIMIT = 48;
const AUDIT_CHANGE_LIMIT = 4;
const AUDIT_NOISE_KEYS: Record<string, true> = {
  id: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
  version: true,
};

function auditValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "string") return value.length > AUDIT_VALUE_LIMIT ? `${value.slice(0, AUDIT_VALUE_LIMIT)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const serialized = JSON.stringify(value) ?? "—";
    return serialized.length > AUDIT_VALUE_LIMIT ? `${serialized.slice(0, AUDIT_VALUE_LIMIT)}…` : serialized;
  } catch {
    return "—";
  }
}

function auditEntries(record: Record<string, unknown>): string[] {
  return Object.keys(record)
    .filter((key) => AUDIT_NOISE_KEYS[key] !== true)
    .sort()
    .slice(0, AUDIT_CHANGE_LIMIT)
    .map((key) => `${key}: ${auditValue(record[key])}`);
}

/**
 * Compact before → after summary for the audit table. Raw payloads are large
 * (whole row snapshots) and may hold customer data, so only changed keys are
 * shown and each value is truncated.
 */
function summarizeAuditChanges(before: unknown, after: unknown): string {
  const beforeRecord = before && typeof before === "object" ? (before as Record<string, unknown>) : null;
  const afterRecord = after && typeof after === "object" ? (after as Record<string, unknown>) : null;

  if (beforeRecord && !afterRecord) return `đã xóa · ${auditEntries(beforeRecord).join("; ") || "—"}`;
  if (!beforeRecord && afterRecord) return `đã tạo · ${auditEntries(afterRecord).join("; ") || "—"}`;
  if (!beforeRecord || !afterRecord) return "—";

  const keys = [...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])].sort();
  const changes: string[] = [];
  for (const key of keys) {
    if (JSON.stringify(beforeRecord[key]) === JSON.stringify(afterRecord[key])) continue;
    changes.push(`${key}: ${auditValue(beforeRecord[key])} → ${auditValue(afterRecord[key])}`);
    if (changes.length === AUDIT_CHANGE_LIMIT) break;
  }
  return changes.length ? changes.join("; ") : "—";
}

function pageOptions(query: URLSearchParams) {
  const page = Math.max(1, Math.min(10_000, Number(query.get("page") ?? 1) || 1));
  const pageSize = 50;
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    page,
    pageSize,
    q: query.get("q")?.trim() || undefined,
    status: query.get("status")?.trim() || undefined,
  };
}

function filterRows<T extends Record<string, unknown>>(
  rows: T[],
  query: URLSearchParams,
  statusKeys: (keyof T)[],
): T[] {
  const needle = query.get("q")?.trim().toLocaleLowerCase("vi") ?? "";
  const status = query.get("status")?.trim() ?? "";
  return rows.filter((row) => {
    const matchesText = !needle || Object.values(row).some((value) => text(value).toLocaleLowerCase("vi").includes(needle));
    const matchesStatus = !status || statusKeys.some((key) => text(row[key]) === status);
    return matchesText && matchesStatus;
  });
}

function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  return rows.slice((page - 1) * pageSize, page * pageSize);
}

async function listResource(resource: AdminResource, query: URLSearchParams): Promise<AdminList> {
  const options = pageOptions(query);
  if (resource === "catalog-references") {
    const references = await listAdminCatalogReferences();
    const rows = [
      ...references.games.map((row) => ({
        id: row.id,
        kind: "Game",
        name: `${row.name} (${row.slug})`,
        parent: "—",
        status: row.status,
      })),
      ...references.sets.map((row) => ({
        id: row.id,
        kind: "Set",
        name: `${row.name} (${row.code})`,
        parent: row.gameName,
        status: row.status,
      })),
      ...references.tags.map((row) => ({
        id: row.id,
        kind: "Tag",
        name: `${row.name} (${row.slug})`,
        parent: "—",
        status: "ACTIVE",
      })),
    ];
    const filtered = filterRows(rows, query, ["status"]);
    return {
      columns: [{ key: "id", label: "Mã nội bộ" }, { key: "kind", label: "Loại" }, { key: "name", label: "Tên / mã" }, { key: "parent", label: "Thuộc game" }, { key: "status", label: "Trạng thái" }],
      items: paginate(filtered, options.page, options.pageSize).map((row) => ({ id: `${row.kind}:${row.id}`, cells: row })),
      total: filtered.length,
    };
  }
  if (resource === "products") {
    const status = options.status && ["DRAFT", "ACTIVE", "ARCHIVED"].includes(options.status)
      ? options.status as "DRAFT" | "ACTIVE" | "ARCHIVED"
      : undefined;
    const result = await listAdminProducts({ ...options, status });
    const rows = result.items;
    return {
      columns: [{ key: "id", label: "Mã sản phẩm" }, { key: "title", label: "Sản phẩm" }, { key: "variants", label: "SKU (mã biến thể)" }, { key: "game", label: "Game" }, { key: "type", label: "Loại" }, { key: "status", label: "Trạng thái" }, { key: "version", label: "Phiên bản" }, { key: "updatedAt", label: "Cập nhật" }],
      items: rows.map((row) => ({ id: row.id, cells: { id: row.id, title: row.title, variants: row.variants, game: row.gameName, type: row.type, status: row.status, version: row.version, updatedAt: text(row.updatedAt) } })),
      total: result.total,
    };
  }
  if (resource === "inventory") {
    const status = options.status && ["LOW", "OUT", "AVAILABLE"].includes(options.status)
      ? options.status as "LOW" | "OUT" | "AVAILABLE"
      : undefined;
    const result = await listAdminInventory({ ...options, status });
    return {
      columns: [{ key: "id", label: "Mã biến thể" }, { key: "sku", label: "SKU" }, { key: "product", label: "Sản phẩm" }, { key: "onHand", label: "On hand" }, { key: "reserved", label: "Reserved" }, { key: "available", label: "Available" }, { key: "reorderPoint", label: "Ngưỡng cảnh báo" }, { key: "version", label: "Phiên bản" }],
      items: result.items.map((row) => ({ id: row.variantId, cells: { id: row.variantId, sku: row.sku, product: row.productTitle, onHand: row.onHand, reserved: row.reserved, available: row.available, reorderPoint: row.reorderPoint, version: row.version } })),
      total: result.total,
    };
  }
  if (resource === "orders") {
    const result = await listAdminOrders(options);
    return {
      columns: [{ key: "id", label: "Mã nội bộ" }, { key: "number", label: "Đơn" }, { key: "order", label: "Trạng thái đơn" }, { key: "payment", label: "Thanh toán" }, { key: "fulfillment", label: "Giao hàng" }, { key: "total", label: "Tổng" }, { key: "version", label: "Phiên bản" }, { key: "createdAt", label: "Tạo lúc" }],
      items: result.items.map((row) => ({ id: row.id, cells: { id: row.id, number: row.orderNumber, order: row.orderStatus, payment: row.paymentStatus, fulfillment: row.fulfillmentStatus, total: vnd(row.totalVnd), version: row.version, createdAt: text(row.createdAt) } })),
      total: result.total,
    };
  }
  if (resource === "payments") {
    const result = await listAdminPayments(options);
    return {
      columns: [{ key: "id", label: "Mã thanh toán" }, { key: "order", label: "Đơn" }, { key: "provider", label: "Kênh" }, { key: "reference", label: "Mã tham chiếu" }, { key: "status", label: "Trạng thái" }, { key: "amount", label: "Số tiền" }, { key: "updatedAt", label: "Cập nhật" }],
      items: result.items.map((row) => ({ id: row.id, cells: { id: row.id, order: row.orderNumber, provider: row.provider, reference: row.providerReference, status: row.status, amount: vnd(row.amountVnd), updatedAt: text(row.updatedAt) } })),
      total: result.total,
    };
  }
  if (resource === "tournaments") {
    const result = await listAdminTournaments(options);
    const rows = result.items.map((row) => ({ ...row.tournament, gameName: row.gameName }));
    return {
      columns: [{ key: "id", label: "Mã giải" }, { key: "title", label: "Giải đấu" }, { key: "game", label: "Game" }, { key: "status", label: "Xuất bản" }, { key: "timing", label: "Thời gian" }, { key: "version", label: "Phiên bản" }],
      items: rows.map((row) => ({ id: row.id, cells: { id: row.id, title: row.title, game: row.gameName, status: row.cancelled ? "CANCELLED" : row.publicationStatus, timing: `${text(row.startsAt)} – ${text(row.endsAt)}`, version: row.version } })),
      total: result.total,
    };
  }
  if (resource === "audit") {
    const result = await listAuditLogs({
      subjectType: options.status,
      q: options.q,
      limit: options.limit,
      offset: options.offset,
    });
    return {
      columns: [{ key: "createdAt", label: "Thời gian" }, { key: "actor", label: "Actor" }, { key: "action", label: "Hành động" }, { key: "subject", label: "Đối tượng" }, { key: "changes", label: "Thay đổi" }, { key: "request", label: "Request ID" }],
      items: result.items.map((row) => ({ id: row.id, cells: { createdAt: text(row.createdAt), actor: row.actorId ? text(row.actorId) : "Hệ thống", action: row.action, subject: `${row.subjectType}:${row.subjectId}`, changes: summarizeAuditChanges(row.before, row.after), request: row.requestId } })),
      total: result.total,
    };
  }
  return unavailable(`${resource} listing`);
}

const orderCreatedPayloadSchema = z.object({
  orderNumber: z.string().min(1).max(80),
  totalVnd: z.number().int().nonnegative().optional(),
  amountVnd: z.number().int().nonnegative().optional(),
  orderUrl: z.url().max(500).optional(),
}).refine((value) => value.totalVnd !== undefined || value.amountVnd !== undefined);

async function sendTransactionalEmail(message: { recipient: string; template: string; payload: Record<string, unknown> }) {
  if (message.template !== "order-created" && message.template !== "payment-paid") {
    throw new Error("Unsupported transactional email template.");
  }
  const payload = orderCreatedPayloadSchema.parse(message.payload);
  const amountVnd = payload.totalVnd ?? payload.amountVnd!;
  const orderUrlLine = payload.orderUrl
    ? `\n\nTheo dõi trạng thái đơn: ${payload.orderUrl}`
    : "";
  const environment = getEmailEnvironment();
  const transport = nodemailer.createTransport({
    host: environment.SMTP_HOST,
    port: environment.SMTP_PORT,
    secure: environment.SMTP_PORT === 465,
    auth: { user: environment.SMTP_USER, pass: environment.SMTP_PASSWORD },
  });
  await transport.sendMail({
    from: environment.EMAIL_FROM,
    to: message.recipient,
    subject: message.template === "payment-paid"
      ? `MasterBall Store – Đã xác nhận thanh toán ${payload.orderNumber}`
      : `MasterBall Store – Đơn hàng ${payload.orderNumber}`,
    text: message.template === "payment-paid"
      ? `Thanh toán cho đơn ${payload.orderNumber}, số tiền ${vnd(amountVnd)}, đã được xác nhận qua kênh bảo mật.${orderUrlLine}`
      : `Chúng tôi đã nhận đơn hàng ${payload.orderNumber}, tổng giá trị ${vnd(amountVnd)}. Vui lòng giữ mã đơn để theo dõi trạng thái.${orderUrlLine}`,
  });
}

// This typed boundary is replaced with direct domain-service calls as each
// concurrently owned module lands. It intentionally fails closed and never
// reports a mutation as successful without a domain implementation.
export const adminApplication: AdminApplication = {
  list: listResource,
  createProduct: async (input, actorId) => {
    await createProduct({ ...input, actorId, status: "DRAFT" });
  },
  updateProduct: async (input, actorId) => {
    await updateProduct({
      id: input.productId,
      expectedVersion: input.version,
      actorId,
      changes: {
        title: input.title,
        slug: input.slug,
        gameId: input.gameId,
        setId: input.setId,
        type: input.type,
        description: input.description,
        featured: input.featured,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
      },
    });
  },
  createProductVariant: async (input, actorId) => {
    await createProductVariant({
      ...input,
      actorId,
      status: "DRAFT",
      condition: input.condition || null,
      edition: input.edition || null,
      finish: input.finish || null,
      weightGram: input.weightGram ?? 0,
    });
  },
  updateProductVariant: async (input, actorId) => {
    await updateProductVariant({
      id: input.variantId,
      expectedVersion: input.version,
      actorId,
      changes: {
        sku: input.sku,
        status: input.status,
        language: input.language,
        condition: input.condition || null,
        edition: input.edition || null,
        finish: input.finish || null,
        priceVnd: input.priceVnd,
        weightGram: input.weightGram,
      },
    });
  },
  setProductStatus: async (input, actorId) => {
    await setProductStatus({ id: input.productId, expectedVersion: input.version, status: input.status, actorId });
  },
  createGame: async (input, actorId) => {
    await createGame({ name: input.name, slug: input.slug, actorId, status: "DRAFT" });
  },
  setGameStatus: async (input, actorId) => {
    await setGameStatus({ id: input.gameId, status: input.status, actorId });
  },
  createProductSet: async (input, actorId) => {
    await createProductSet({
      gameId: input.gameId,
      name: input.name,
      code: input.code,
      releaseDate: input.releaseDate,
      actorId,
      status: "DRAFT",
    });
  },
  setProductSetStatus: async (input, actorId) => {
    await setProductSetStatus({ id: input.setId, status: input.status, actorId });
  },
  createTag: async (input, actorId) => {
    await createTag({ name: input.name, slug: input.slug, actorId });
  },
  replaceProductTags: async (input, actorId) => {
    await replaceProductTags({ productId: input.productId, tagIds: input.tagIds, actorId });
  },
  adjustInventory: async (input, actorId) => {
    await adjustInventory({
      variantId: String(input.variantId),
      onHandDelta: Number(input.delta),
      referenceType: "ADMIN_ADJUSTMENT",
      referenceId: randomUUID(),
      actorId,
      note: String(input.reason),
      reorderPoint:
        input.reorderPoint === undefined || input.reorderPoint === null
          ? undefined
          : Number(input.reorderPoint),
    });
  },
  transitionOrder: async (input, actorId) => {
    const targetStatus = String(input.targetStatus);
    await transitionOrder({
      orderId: String(input.orderId),
      dimension: ["PROCESSING", "SHIPPED", "DELIVERED"].includes(targetStatus) ? "FULFILLMENT" : "ORDER",
      toStatus: targetStatus,
      actorId,
      reason: input.note ? String(input.note) : null,
      internalNote: input.note ? String(input.note) : null,
      trackingNumber: input.trackingCode ? String(input.trackingCode) : null,
      expectedVersion: Number(input.version),
    });
  },
  reconcilePayment: async (input, actorId, ipAddress) => {
    await reconcilePaymentByQuery({
      paymentId: String(input.paymentId),
      actorId,
      ipAddress,
    });
  },
  createTournament: async (input, actorId) => {
    await createTournament({
      ...input,
      actorId,
      venueName: input.venueName,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      registrationDeadline: input.registrationDeadline || null,
    });
  },
  updateTournament: async (input, actorId) => {
    await updateTournament({
      id: input.tournamentId,
      expectedVersion: input.version,
      actorId,
      changes: {
        title: input.title,
        summary: input.summary,
        venueName: input.venueName || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        registrationDeadline: input.registrationDeadline ?? null,
        ctaUrl: input.ctaUrl ?? null,
        capacity: input.capacity ?? null,
        feeVnd: input.feeVnd ?? 0,
        contact: input.contact ?? null,
        rules: input.rules,
      },
    });
  },
  setTournamentStatus: async (input, actorId) => {
    const status = String(input.status);
    await transitionTournament({
      id: input.tournamentId,
      expectedVersion: input.version,
      actorId,
      toStatus: status === "CANCELLED" ? undefined : status,
      scheduledPublishAt: status === "SCHEDULED" ? input.publishAt : null,
      cancelled: status === "CANCELLED" ? true : undefined,
    });
  },
  importProductsCsv: async (input) => importProductsCsv(input),
  publishScheduled: async (now) => publishScheduledTournaments({ now }),
  releaseExpired: async (now) => expirePendingOrders({ now }),
  processEmailOutbox: async (now) => processEmailOutbox(sendTransactionalEmail, { now }),
  runScheduledJob: async (name, now) => {
    const ran = await {
      "process-email-outbox": () => processEmailOutbox(sendTransactionalEmail, { now }),
      "publish-scheduled": () => publishScheduledTournaments({ now }),
      "release-expired": () => expirePendingOrders({ now }),
    }[name]();
    return { job: name, summary: summarizeJobResult(name, ran) };
  },
  processVnpayIpn: async (query) => {
    const result = await processVnpayIpn(Object.fromEntries(query.entries()));
    return { rspCode: result.RspCode, message: result.Message };
  },
  inspectVnpayReturn: async (query) => {
    const result = inspectVnpayReturn(Object.fromEntries(query.entries()));
    return { valid: result.verified, status: result.successful ? "SUCCESS" : "FAILED" };
  },
};
