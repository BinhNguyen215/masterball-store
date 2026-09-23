import { AlertTriangle, Search } from "lucide-react";

import { ButtonLink } from "@/components/storefront/button-link";
import type { StorefrontCopy } from "@/i18n";

type OrderLookupAction = (formData: FormData) => Promise<void>;

type OrderLookupFormProps = {
  copy: StorefrontCopy;
  enabled: boolean;
  lookupAction?: OrderLookupAction;
  message?: { kind: "error"; text: string };
  orderNumber?: string;
};

export function OrderLookupForm({
  copy,
  enabled,
  lookupAction,
  message,
  orderNumber,
}: OrderLookupFormProps) {
  const orders = copy.orders;

  return (
    <div className="checkout-layout">
      <section aria-labelledby="order-lookup-title" className="checkout-panel">
        <h2 id="order-lookup-title">{orders.lookupFormTitle}</h2>
        {message ? (
          <div className="notice" role={message.kind === "error" ? "alert" : "status"}>
            <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
            <p>{message.text}</p>
          </div>
        ) : null}
        <form action={lookupAction} className="checkout-form">
          <div className="field">
            <label className="field-label" htmlFor="lookup-order-number">
              {orders.orderNumber}
            </label>
            <input
              autoComplete="off"
              defaultValue={orderNumber}
              disabled={!enabled}
              id="lookup-order-number"
              maxLength={23}
              name="orderNumber"
              pattern="MB-[0-9A-Fa-f]{20}"
              placeholder={orders.orderNumberPlaceholder}
              required
              spellCheck={false}
              type="text"
            />
            <p className="field-help">{orders.orderNumberHelp}</p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="lookup-phone">
              {orders.phone}
            </label>
            <input
              autoComplete="tel"
              disabled={!enabled}
              id="lookup-phone"
              inputMode="tel"
              maxLength={20}
              name="phone"
              placeholder={orders.phonePlaceholder}
              required
              type="tel"
            />
          </div>
          <button className="button button--primary" disabled={!enabled} type="submit">
            {orders.lookup}
            <Search aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        </form>
      </section>
      <aside aria-labelledby="order-lookup-help-title" className="summary-panel">
        <h2 id="order-lookup-help-title">{orders.supportTitle}</h2>
        <p className="field-help">{orders.supportDescription}</p>
        <p className="field-help">{orders.supportPrivateLink}</p>
        <ButtonLink href="/products" variant="secondary">
          {copy.chrome.actions.continueShopping}
        </ButtonLink>
      </aside>
    </div>
  );
}
