# Incident runbook

## First response

1. Record the incident start time, affected environment, request/order/payment references, and current release revision. Never paste secrets, cookies, full addresses, email addresses, or phone numbers into the incident record.
2. Contain the smallest risky surface. For payment or inventory integrity, disable checkout while keeping catalog and admin read access available. For an auth incident, revoke affected sessions and rotate exposed credentials.
3. Preserve logs and provider evidence before changing state. Use request IDs from structured logs and immutable payment/inventory/order histories.
4. Assign one incident owner and one communications owner. Escalate payment disputes to the merchant/provider channel and legal/privacy events to the shop owner.

## Payment integrity

- Treat VNPAY IPN as evidence only after signature, merchant code, amount, transaction reference, and success status validation in `src/modules/payments/`.
- Never use Return URL data or an admin click to mark payment as paid.
- Keep paid-after-release and mismatched transactions in `MANUAL_REVIEW`; prevent fulfillment until provider reconciliation and inventory availability are resolved.
- Run the admin VNPAY reconciliation action to query QueryDr server-to-server. Never use the browser Return URL as payment evidence, and do not cancel a still-pending transaction solely from a non-success QueryDr status; expiry remains the reservation-release authority.
- Replaying an IPN must preserve idempotency. If duplicate handling creates a second side effect, disable checkout and escalate as a data-integrity incident.

## Inventory integrity

- Stop checkout when available stock becomes negative, reservation totals disagree with inventory, or a final-item race produces multiple successes.
- Use inventory service adjustments only; never patch inventory rows directly. Record the physical count, reason, actor, and related order before applying a correction.
- Reconcile `inventory_movements`, active reservations, and orders before reopening checkout.

## Auth, jobs, and content

- For suspected staff compromise, revoke sessions, disable the user, rotate secrets where exposure is plausible, and review audit records.
- For job failures, retain the failed outbox/publication/expiry row, correct the cause, then retry through its idempotent owner. Do not edit delivery state to simulate success.
- Unpublish unsafe tournament content through authorized server actions and preserve the audit record.

## Recovery

Roll back the application artifact when code caused the incident. Do not automatically down-migrate data. If data restoration is required, follow [backup and restore](backup-restore.md), obtain the shop owner's downtime/data-loss approval, and reconcile orders, payments, reservations, inventory, and media references before traffic resumes.
