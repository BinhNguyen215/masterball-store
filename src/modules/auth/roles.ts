export const ADMIN_ROLES = [
  "OWNER",
  "CATALOG_MANAGER",
  "ORDER_STAFF",
  "EVENT_EDITOR",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const CAPABILITIES = [
  "catalog.read",
  "catalog.write",
  "catalog.publish",
  "catalog.price",
  "inventory.read",
  "inventory.adjust",
  "catalog.import",
  "orders.read",
  "orders.transition",
  "payments.read",
  "payments.reconcile",
  "tournaments.read",
  "tournaments.write",
  "tournaments.publish",
  "settings.read",
  "jobs.run",
  "audit.read",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL_CAPABILITIES = new Set<Capability>(CAPABILITIES);

export const ROLE_CAPABILITIES: Readonly<Record<AdminRole, ReadonlySet<Capability>>> = {
  OWNER: ALL_CAPABILITIES,
  CATALOG_MANAGER: new Set([
    "catalog.read",
    "catalog.write",
    "catalog.publish",
    "catalog.price",
    "inventory.read",
    "inventory.adjust",
    "catalog.import",
    "audit.read",
  ]),
  ORDER_STAFF: new Set([
    "inventory.read",
    "orders.read",
    "orders.transition",
    "payments.read",
    "payments.reconcile",
    "jobs.run",
    "audit.read",
  ]),
  EVENT_EDITOR: new Set([
    "tournaments.read",
    "tournaments.write",
    "tournaments.publish",
    "audit.read",
  ]),
};

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

export function hasCapability(role: AdminRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}
