import { IntegrationError } from "@/components/admin/integration-state";
import { Field, MutationForm, inputClassName } from "@/components/admin/mutation-form";
import { PageHeading } from "@/components/admin/page-heading";
import type { AdminSearchParams } from "@/components/admin/resource-panel";
import { requireAdminPage } from "@/modules/auth/guards";
import {
  listAdminTournaments,
  listTournamentRegistrations,
  type RegistrationRow,
} from "@/modules/tournaments";
import { registrationAction } from "../../actions";

const PAGE_SIZE = 50;

const STATUS_LABELS: Record<RegistrationRow["status"], string> = {
  REGISTERED: "Đã đăng ký",
  WAITLISTED: "Danh sách chờ",
  CHECKED_IN: "Đã check-in",
  CANCELLED: "Đã hủy",
};

const PAYMENT_LABELS: Record<RegistrationRow["paymentStatus"], string> = {
  UNPAID: "Chưa thu",
  PAID: "Đã thu",
  WAIVED: "Miễn phí",
};

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** Only the transitions that make sense for the seat's current status. */
const OPERATIONS: Record<RegistrationRow["status"], Array<{ value: string; label: string }>> = {
  REGISTERED: [
    { value: "check-in", label: "Check-in" },
    { value: "cancel", label: "Hủy chỗ" },
    { value: "settle-fee", label: "Ghi nhận phí" },
  ],
  WAITLISTED: [
    { value: "check-in", label: "Check-in" },
    { value: "cancel", label: "Hủy chỗ" },
    { value: "settle-fee", label: "Ghi nhận phí" },
  ],
  CHECKED_IN: [
    { value: "cancel", label: "Hủy chỗ" },
    { value: "settle-fee", label: "Ghi nhận phí" },
  ],
  CANCELLED: [{ value: "settle-fee", label: "Ghi nhận phí" }],
};

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdminPage("registrations.read");
  const query = await searchParams;

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <>
        <PageHeading
          title="Đăng ký giải đấu"
          description="Giữ chỗ, check-in và thu phí tham dự tại quầy."
        />
        <IntegrationError label="đăng ký giải đấu" />
      </>
    );
  }

  const tournamentId = firstValue(query.tournamentId);
  const status = firstValue(query.status);
  const page = Math.max(1, Number(firstValue(query.page)) || 1);

  const [tournaments, { items, total }] = await Promise.all([
    listAdminTournaments({ limit: 200 }),
    listTournamentRegistrations({
      tournamentId: tournamentId || undefined,
      status: status || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  // `total` is counted one row past this page (see the service), so it is a
  // lower bound and must not be printed as an exact page count.
  const hasNextPage = total > page * PAGE_SIZE;
  const href = (targetPage: number) => {
    const params = new URLSearchParams();
    if (tournamentId) params.set("tournamentId", tournamentId);
    if (status) params.set("status", status);
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  };

  return (
    <>
      <PageHeading
        title="Đăng ký giải đấu"
        description="Giữ chỗ, check-in và thu phí tham dự tại quầy. Mọi thao tác đều kiểm tra phiên bản để tránh ghi đè."
      />
      <form
        method="get"
        className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_13rem_auto]"
      >
        <label className="sr-only" htmlFor="registration-tournament">
          Giải đấu
        </label>
        <select
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          defaultValue={tournamentId}
          id="registration-tournament"
          name="tournamentId"
        >
          <option value="">Tất cả giải đấu</option>
          {tournaments.items.map(({ tournament }) => (
            <option key={tournament.id} value={tournament.id}>
              {tournament.title}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="registration-status">
          Trạng thái
        </label>
        <select
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          defaultValue={status}
          id="registration-status"
          name="status"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-6 py-3 font-bold text-white hover:bg-slate-800"
        >
          Lọc
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-bold text-slate-800">Chưa có dữ liệu</p>
          <p className="mt-1 text-sm text-slate-500">
            Không có đăng ký phù hợp với bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[72rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold">Người đăng ký</th>
                <th scope="col" className="px-6 py-4 font-bold">Giải đấu</th>
                <th scope="col" className="px-6 py-4 font-bold">Trạng thái</th>
                <th scope="col" className="px-6 py-4 font-bold">Phí tham dự</th>
                <th scope="col" className="px-6 py-4 font-bold">Ghi chú</th>
                <th scope="col" className="px-6 py-4 font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-6 py-4 text-slate-700">
                    <p className="font-bold text-slate-900">{row.fullName}</p>
                    <p className="text-xs text-slate-500">{row.phone}</p>
                    {row.email ? <p className="text-xs text-slate-500">{row.email}</p> : null}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    <p>{row.tournamentTitle}</p>
                    <p className="text-xs text-slate-500">{row.tournamentSlug}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    <p>{STATUS_LABELS[row.status]}</p>
                    <p className="text-xs text-slate-500">
                      {dateTime.format(row.createdAt)}
                    </p>
                    {row.checkedInAt ? (
                      <p className="text-xs text-slate-500">
                        Check-in {dateTime.format(row.checkedInAt)}
                      </p>
                    ) : null}
                    {row.cancelledAt ? (
                      <p className="text-xs text-slate-500">
                        Hủy {dateTime.format(row.cancelledAt)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    <p>{PAYMENT_LABELS[row.paymentStatus]}</p>
                    {row.paidAt ? (
                      <p className="text-xs text-slate-500">{dateTime.format(row.paidAt)}</p>
                    ) : null}
                  </td>
                  <td className="max-w-[16rem] px-6 py-4 text-xs text-slate-500">
                    {row.note ?? "—"}
                  </td>
                  <td className="min-w-[18rem] px-6 py-4">
                    <MutationForm action={registrationAction} submitLabel="Cập nhật">
                      <input type="hidden" name="registrationId" value={row.id} />
                      <input type="hidden" name="version" value={row.version} />
                      <p className="text-xs text-slate-500">
                        Phiên bản hiện tại: {row.version}
                      </p>
                      <Field label="Thao tác">
                        <select className={inputClassName} name="operation">
                          {OPERATIONS[row.status].map((operation) => (
                            <option key={operation.value} value={operation.value}>
                              {operation.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Trạng thái phí">
                        <select
                          className={inputClassName}
                          defaultValue={row.paymentStatus === "WAIVED" ? "WAIVED" : "PAID"}
                          name="paymentStatus"
                        >
                          <option value="PAID">Đã thu</option>
                          <option value="WAIVED">Miễn phí</option>
                        </select>
                      </Field>
                      <Field label="Ghi chú (không bắt buộc)">
                        <input className={inputClassName} maxLength={240} name="note" />
                      </Field>
                    </MutationForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page > 1 || hasNextPage ? (
        <nav
          aria-label="Phân trang đăng ký giải đấu"
          className="mt-4 flex items-center justify-between gap-4"
        >
          {page > 1 ? (
            <a
              className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700"
              href={href(page - 1)}
            >
              Trang trước
            </a>
          ) : (
            <span />
          )}
          <span className="text-sm text-slate-600">Trang {page}</span>
          {hasNextPage ? (
            <a
              className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700"
              href={href(page + 1)}
            >
              Trang sau
            </a>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
