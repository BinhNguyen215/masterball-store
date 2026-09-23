import type { StorefrontCopy } from "@/i18n";

type StoreContactDetails = {
  address?: string;
  email?: string;
  legalName?: string;
  phone?: string;
  taxId?: string;
};

/**
 * Store identity published to customers. Values come from the deployment
 * environment so nothing is invented in code; the block renders only when at
 * least one detail is configured.
 */
export function readStoreContactDetails(
  environment: Record<string, string | undefined> = process.env,
): StoreContactDetails {
  const value = (name: string) => environment[name]?.trim() || undefined;
  return {
    address: value("STORE_CONTACT_ADDRESS"),
    email: value("STORE_CONTACT_EMAIL"),
    legalName: value("STORE_CONTACT_LEGAL_NAME"),
    phone: value("STORE_CONTACT_PHONE"),
    taxId: value("STORE_CONTACT_TAX_ID"),
  };
}

export function StoreContact({ copy }: { copy: StorefrontCopy["chrome"] }) {
  const details = readStoreContactDetails();
  const hasDetails = Object.values(details).some(Boolean);
  if (!hasDetails) return null;

  return (
    <div className="footer-contact">
      <h2>{copy.footer.contactHeading}</h2>
      <ul>
        {details.legalName ? <li>{details.legalName}</li> : null}
        {details.address ? <li>{details.address}</li> : null}
        {details.phone ? (
          <li>
            <a href={`tel:${details.phone.replace(/\s+/g, "")}`}>{details.phone}</a>
          </li>
        ) : null}
        {details.email ? <li><a href={`mailto:${details.email}`}>{details.email}</a></li> : null}
        {details.taxId ? <li>{copy.footer.taxIdLabel}: {details.taxId}</li> : null}
      </ul>
    </div>
  );
}
