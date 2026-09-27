import { MutationForm, Field, idInputProps, inputClassName } from "@/components/admin/mutation-form";
import { PageHeading } from "@/components/admin/page-heading";
import { ResourcePanel, type AdminSearchParams } from "@/components/admin/resource-panel";
import { SearchFilterBar } from "@/components/admin/search-filter-bar";
import { requireAdminPage } from "@/modules/auth/guards";
import { paymentAction } from "../../actions";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("payments.read");
  const query = await searchParams;
  return (
    <>
      <PageHeading title="Thanh toán" description="Xem sự kiện thanh toán và yêu cầu đối soát. Thanh toán online chỉ được xác nhận từ nhà cung cấp; tiền mặt COD do nhân viên ghi nhận tại đây." />
      <SearchFilterBar placeholder="Mã giao dịch hoặc mã đơn" searchParams={query} statusOptions={[{ value: "PENDING", label: "Đang chờ" }, { value: "PAID", label: "Đã thanh toán" }, { value: "FAILED", label: "Thất bại" }, { value: "MANUAL_REVIEW", label: "Cần đối soát" }]} />
      <ResourcePanel resource="payments" searchParams={query} label="thanh toán" emptyMessage="Không có giao dịch phù hợp với bộ lọc." />
      <div className="mt-7 grid max-w-2xl gap-6">
        <MutationForm action={paymentAction} submitLabel="Yêu cầu đối soát">
          <input type="hidden" name="operation" value="reconcile" />
          <h2 className="text-lg font-black">Đối soát giao dịch</h2>
          <Field label="Mã thanh toán"><input className={inputClassName} name="paymentId" required {...idInputProps} /></Field>
          <p className="text-xs text-slate-500">Kết quả chỉ được ghi sau khi dịch vụ thanh toán xác minh trạng thái từ nguồn tin cậy.</p>
        </MutationForm>
        <MutationForm action={paymentAction} submitLabel="Ghi nhận thu tiền COD">
          <input type="hidden" name="operation" value="settle-cod" />
          <h2 className="text-lg font-black">Ghi nhận thu tiền mặt (COD)</h2>
          <Field label="Mã nội bộ của đơn"><input className={inputClassName} name="orderId" required {...idInputProps} /></Field>
          <Field label="Phiên bản hiện tại của đơn"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
          <Field label="Ghi chú của người thu tiền"><input className={inputClassName} name="note" required minLength={3} maxLength={240} /></Field>
          <p className="text-xs text-slate-500">Chỉ dùng cho đơn COD chưa hủy và chưa thanh toán. Thao tác được ghi vào lịch sử đơn hàng và nhật ký kèm tài khoản thực hiện.</p>
        </MutationForm>
      </div>
    </>
  );
}
