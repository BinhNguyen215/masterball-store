import { IntegrationError } from "@/components/admin/integration-state";
import { Field, MutationForm, inputClassName } from "@/components/admin/mutation-form";
import { PageHeading } from "@/components/admin/page-heading";
import type { AdminSearchParams } from "@/components/admin/resource-panel";
import { requireAdminPage } from "@/modules/auth/guards";
import { listAdminProductReviews, type ReviewRow } from "@/modules/reviews";
import { reviewAction } from "../../actions";

const PAGE_SIZE = 50;

/** The console only ever decides between these two outcomes. */
const DECISIONS = [
  { value: "publish", label: "Duyệt và công khai" },
  { value: "reject", label: "Từ chối" },
] as const;

const dateTime = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

/** A moderation row keeps the full text in the database but not on the screen. */
const EXCERPT_LENGTH = 180;

function excerpt(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > EXCERPT_LENGTH
    ? `${trimmed.slice(0, EXCERPT_LENGTH)}…`
    : trimmed;
}

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className="whitespace-nowrap text-amber-500" aria-hidden="true">
      {"★".repeat(filled)}
      <span className="text-slate-300">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdminPage("reviews.moderate");
  const query = await searchParams;

  if (!process.env.DATABASE_URL?.trim()) {
    return (
      <>
        <PageHeading
          title="Đánh giá"
          description="Kiểm duyệt đánh giá của người mua trước khi công khai trên trang sản phẩm."
        />
        <IntegrationError label="đánh giá" />
      </>
    );
  }

  const page = Math.max(1, Number(firstValue(query.page)) || 1);
  const [pending, published] = await Promise.all([
    listAdminProductReviews({
      status: "PENDING",
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    // The queue processes one status per view, so the public counter is read
    // from its own single-row query instead of a second page of rows.
    listAdminProductReviews({ status: "PUBLISHED", limit: 1 }),
  ]);

  const totalPages = Math.max(1, Math.ceil(pending.total / PAGE_SIZE));
  const href = (targetPage: number) => `?page=${targetPage}`;

  return (
    <>
      <PageHeading
        title="Đánh giá"
        description="Đánh giá chỉ được ghi nhận khi mã đơn và số điện thoại trùng khớp, nên hàng chờ này toàn đánh giá của người đã mua. Duyệt thì công khai ngay, từ chối thì lưu lý do vào nhật ký."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Chờ kiểm duyệt
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pending.total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Đã công khai
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{published.total}</p>
        </div>
      </div>

      {pending.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-bold text-slate-800">Không còn đánh giá chờ duyệt</p>
          <p className="mt-1 text-sm text-slate-500">
            Mọi đánh giá đã được xử lý. Hàng chờ sẽ đầy lại khi khách gửi đánh giá mới.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold">Đánh giá</th>
                <th scope="col" className="px-6 py-4 font-bold">Người gửi</th>
                <th scope="col" className="px-6 py-4 font-bold">Sản phẩm</th>
                <th scope="col" className="px-6 py-4 font-bold">Nội dung</th>
                <th scope="col" className="px-6 py-4 font-bold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pending.items.map((row: ReviewRow) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-6 py-4 text-slate-700">
                    <Stars rating={row.rating} />
                    <p className="mt-1 text-xs text-slate-500">
                      {row.rating}/5 · {dateTime.format(row.createdAt)}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    <p className="font-bold text-slate-900">{row.authorName}</p>
                    <p className="text-xs text-slate-500">
                      {row.orderId ? "Đã xác thực đơn hàng" : "Không gắn đơn hàng"}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{row.productTitle}</td>
                  <td className="max-w-[26rem] px-6 py-4 text-xs leading-6 text-slate-600">
                    {excerpt(row.body)}
                  </td>
                  <td className="min-w-[20rem] px-6 py-4">
                    <MutationForm action={reviewAction} submitLabel="Lưu quyết định">
                      <input type="hidden" name="reviewId" value={row.id} />
                      <Field label="Quyết định">
                        <select
                          className={inputClassName}
                          defaultValue="publish"
                          name="operation"
                        >
                          {DECISIONS.map((decision) => (
                            <option key={decision.value} value={decision.value}>
                              {decision.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Lý do từ chối (không bắt buộc)">
                        <input
                          className={inputClassName}
                          maxLength={240}
                          name="note"
                        />
                      </Field>
                      <p className="text-xs text-slate-500">
                        Lý do được lưu vào nhật ký cùng tài khoản thực hiện; nội dung
                        từ chối không hiển thị cho khách.
                      </p>
                    </MutationForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending.total > PAGE_SIZE ? (
        <nav
          aria-label="Phân trang đánh giá"
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
          <span className="text-sm text-slate-600">
            Trang {Math.min(page, totalPages)} / {totalPages}
          </span>
          {page < totalPages ? (
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
