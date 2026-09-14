import { MutationForm, Field, inputClassName } from "@/components/admin/mutation-form";
import { PageHeading } from "@/components/admin/page-heading";
import { ResourcePanel, type AdminSearchParams } from "@/components/admin/resource-panel";
import { SearchFilterBar } from "@/components/admin/search-filter-bar";
import { requireAdminPage } from "@/modules/auth/guards";
import { orderAction } from "../../actions";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("orders.read");
  const query = await searchParams;
  return (
    <>
      <PageHeading title="Đơn hàng" description="Tìm đơn theo mã và thực hiện duy nhất các chuyển trạng thái được miền đơn hàng cho phép." />
      <SearchFilterBar placeholder="Mã đơn hàng" statusOptions={[{ value: "PENDING_PAYMENT", label: "Chờ thanh toán" }, { value: "CONFIRMED", label: "Đã xác nhận" }, { value: "PACKING", label: "Đang đóng gói" }, { value: "SHIPPED", label: "Đã gửi" }, { value: "MANUAL_REVIEW", label: "Cần đối soát" }, { value: "CANCELLED", label: "Đã hủy" }]} />
      <ResourcePanel resource="orders" searchParams={query} label="đơn hàng" emptyMessage="Không có đơn phù hợp với bộ lọc." />
      <div className="mt-7 max-w-2xl">
        <MutationForm action={orderAction} submitLabel="Cập nhật đơn">
          <h2 className="text-lg font-black">Chuyển trạng thái an toàn</h2>
          <Field label="Mã nội bộ của đơn"><input className={inputClassName} name="orderId" required maxLength={128} /></Field>
          <Field label="Trạng thái đích"><select className={inputClassName} name="targetStatus"><option value="CONFIRMED">Đã xác nhận</option><option value="PROCESSING">Đang xử lý</option><option value="SHIPPED">Đã gửi</option><option value="DELIVERED">Đã giao</option><option value="CANCELLED">Hủy đơn</option></select></Field>
          <Field label="Phiên bản hiện tại"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
          <Field label="Mã vận đơn (bắt buộc khi gửi)"><input className={inputClassName} name="trackingCode" maxLength={120} /></Field>
          <Field label="Ghi chú nội bộ"><textarea className={inputClassName} name="note" rows={3} maxLength={500} /></Field>
          <p className="text-xs text-slate-500">Không có lựa chọn “đã thanh toán”: thanh toán chỉ được xác nhận từ IPN đã kiểm chứng hoặc quy trình đối soát miền.</p>
        </MutationForm>
      </div>
    </>
  );
}
