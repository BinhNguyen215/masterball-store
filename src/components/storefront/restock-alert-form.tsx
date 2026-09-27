"use client";

import { BellRing } from "lucide-react";

import type { StorefrontCopy } from "@/i18n";

type RestockAlertAction = (formData: FormData) => Promise<void>;

type RestockAlertFormProps = {
  /** Server action bound to the product slug; posts `email` and `variantId`. */
  action: RestockAlertAction;
  copy: StorefrontCopy["restock"];
  /** The out-of-stock variant the alert is for; never a free-text field. */
  variantId: string;
};

/**
 * "Tell me when this variant is back" form. It is only mounted for a variant
 * that has no sellable stock, and the variant reaches the server as a hidden
 * field so a client cannot point the alert at a different variant by editing the
 * select it came from.
 */
export function RestockAlertForm({
  action,
  copy,
  variantId,
}: RestockAlertFormProps) {
  return (
    <section aria-labelledby="restock-alert-title" className="restock-alert">
      <div className="restock-alert-heading">
        <BellRing aria-hidden="true" size={20} strokeWidth={1.8} />
        <h2 id="restock-alert-title">{copy.heading}</h2>
      </div>
      <p>{copy.description}</p>
      <form action={action} className="filter-form restock-alert-form">
        <input name="variantId" type="hidden" value={variantId} />
        <div className="field">
          <label className="field-label" htmlFor="restock-alert-email">
            {copy.fieldEmail}
          </label>
          <input
            autoComplete="email"
            id="restock-alert-email"
            inputMode="email"
            name="email"
            required
            type="email"
          />
        </div>
        <button className="button button--primary" type="submit">
          {copy.submit}
        </button>
      </form>
    </section>
  );
}
