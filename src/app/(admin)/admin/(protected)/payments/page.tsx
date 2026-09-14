import { MutationForm, Field, inputClassName } from "@/components/admin/mutation-form";
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
      <PageHeading title="Thanh toán" description="Xem sự kiện thanh toán và yêu cầu đối soát; giao diện không thể tự đánh dấu một đơn là đã thanh toán." />
      <SearchFilterBar placeholder="Mã giao dịch hoặc mã đơn" statusOptions={[{ value: "PENDING", label: "Đang chờ" }, { value: "PAID", label: "Đã thanh toán" }, { value: "FAILED", label: "Thất bại" }, { value: "MANUAL_REVIEW", label: "Cần đối soát" }]} />
      <ResourcePanel resource="payments" searchParams={query} label="thanh toán" emptyMessage="Không có giao dịch phù hợp với bộ lọc." />
      <div className="mt-7 max-w-2xl">
        <MutationForm action={paymentAction} submitLabel="Yêu cầu đối soát">
          <input type="hidden" name="operation" value="reconcile" />
          <h2 className="text-lg font-black">Đối soát giao dịch</h2>
          <Field label="Mã thanh toán"><input className={inputClassName} name="paymentId" required maxLength={128} /></Field>
          <p className="text-xs text-slate-500">Kết quả chỉ được ghi sau khi dịch vụ thanh toán xác minh trạng thái từ nguồn tin cậy.</p>
        </MutationForm>
      </div>
    </>
  );
}
