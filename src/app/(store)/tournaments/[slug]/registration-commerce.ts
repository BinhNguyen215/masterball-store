import type { StorefrontCopy } from "@/i18n";

type RegistrationsCopy = StorefrontCopy["registrations"];

/** Slugs are the only public identifier the form is allowed to post back. */
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The registration form posts its slug so a failed submission can return to the
 * event it came from; anything that is not a public slug is refused instead of
 * being concatenated into a redirect target.
 */
export function readRegistrationSlug(formData: FormData): string | null {
  const value = formData.get("slug");
  if (typeof value !== "string") return null;
  const slug = value.trim();
  if (slug.length === 0 || slug.length > 180 || !slugPattern.test(slug)) return null;
  return slug;
}

/**
 * Turns the query string the server action redirects with into the one notice
 * the panel shows. Unknown values fall back to the generic service error so a
 * hand-edited URL never renders an empty notice.
 */
export function getRegistrationMessage(
  query: { error?: string | string[]; registration?: string | string[] },
  copy: RegistrationsCopy,
): { kind: "error" | "success"; text: string } | undefined {
  const errors: Record<string, string> = {
    invalid: copy.errors.invalid,
    throttled: copy.errors.throttled,
    unavailable: copy.errors.unavailable,
    service: copy.errors.service,
  };

  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  if (error) return { kind: "error", text: errors[error] ?? copy.errors.service };

  const registration = Array.isArray(query.registration)
    ? query.registration[0]
    : query.registration;
  if (registration === "registered") return { kind: "success", text: copy.registeredNotice };
  if (registration === "waitlisted") return { kind: "success", text: copy.waitlistedNotice };
  if (registration === "existing") return { kind: "success", text: copy.existingNotice };
  return undefined;
}
