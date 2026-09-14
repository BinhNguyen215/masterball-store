import { PageHeading } from "@/components/admin/page-heading";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { requireAdminPage } from "@/modules/auth/guards";

const checks = [
  ["Cơ sở dữ liệu", "DATABASE_URL"],
  ["Better Auth", "BETTER_AUTH_SECRET"],
  ["VNPAY", "VNPAY_HASH_SECRET"],
  ["Email", "SMTP_PASSWORD"],
  ["Object storage", "S3_SECRET_ACCESS_KEY"],
  ["Scheduled jobs", "CRON_SECRET"],
] as const;

export default async function SettingsPage() {
  await requireAdminPage("settings.read");
  return (
    <>
      <PageHeading title="Cấu hình vận hành" description="Chỉ hiển thị trạng thái cấu hình. Giá trị secret không bao giờ được gửi tới trình duyệt." />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {checks.map(([label, key]) => {
            const configured = Boolean(process.env[key]);
            return (
              <li key={key} className="flex items-center justify-between gap-4 px-5 py-4">
                <div><p className="font-bold text-slate-900">{label}</p><p className="text-xs text-slate-500">Quản lý qua secret manager của môi trường triển khai</p></div>
                <span className={configured ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800" : "rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900"}>{configured ? "Đã cấu hình" : "Chưa cấu hình"}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <ChangePasswordForm />
    </>
  );
}
