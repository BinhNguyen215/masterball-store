import { MutationForm } from "@/components/admin/mutation-form";
import { PageHeading } from "@/components/admin/page-heading";
import { requireAdminPage } from "@/modules/auth/guards";
import { SCHEDULED_JOBS, type ScheduledJobName } from "@/modules/auth/admin-application";
import { runJobAction } from "../../actions";

const jobCopy: Record<ScheduledJobName, { description: string; endpoint: string; label: string }> = {
  "release-expired": {
    description: "Hủy đơn chờ thanh toán đã quá hạn và trả lại tồn kho đã giữ.",
    endpoint: "/api/jobs/release-expired",
    label: "Giải phóng đơn quá hạn",
  },
  "publish-scheduled": {
    description: "Xuất bản các thông báo giải đấu đã tới giờ lên lịch.",
    endpoint: "/api/jobs/publish-scheduled",
    label: "Xuất bản giải đấu theo lịch",
  },
  "process-email-outbox": {
    description: "Gửi email giao dịch đang chờ trong outbox.",
    endpoint: "/api/jobs/process-email-outbox",
    label: "Gửi email đang chờ",
  },
};

export default async function JobsPage() {
  await requireAdminPage("jobs.run");
  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim());

  return (
    <>
      <PageHeading
        title="Tác vụ định kỳ"
        description="Ba tác vụ idempotent của hệ thống. Có thể chạy tay tại đây khi cần xử lý sự cố; scheduler bên ngoài gọi cùng endpoint bằng Bearer CRON_SECRET."
      />
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
        <p className="font-bold text-slate-900">
          CRON_SECRET: {cronConfigured ? "đã cấu hình" : "chưa cấu hình"}
        </p>
        <p className="mt-1 text-slate-600">
          {cronConfigured
            ? "Scheduler bên ngoài có thể gọi các endpoint bên dưới. Xem docs/operations/scheduled-jobs.md."
            : "Chưa cấu hình CRON_SECRET nên endpoint trả 503; nút chạy tay dưới đây vẫn dùng được."}
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {SCHEDULED_JOBS.map((job) => (
          <MutationForm action={runJobAction} key={job} submitLabel="Chạy ngay">
            <input type="hidden" name="job" value={job} />
            <h2 className="text-lg font-black">{jobCopy[job].label}</h2>
            <p className="text-xs text-slate-500">{jobCopy[job].description}</p>
            <p className="font-mono text-xs text-slate-500">POST {jobCopy[job].endpoint}</p>
          </MutationForm>
        ))}
      </div>
    </>
  );
}
