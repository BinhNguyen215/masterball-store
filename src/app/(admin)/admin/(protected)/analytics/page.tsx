import type { ReactNode } from "react";

import { PageHeading } from "@/components/admin/page-heading";
import {
  ATTENTION_LIMIT,
  getAnalyticsOverview,
  STALE_COD_DAYS,
  type AttentionBucket,
  type RevenueTrend,
  type StatusCount,
} from "@/modules/analytics";
import { requireAdminPage } from "@/modules/auth/guards";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã huỷ",
  COMPLETED: "Hoàn tất",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PENDING: "Đang chờ",
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
  PARTIALLY_REFUNDED: "Hoàn tiền một phần",
  MANUAL_REVIEW: "Cần đối soát",
};

const EMAIL_STATUS_LABELS: Record<string, string> = {
  PENDING: "Đang chờ gửi",
  PROCESSING: "Đang gửi",
  SENT: "Đã gửi",
  FAILED: "Gửi lỗi",
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

function StatusRows({ rows, labels, emptyLabel }: { rows: StatusCount[]; labels: Record<string, string>; emptyLabel: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((row) => (
        <li key={row.status} className="flex items-center justify-between gap-4 py-3 text-sm">
          <span className="text-slate-600">{labels[row.status] ?? row.status}</span>
          <span className="font-bold text-slate-900">{integer.format(row.total)}</span>
        </li>
      ))}
    </ul>
  );
}

function TrendNote({ trend }: { trend: RevenueTrend }) {
  if (trend.direction === "flat") {
    return <span className="text-sm font-bold text-slate-500">Không đổi so với 30 ngày trước</span>;
  }
  const up = trend.direction === "up";
  return (
    <span className={up ? "text-sm font-bold text-emerald-700" : "text-sm font-bold text-rose-700"}>
      {up ? "▲" : "▼"} {money.format(Math.abs(trend.deltaVnd))}
      {trend.deltaPercent === null ? "" : ` (${percent.format(Math.abs(trend.deltaPercent))}%)`}
      <span className="font-normal text-slate-500"> so với 30 ngày trước</span>
    </span>
  );
}

function AttentionList({ title, bucket, emptyLabel }: { title: string; bucket: AttentionBucket; emptyLabel: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className="text-sm font-bold text-slate-900">{integer.format(bucket.total)}</span>
      </div>
      {bucket.items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {bucket.items.map((order) => (
            <li key={order.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
              <span className="font-mono text-xs text-slate-700">{order.orderNumber}</span>
              <span className="text-slate-500">
                {order.reservationExpiresAt
                  ? `Hết hạn ${dateTime.format(order.reservationExpiresAt)}`
                  : dateTime.format(order.createdAt)}
              </span>
              <span className="font-semibold text-slate-900">{money.format(order.totalVnd)}</span>
            </li>
          ))}
        </ul>
      )}
      {bucket.total > bucket.items.length ? (
        <p className="mt-2 text-xs text-slate-500">
          Hiển thị {integer.format(bucket.items.length)} trên {integer.format(bucket.total)} đơn.
        </p>
      ) : null}
    </div>
  );
}

export default async function AnalyticsPage() {
  await requireAdminPage("analytics.read");
  const overview = await getAnalyticsOverview();
  const { revenue, attention, operations } = overview;
  const attentionTotal =
    attention.expiredReservations.total + attention.manualReview.total + attention.staleCod.total;

  return (
    <>
      <PageHeading
        title="Phân tích vận hành"
        description="Bảng điều khiển chỉ đọc cho doanh thu, trạng thái đơn, hàng đợi và cảnh báo tồn kho. Mọi số liệu được tính trực tiếp từ cơ sở dữ liệu tại thời điểm mở trang."
      />
      <div className="grid gap-6">
        <Section
          title={`Doanh thu ${revenue.windowDays} ngày`}
          hint={`Thanh toán ở trạng thái đã thu, tính theo ngày ghi nhận giao dịch. Số liệu lúc ${dateTime.format(overview.generatedAt)} (giờ Việt Nam).`}
        >
          {revenue.collectedVnd === 0 && revenue.previousCollectedVnd === 0 ? (
            <EmptyNote>Chưa có giao dịch nào được thu trong 60 ngày qua.</EmptyNote>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Đã thu {revenue.windowDays} ngày qua</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{money.format(revenue.collectedVnd)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{revenue.windowDays} ngày trước đó</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{money.format(revenue.previousCollectedVnd)}</p>
                <p className="mt-1">
                  <TrendNote trend={revenue.trend} />
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Đơn đã thanh toán</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{integer.format(revenue.paidOrders)}</p>
              </div>
            </div>
          )}
        </Section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Đơn hàng theo trạng thái" hint="Toàn bộ đơn hàng, nhóm theo trạng thái xử lý và trạng thái thanh toán.">
            {overview.orderStatus.length === 0 && overview.paymentStatus.length === 0 ? (
              <EmptyNote>Chưa có đơn hàng nào.</EmptyNote>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-500">Trạng thái xử lý</h3>
                  <StatusRows rows={overview.orderStatus} labels={ORDER_STATUS_LABELS} emptyLabel="Chưa có đơn hàng." />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-500">Trạng thái thanh toán</h3>
                  <StatusRows rows={overview.paymentStatus} labels={PAYMENT_STATUS_LABELS} emptyLabel="Chưa có đơn hàng." />
                </div>
              </div>
            )}
          </Section>

          <Section title="Hàng đợi vận hành" hint="Khối lượng đang chờ xử lý trong email, đăng ký giải đấu và kiểm duyệt đánh giá.">
            {operations.emailByStatus.length === 0 && operations.pendingTournamentRegistrations === 0 && operations.pendingProductReviews === 0 ? (
              <EmptyNote>Chưa có mục nào đang chờ xử lý.</EmptyNote>
            ) : (
              <div className="grid gap-6">
                <div>
                  <h3 className="text-sm font-bold text-slate-500">Hộp thư gửi đi</h3>
                  <StatusRows rows={operations.emailByStatus} labels={EMAIL_STATUS_LABELS} emptyLabel="Hộp thư trống." />
                  <p className="mt-2 text-xs text-slate-500">
                    {operations.oldestPendingEmailAt
                      ? `Lần thử gửi cũ nhất còn chờ: ${dateTime.format(operations.oldestPendingEmailAt)}`
                      : "Không còn email nào đang chờ gửi."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Đăng ký giải đấu chờ xử lý</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{integer.format(operations.pendingTournamentRegistrations)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Đánh giá chờ kiểm duyệt</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{integer.format(operations.pendingProductReviews)}</p>
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Section title="Đơn cần chú ý" hint={`Đơn quá hạn giữ chỗ, đơn cần đối soát thanh toán và đơn COD thu tiền muộn. Mỗi danh sách hiển thị tối đa ${ATTENTION_LIMIT} đơn cũ nhất.`}>
            {attentionTotal === 0 ? (
              <EmptyNote>Không có đơn nào cần can thiệp thủ công.</EmptyNote>
            ) : (
              <div className="grid gap-6">
                <AttentionList
                  title="Quá hạn giữ chỗ"
                  bucket={attention.expiredReservations}
                  emptyLabel="Không có đơn chờ thanh toán nào quá hạn."
                />
                <AttentionList
                  title="Cần đối soát thanh toán"
                  bucket={attention.manualReview}
                  emptyLabel="Không có đơn nào cần đối soát."
                />
                <AttentionList
                  title={`COD chưa thu quá ${STALE_COD_DAYS} ngày`}
                  bucket={attention.staleCod}
                  emptyLabel="Không có đơn COD nào tồn đọng."
                />
              </div>
            )}
          </Section>

          <Section title="Sản phẩm bán chạy" hint="Top 5 theo số lượng bán trong 90 ngày qua, không tính đơn đã huỷ.">
            {overview.topProducts.length === 0 ? (
              <EmptyNote>Chưa có sản phẩm nào được bán trong 90 ngày qua.</EmptyNote>
            ) : (
              <ul className="divide-y divide-slate-100">
                {overview.topProducts.map((product) => (
                  <li key={product.title} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="font-semibold text-slate-900">{product.title}</span>
                    <span className="text-slate-500">{integer.format(product.unitsSold)} sản phẩm</span>
                    <span className="font-bold text-slate-900">{money.format(product.revenueVnd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Tồn kho thấp" hint="Biến thể có lượng khả dụng bằng hoặc dưới ngưỡng cảnh báo (mặc định 3 khi chưa đặt ngưỡng). Hiển thị tối đa 10 biến thể.">
            {overview.lowStock.length === 0 ? (
              <EmptyNote>Không có biến thể nào dưới ngưỡng cảnh báo.</EmptyNote>
            ) : (
              <ul className="divide-y divide-slate-100">
                {overview.lowStock.map((item) => (
                  <li key={item.variantId} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
                    <span className="font-mono text-xs text-slate-700">{item.sku}</span>
                    <span className="min-w-0 flex-1 text-slate-600">{item.productTitle}</span>
                    <span className="text-slate-500">
                      Khả dụng {integer.format(item.available)} / Tồn {integer.format(item.onHand)} (giữ {integer.format(item.reserved)})
                    </span>
                    <span className="font-bold text-slate-900">
                      Ngưỡng {item.reorderPoint === 0 ? "mặc định 3" : integer.format(item.reorderPoint)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}
