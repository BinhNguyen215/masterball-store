"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { RestockAlertForm } from "@/components/storefront/restock-alert-form";
import type { ProductDetailViewModel } from "@/components/storefront/storefront-types";
import type { StorefrontCopy } from "@/i18n";

type ProductFormAction = (formData: FormData) => Promise<void>;

/**
 * The submit button owns its own pending state, so a slow add-to-cart cannot be
 * pressed twice and the shopper gets feedback while the server action runs.
 */
function AddToCartButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className="button button--primary" disabled={pending} type="submit">
      {pending ? pendingLabel : label}
      <ShoppingBag aria-hidden="true" size={18} strokeWidth={1.8} />
    </button>
  );
}

type ProductPurchaseFormProps = {
  addToCartAction: ProductFormAction;
  copy: StorefrontCopy["product"];
  /** The restock action; absent when the storefront has no database. */
  restockAction?: ProductFormAction;
  restockCopy: StorefrontCopy["restock"];
  variants: ProductDetailViewModel["variants"];
};

/**
 * The variant picker plus the one action that applies to the selection. A
 * sellable variant shows the add-to-cart fields; an out-of-stock variant swaps
 * them for the restock alert, so the shopper is never offered a submit that can
 * only fail. The selection lives here because both actions depend on it.
 */
export function ProductPurchaseForm({
  addToCartAction,
  copy,
  restockAction,
  restockCopy,
  variants,
}: ProductPurchaseFormProps) {
  const [variantId, setVariantId] = useState("");
  const selected = variants.find((variant) => variant.id === variantId);
  const outOfStock = selected ? !selected.available : false;

  return (
    <>
      <form action={addToCartAction} className="filter-form">
        <div className="field">
          <label className="field-label" htmlFor="product-variant">
            {copy.variant}
          </label>
          <select
            id="product-variant"
            name="variantId"
            onChange={(event) => setVariantId(event.target.value)}
            required
            value={variantId}
          >
            <option value="">{copy.chooseVariant}</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
                {variant.available ? "" : copy.variantOutOfStockSuffix}
              </option>
            ))}
          </select>
        </div>
        {outOfStock ? null : (
          <>
            <div className="field">
              <label className="field-label" htmlFor="product-quantity">
                {copy.quantity}
              </label>
              <input
                defaultValue="1"
                id="product-quantity"
                inputMode="numeric"
                max="99"
                min="1"
                name="quantity"
                required
                type="number"
              />
            </div>
            <AddToCartButton label={copy.addToCart} pendingLabel={copy.addingToCart} />
          </>
        )}
      </form>
      {outOfStock && selected && restockAction ? (
        <RestockAlertForm
          action={restockAction}
          copy={restockCopy}
          variantId={selected.id}
        />
      ) : null}
    </>
  );
}
