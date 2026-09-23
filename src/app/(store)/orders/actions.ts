"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRequestIpAddress } from "@/lib/request-ip";
import { consumeOrderLookupAttempt, findOrderIdByContact } from "@/modules/orders";

import { orderLookupSchema } from "./order-commerce";
import { clearOrderAccess, grantOrderAccess } from "./order-cookie";

/**
 * Guest order lookup by the two facts printed on the confirmation email: the
 * order number and the phone number used at checkout. Failures stay generic so
 * the form cannot be used to confirm that an order number exists, and repeated
 * attempts from one client are throttled.
 */
export async function lookupOrder(formData: FormData): Promise<void> {
  const parsed = orderLookupSchema.safeParse({
    orderNumber: formData.get("orderNumber"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) redirect("/orders?error=invalid");
  if (!process.env.DATABASE_URL?.trim()) redirect("/orders?error=unavailable");

  const allowed = await consumeOrderLookupAttempt(
    getRequestIpAddress(await headers()),
  );
  if (!allowed) redirect("/orders?error=throttled");

  const orderId = await findOrderIdByContact(parsed.data);
  if (!orderId) redirect("/orders?error=notfound");

  await grantOrderAccess(orderId);
  redirect("/orders");
}

export async function forgetOrder(): Promise<void> {
  await clearOrderAccess();
  redirect("/orders");
}
