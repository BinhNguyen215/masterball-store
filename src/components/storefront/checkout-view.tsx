"use client";

import { AlertTriangle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { formatVnd } from "@/components/storefront/storefront-formatters";
import type { CartLineItemViewModel } from "@/components/storefront/storefront-types";
import { formatCopy, type StorefrontCopy, type StorefrontLocale } from "@/i18n";
import type { PickupLocation } from "@/modules/checkout/pickup-location";
import {
  getCheckoutShippingFee,
  getVietnamShippingFee,
  HO_CHI_MINH_SHIPPING_VND,
  OTHER_PROVINCE_SHIPPING_VND,
} from "@/modules/checkout/shipping-fee";
import type { VietnamProvince } from "@/modules/checkout/vietnam-locations";

type CheckoutAction = (formData: FormData) => Promise<void>;
type CheckoutCopy = StorefrontCopy["checkout"]["checkout"];

type CheckoutViewProps = {
  /** Money that reaches the shop account before the order is fulfilled. */
  bankTransferAvailable?: boolean;
  cartVersion?: number;
  checkoutAction?: CheckoutAction;
  copy: CheckoutCopy;
  coupons: StorefrontCopy["coupons"];
  enabled: boolean;
  items: CartLineItemViewModel[];
  locale: StorefrontLocale;
  message?: { kind: "error" | "success"; text: string };
  /** Null when the deployment has no shop address, which hides pickup. */
  pickup: PickupLocation | null;
  provinces: VietnamProvince[];
  subtotalVnd: number;
};

export function CheckoutView({
  bankTransferAvailable = false,
  cartVersion,
  checkoutAction,
  copy,
  coupons,
  enabled,
  items,
  locale,
  message,
  pickup,
  provinces,
  subtotalVnd,
}: CheckoutViewProps) {
  const [province, setProvince] = useState("");
  const [fulfillment, setFulfillment] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const collecting = fulfillment === "PICKUP";
  const hasProvince = province.trim().length > 0;
  const shippingVnd = collecting
    ? getCheckoutShippingFee({ fulfillment: "PICKUP", province })
    : hasProvince
      ? getCheckoutShippingFee({ fulfillment: "DELIVERY", province })
      : null;
  const shippingRegion =
    collecting || !hasProvince
      ? null
      : getVietnamShippingFee({ province }) === HO_CHI_MINH_SHIPPING_VND
        ? copy.shippingRegionHcm
        : copy.shippingRegionOther;
  const hasProvinceList = provinces.length > 0;

  return (
    <div className="checkout-layout">
      <section
        aria-labelledby="checkout-details-title"
        className="checkout-panel"
        data-disabled={!enabled}
      >
        <h2 id="checkout-details-title">{copy.detailsTitle}</h2>
        {message ? (
          <div className="notice" role={message.kind === "error" ? "alert" : "status"}>
            <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
            <p>{message.text}</p>
          </div>
        ) : null}
        <form action={checkoutAction} className="checkout-form">
          <input name="cartVersion" type="hidden" value={cartVersion} />
          {pickup ? (
            <fieldset className="payment-methods">
              <legend className="field-label">{copy.deliveryLegend}</legend>
              <label className="payment-method">
                <input
                  checked={!collecting}
                  disabled={!enabled}
                  name="fulfillment"
                  onChange={() => setFulfillment("DELIVERY")}
                  type="radio"
                  value="DELIVERY"
                />
                <span aria-hidden="true" className="payment-method-icon">🛵</span>
                <span>
                  <strong>{copy.deliveryTitle}</strong>
                  <small>{copy.deliveryHint}</small>
                </span>
              </label>
              <label className="payment-method">
                <input
                  checked={collecting}
                  disabled={!enabled}
                  name="fulfillment"
                  onChange={() => setFulfillment("PICKUP")}
                  type="radio"
                  value="PICKUP"
                />
                <span aria-hidden="true" className="payment-method-icon">🏬</span>
                <span>
                  <strong>{copy.pickupTitle}</strong>
                  <small>
                    {formatCopy(copy.pickupHint, { address: pickup.address })}
                  </small>
                </span>
              </label>
            </fieldset>
          ) : null}
          <div className="field">
            <label className="field-label" htmlFor="checkout-name">
              {copy.name}
            </label>
            <input
              autoComplete="name"
              disabled={!enabled}
              id="checkout-name"
              maxLength={120}
              name="recipientName"
              placeholder={copy.namePlaceholder}
              required
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-phone">
              {copy.phone}
            </label>
            <input
              autoComplete="tel"
              disabled={!enabled}
              id="checkout-phone"
              inputMode="tel"
              maxLength={20}
              name="phone"
              placeholder={copy.phonePlaceholder}
              required
              type="tel"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="checkout-email">
              {copy.email} <span className="field-help">{copy.optional}</span>
            </label>
            <input
              autoComplete="email"
              disabled={!enabled}
              id="checkout-email"
              inputMode="email"
              maxLength={320}
              name="email"
              placeholder={copy.emailPlaceholder}
              spellCheck={false}
              type="email"
            />
          </div>
          {collecting ? (
            <div className="field">
              <span className="field-label">{copy.pickupAddressLabel}</span>
              <p>
                {pickup?.storeName ? `${pickup.storeName} · ` : ""}
                {pickup?.address}
              </p>
              <p className="field-help">{copy.pickupContactNote}</p>
            </div>
          ) : (
            <>
              <div className="field">
                <label className="field-label" htmlFor="checkout-line-1">
                  {copy.line1}
                </label>
                <input
                  autoComplete="address-line1"
                  disabled={!enabled}
                  id="checkout-line-1"
                  maxLength={250}
                  name="line1"
                  required
                  type="text"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="checkout-line-2">
                  {copy.line2} <span className="field-help">{copy.optional}</span>
                </label>
                <input
                  autoComplete="address-line2"
                  disabled={!enabled}
                  id="checkout-line-2"
                  maxLength={250}
                  name="line2"
                  type="text"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="checkout-ward">
                  {copy.ward} <span className="field-help">{copy.optional}</span>
                </label>
                <input
                  autoComplete="address-level3"
                  disabled={!enabled}
                  id="checkout-ward"
                  maxLength={120}
                  name="ward"
                  type="text"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="checkout-district">
                  {copy.district}
                </label>
                <input
                  autoComplete="address-level2"
                  disabled={!enabled}
                  id="checkout-district"
                  maxLength={120}
                  name="district"
                  required
                  type="text"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="checkout-province">
                  {copy.province}
                </label>
                {hasProvinceList ? (
                  <select
                    autoComplete="address-level1"
                    disabled={!enabled}
                    id="checkout-province"
                    name="province"
                    onChange={(event) => setProvince(event.target.value)}
                    required
                    value={province}
                  >
                    <option value="">{copy.provincePlaceholderOption}</option>
                    {provinces.map((option) => (
                      <option key={option.code} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    autoComplete="address-level1"
                    disabled={!enabled}
                    id="checkout-province"
                    maxLength={120}
                    name="province"
                    onChange={(event) => setProvince(event.target.value)}
                    placeholder={copy.provincePlaceholder}
                    required
                    type="text"
                    value={province}
                  />
                )}
                <p className="field-help">
                  {formatCopy(copy.provinceHelp, {
                    hcm: formatVnd(HO_CHI_MINH_SHIPPING_VND, locale),
                    other: formatVnd(OTHER_PROVINCE_SHIPPING_VND, locale),
                  })}
                </p>
              </div>
            </>
          )}
          <fieldset className="payment-methods">
            <legend className="field-label">{copy.paymentLegend}</legend>
            <label className="payment-method">
              <input
                disabled={!enabled}
                name="paymentMethod"
                type="radio"
                value="VNPAY"
              />
              <span aria-hidden="true" className="payment-method-icon">💳</span>
              <span>
                <strong>{copy.vnpayTitle}</strong>
                <small>{copy.vnpayHint}</small>
              </span>
            </label>
            <label className="payment-method">
              <input
                defaultChecked
                disabled={!enabled}
                name="paymentMethod"
                type="radio"
                value="COD"
              />
              <span aria-hidden="true" className="payment-method-icon">📦</span>
              <span>
                <strong>{copy.codTitle}</strong>
                <small>{copy.codHint}</small>
              </span>
            </label>
            {bankTransferAvailable ? (
              <label className="payment-method">
                <input
                  disabled={!enabled}
                  name="paymentMethod"
                  type="radio"
                  value="BANK_TRANSFER"
                />
                <span aria-hidden="true" className="payment-method-icon">🏦</span>
                <span>
                  <strong>{copy.bankTransferTitle}</strong>
                  <small>{copy.bankTransferHint}</small>
                </span>
              </label>
            ) : null}
            <p className="field-help">{copy.vnpayNote}</p>
          </fieldset>
          <div className="field">
            <label className="field-label" htmlFor="checkout-note">
              {copy.note} <span className="field-help">{copy.optional}</span>
            </label>
            <textarea
              disabled={!enabled}
              id="checkout-note"
              maxLength={1000}
              name="customerNote"
              rows={4}
            />
          </div>
          <div className="field">
            <label htmlFor="checkout-coupon">
              {coupons.fieldLabel}{" "}
              <span className="field-help">{copy.optional}</span>
            </label>
            <input
              autoComplete="off"
              disabled={!enabled}
              id="checkout-coupon"
              maxLength={32}
              name="couponCode"
              placeholder={coupons.fieldPlaceholder}
              type="text"
            />
            <p className="field-help">{coupons.emptyHint}</p>
          </div>
          <label className="consent-field">
            <input
              disabled={!enabled}
              id="checkout-terms"
              name="acceptTerms"
              required
              type="checkbox"
            />
            <span>
              {copy.consentPrefix}{" "}
              <Link href="/policies/terms">{copy.consentTerms}</Link>,{" "}
              <Link href="/policies/returns">{copy.consentReturns}</Link>{" "}
              {copy.consentConjunction}{" "}
              <Link href="/policies/privacy">{copy.consentPrivacy}</Link>.
            </span>
          </label>
          <button className="button button--primary" disabled={!enabled} type="submit">
            <LockKeyhole aria-hidden="true" size={18} strokeWidth={1.8} />
            {enabled ? copy.submit : copy.submitDisabled}
          </button>
        </form>
      </section>
      <aside aria-labelledby="checkout-summary-title" className="summary-panel">
        <h2 id="checkout-summary-title">{copy.summaryTitle}</h2>
        {items.length ? (
          <dl className="order-summary-list">
            {items.map((item) => (
              <div className="order-summary-row" key={item.lineId}>
                <dt>
                  {item.productName} × {item.quantity}
                  <span className="field-help"> {item.variantLabel}</span>
                  {item.warning ? (
                    <span className="cart-warning"> {item.warning}</span>
                  ) : null}
                </dt>
                <dd>{formatVnd(item.unitPriceVnd * item.quantity, locale)}</dd>
              </div>
            ))}
            <div className="order-summary-row">
              <dt>{copy.subtotal}</dt>
              <dd>{formatVnd(subtotalVnd, locale)}</dd>
            </div>
            <div className="order-summary-row">
              <dt>
                {collecting ? copy.pickupTitle : copy.shipping}
                {shippingRegion ? (
                  <span className="field-help"> ({shippingRegion})</span>
                ) : null}
              </dt>
              <dd>
                {collecting
                  ? copy.shippingFree
                  : shippingVnd === null
                    ? copy.shippingPending
                    : formatVnd(shippingVnd, locale)}
              </dd>
            </div>
            <div className="order-summary-row">
              <dt>
                {shippingVnd === null ? copy.totalExcludingShipping : copy.total}
              </dt>
              <dd>{formatVnd(subtotalVnd + (shippingVnd ?? 0), locale)}</dd>
            </div>
          </dl>
        ) : (
          <p className="field-help">{copy.summaryEmpty}</p>
        )}
      </aside>
    </div>
  );
}
