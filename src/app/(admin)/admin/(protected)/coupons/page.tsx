import Link from "next/link";

import {
  Field,
  MutationForm,
  idInputProps,
  inputClassName,
} from "@/components/admin/mutation-form";
import { PageHeading } from "@/components/admin/page-heading";
import { SearchFilterBar } from "@/components/admin/search-filter-bar";
import type { AdminSearchParams } from "@/components/admin/resource-panel";
import { requireAdminPage } from "@/modules/auth/guards";
import { listAdminCoupons, type CouponRow } from "@/modules/coupons";
import { couponAction } from "../../actions";

const PAGE_SIZE = 50;

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

const KIND_LABELS: Record<CouponRow["kind"], string> = {
  PERCENT: "Phần trăm",
  FIXED: "Số tiền",
};
const STATUS_LABELS: Record<CouponRow["status"], string> = {
  ACTIVE: "Đang chạy",
  DISABLED: "Tạm dừng",
};

function firstValue(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  return first ?? "";
}

function pageHref(query: AdminSearchParams, page: number): string {
  const params = new URLSearchParams();
  const q = firstValue(query.q);
  const status = firstValue(query.status);
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `?${search}` : "?";
}

function couponValue(coupon: CouponRow): string {
  return coupon.kind === "PERCENT" ? `${coupon.value}%` : money.format(coupon.value);
}

function couponWindow(coupon: CouponRow): string {
  const from = coupon.startsAt ? dateTime.format(coupon.startsAt) : "Không giới hạn";
  const to = coupon.endsAt ? dateTime.format(coupon.endsAt) : "Không giới hạn";
  return `${from} → ${to}`;
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<AdminSearchParams>;
}) {
  await requireAdminPage("coupons.read");
  const query = await searchParams;
  const q = firstValue(query.q);
  const status = firstValue(query.status);
  const page = Math.max(1, Number(firstValue(query.page)) || 1);
  const { items, total } = await listAdminCoupons({
    q,
    status,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const hasNextPage = total > page * PAGE_SIZE;

  return (
    <>
      <PageHeading
        title="Mã giảm giá"
        description="Tạo mã và tạm dừng mã đang chạy. Giá trị đơn hàng tối thiểu, hạn mức và thời gian hiệu lực do cơ sở dữ liệu ràng buộc."
      />
      <SearchFilterBar
        placeholder="Mã giảm giá"
        searchParams={query}
        statusOptions={[
          { value: "ACTIVE", label: "Đang chạy" },
          { value: "DISABLED", label: "Tạm dừng" },
        ]}
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-bold text-slate-800">Chưa có mã giảm giá</p>
          <p className="mt-1 text-sm text-slate-500">
            Không có mã phù hợp với bộ lọc.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-4 font-bold">Mã</th>
                <th scope="col" className="px-6 py-4 font-bold">Loại</th>
                <th scope="col" className="px-6 py-4 font-bold">Giá trị</th>
                <th scope="col" className="px-6 py-4 font-bold">Hiệu lực</th>
                <th scope="col" className="px-6 py-4 font-bold">Đã dùng</th>
                <th scope="col" className="px-6 py-4 font-bold">Trạng thái</th>
                <th scope="col" className="px-6 py-4 font-bold">Phiên bản</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4 font-bold text-slate-900">{coupon.code}</td>
                  <td className="px-6 py-4 text-slate-700">{KIND_LABELS[coupon.kind]}</td>
                  <td className="px-6 py-4 text-slate-700">
                    {couponValue(coupon)}
                    <span className="ml-2 text-xs text-slate-500">
                      tối thiểu {money.format(coupon.minOrderVnd)}
                      {coupon.maxDiscountVnd === null
                        ? ""
                        : ` · trần ${money.format(coupon.maxDiscountVnd)}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{couponWindow(coupon)}</td>
                  <td className="px-6 py-4 text-slate-700">
                    {coupon.usedCount}/{coupon.usageLimit ?? "∞"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={
                        coupon.status === "ACTIVE"
                          ? "rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800"
                          : "rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700"
                      }
                    >
                      {STATUS_LABELS[coupon.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{coupon.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page > 1 || hasNextPage ? (
        <nav className="mt-4 flex items-center justify-between gap-4" aria-label="Phân trang mã giảm giá">
          {page > 1 ? (
            <Link className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700" href={pageHref(query, page - 1)}>
              Trang trước
            </Link>
          ) : <span />}
          <span className="text-sm text-slate-600">Trang {page}</span>
          {hasNextPage ? (
            <Link className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700" href={pageHref(query, page + 1)}>
              Trang sau
            </Link>
          ) : <span />}
        </nav>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <MutationForm action={couponAction} submitLabel="Tạo mã giảm giá">
          <input type="hidden" name="operation" value="create" />
          <h2 className="text-lg font-bold">Mã mới</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mã (chữ in hoa, số, gạch)">
              <input className={inputClassName} name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_-]{2,31}" placeholder="TCG50" />
            </Field>
            <Field label="Loại">
              <select className={inputClassName} name="kind">
                <option value="PERCENT">Phần trăm (%)</option>
                <option value="FIXED">Số tiền (VND)</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Giá trị"><input className={inputClassName} name="value" type="number" min={1} step={1} required /></Field>
            <Field label="Đơn tối thiểu (VND)"><input className={inputClassName} name="minOrderVnd" type="number" min={0} step={1} defaultValue={0} required /></Field>
            <Field label="Giảm tối đa (VND)"><input className={inputClassName} name="maxDiscountVnd" type="number" min={1} step={1} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bắt đầu"><input className={inputClassName} name="startsAt" type="date" /></Field>
            <Field label="Kết thúc"><input className={inputClassName} name="endsAt" type="date" /></Field>
          </div>
          <Field label="Giới hạn lượt dùng"><input className={inputClassName} name="usageLimit" type="number" min={1} step={1} /></Field>
          <Field label="Ghi chú nội bộ"><textarea className={inputClassName} name="note" rows={3} maxLength={240} /></Field>
          <p className="text-xs text-slate-500">Thời gian hiệu lực áp dụng theo ngày tại Việt Nam (Asia/Ho_Chi_Minh); để trống nghĩa là không giới hạn.</p>
        </MutationForm>

        <MutationForm action={couponAction} submitLabel="Lưu trạng thái">
          <input type="hidden" name="operation" value="set-status" />
          <h2 className="text-lg font-bold">Tạm dừng / mở lại</h2>
          <Field label="Mã nội bộ của coupon"><input className={inputClassName} name="couponId" required {...idInputProps} /></Field>
          <Field label="Trạng thái đích">
            <select className={inputClassName} name="status">
              <option value="ACTIVE">Đang chạy</option>
              <option value="DISABLED">Tạm dừng</option>
            </select>
          </Field>
          <Field label="Phiên bản hiện tại"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
          <p className="text-xs text-slate-500">Đang tạm dừng nghĩa là mã không thể áp dụng ở giỏ hàng cho tới khi được mở lại.</p>
        </MutationForm>
      </div>
    </>
  );
}
