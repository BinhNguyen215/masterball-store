"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getRequestIpAddress } from "@/lib/request-ip";
import { consumeGuestRateLimit } from "@/modules/orders";
import { RegistrationError, registerForTournament } from "@/modules/tournaments";

import { readRegistrationSlug } from "./registration-commerce";

/** Every refusal a guest may see, keyed by the error the service raised. */
const ERROR_QUERY: Record<RegistrationError["code"], string> = {
  NOT_FOUND: "unavailable",
  CLOSED: "unavailable",
  INVALID: "invalid",
  DUPLICATE: "existing",
};

/**
 * Holds a seat from the public event page. The action always redirects back to
 * the event so the result is a normal page render, and nothing but the public
 * slug and the guest's own details ever leave the form.
 */
export async function submitTournamentRegistration(formData: FormData): Promise<void> {
  const slug = readRegistrationSlug(formData);
  if (!slug) redirect("/tournaments?error=invalid");
  const base = `/tournaments/${slug}`;

  // The throttle reads the shared rate-limit table, so the database has to be
  // configured before anything else touches it.
  if (!process.env.DATABASE_URL?.trim()) redirect(`${base}?error=unavailable`);

  const allowed = await consumeGuestRateLimit({
    clientKey: getRequestIpAddress(await headers()),
    scope: "tournament-registration",
  });
  if (!allowed) redirect(`${base}?error=throttled`);

  let destination: string;
  try {
    const result = await registerForTournament({
      slug,
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      note: String(formData.get("note") ?? ""),
    });
    destination = result.alreadyRegistered
      ? `${base}?registration=existing`
      : `${base}?registration=${result.status === "WAITLISTED" ? "waitlisted" : "registered"}`;
  } catch (error) {
    const code = error instanceof RegistrationError ? ERROR_QUERY[error.code] : "service";
    destination = `${base}?error=${code}`;
  }

  revalidatePath(base);
  redirect(destination);
}
