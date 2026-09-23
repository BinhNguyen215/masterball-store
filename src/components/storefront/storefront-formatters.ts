import type { StorefrontLocale } from "@/i18n/storefront";

const vndFormatters: Record<StorefrontLocale, Intl.NumberFormat> = {
  vi: new Intl.NumberFormat("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }),
  en: new Intl.NumberFormat("en-GB", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }),
};

const dateTimeFormatters: Record<StorefrontLocale, Intl.DateTimeFormat> = {
  vi: new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }),
  en: new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }),
};

export function formatVnd(value: number, locale: StorefrontLocale = "vi") {
  return vndFormatters[locale].format(value);
}

export function formatVietnamDateTime(
  value: string,
  locale: StorefrontLocale = "vi",
) {
  return dateTimeFormatters[locale].format(new Date(value));
}
