import { PageHeading } from "@/components/admin/page-heading";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { requireAdminPage } from "@/modules/auth/guards";

type ConfigurationCheck = {
  key: string;
  label: string;
  note?: string;
  required: boolean;
};

const groups: { title: string; checks: ConfigurationCheck[] }[] = [
  {
    title: "Ứng dụng",
    checks: [
      { key: "APP_URL", label: "URL công khai của ứng dụng", required: true },
      { key: "NEXT_PUBLIC_SITE_URL", label: "URL site cho metadata và sitemap", required: true },
      { key: "NODE_ENV", label: "Chế độ chạy", required: false },
    ],
  },
  {
    title: "Cơ sở dữ liệu",
    checks: [
      { key: "DATABASE_URL", label: "Kết nối PostgreSQL", required: true },
      { key: "MIGRATION_BACKUP_REFERENCE", label: "Bằng chứng backup cho migration production", required: false },
    ],
  },
  {
    title: "Xác thực và phiên",
    checks: [
      { key: "BETTER_AUTH_SECRET", label: "Better Auth secret", required: true },
      { key: "BETTER_AUTH_URL", label: "URL xác thực", required: true },
      { key: "CART_TOKEN_SECRET", label: "Secret token giỏ hàng", note: "Khi trống sẽ dùng chung BETTER_AUTH_SECRET", required: false },
      { key: "ORDER_LOOKUP_SECRET", label: "Secret tra cứu đơn", note: "Khi trống sẽ dùng chung BETTER_AUTH_SECRET", required: false },
    ],
  },
  {
    title: "Thanh toán",
    checks: [
      { key: "VNPAY_TMN_CODE", label: "VNPAY mã merchant", required: true },
      { key: "VNPAY_HASH_SECRET", label: "VNPAY hash secret", required: true },
      { key: "VNPAY_PAYMENT_URL", label: "VNPAY payment URL (sandbox hay production)", required: true },
      { key: "VNPAY_RETURN_URL", label: "VNPAY return URL", required: true },
      { key: "VNPAY_API_URL", label: "VNPAY QueryDr URL", required: true },
    ],
  },
  {
    title: "Email và lưu trữ",
    checks: [
      { key: "SMTP_HOST", label: "SMTP host", required: false },
      { key: "SMTP_PORT", label: "SMTP port", required: false },
      { key: "SMTP_USER", label: "SMTP user", required: false },
      { key: "SMTP_PASSWORD", label: "SMTP password", required: false },
      { key: "EMAIL_FROM", label: "Địa chỉ gửi email", required: false },
      { key: "S3_ENDPOINT", label: "S3 endpoint", required: false },
      { key: "S3_REGION", label: "S3 region", required: false },
      { key: "S3_BUCKET", label: "S3 bucket", required: false },
      { key: "S3_ACCESS_KEY_ID", label: "S3 access key", required: false },
      { key: "S3_SECRET_ACCESS_KEY", label: "S3 secret key", required: false },
      { key: "S3_PUBLIC_BASE_URL", label: "CDN công khai cho media", required: false },
    ],
  },
  {
    title: "Tác vụ định kỳ",
    checks: [{ key: "CRON_SECRET", label: "Bearer secret cho /api/jobs/*", required: true }],
  },
];

export default async function SettingsPage() {
  await requireAdminPage("settings.read");

  const sharedSecrets = [
    !process.env.CART_TOKEN_SECRET?.trim() ? "CART_TOKEN_SECRET" : null,
    !process.env.ORDER_LOOKUP_SECRET?.trim() ? "ORDER_LOOKUP_SECRET" : null,
  ].filter((name): name is string => name !== null);

  return (
    <>
      <PageHeading title="Cấu hình vận hành" description="Chỉ hiển thị trạng thái cấu hình. Giá trị secret không bao giờ được gửi tới trình duyệt." />
      {sharedSecrets.length ? (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="status">
          <p className="font-bold">Cảnh báo secret dùng chung</p>
          <p>
            {sharedSecrets.join(" và ")} đang trống nên hệ thống dùng BETTER_AUTH_SECRET. Hãy đặt secret riêng cho từng miền trước khi vận hành thật.
          </p>
        </div>
      ) : null}
      <div className="grid gap-5">
        {groups.map((group) => (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={group.title}>
            <h2 className="border-b border-slate-100 px-5 py-4 text-lg font-black text-slate-900">{group.title}</h2>
            <ul className="divide-y divide-slate-100">
              {group.checks.map((check) => {
                const configured = Boolean(process.env[check.key]?.trim());
                const critical = check.required && !configured;
                return (
                  <li className="flex items-center justify-between gap-4 px-5 py-4" key={check.key}>
                    <div>
                      <p className="font-bold text-slate-900">{check.label}</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">{check.key}</span>
                        {check.note ? ` · ${check.note}` : ""}
                      </p>
                    </div>
                    <span className={critical ? "rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800" : configured ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900"}>
                      {configured ? "Đã cấu hình" : critical ? "Thiếu (bắt buộc)" : "Chưa cấu hình"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Giá trị được quản lý qua secret manager của môi trường triển khai; trang này không đọc và không ghi secret.
      </p>
      <ChangePasswordForm />
    </>
  );
}
