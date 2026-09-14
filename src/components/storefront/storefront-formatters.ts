const vndFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

export function formatVnd(value: number) {
  return vndFormatter.format(value);
}

export function formatVietnamDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}
