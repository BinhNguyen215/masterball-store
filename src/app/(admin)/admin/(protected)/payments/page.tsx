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
      <div className="mt-8 grid max-w-2xl gap-6">
        <MutationForm action={paymentAction} submitLabel="Yêu cầu đối soát">
          <input type="hidden" name="operation" value="reconcile" />
          <h2 className="text-lg font-bold">Đối soát giao dịch</h2>
          <Field label="Mã thanh toán"><input className={inputClassName} name="paymentId" required {...idInputProps} /></Field>
          <p className="text-xs text-slate-500">Kết quả chỉ được ghi sau khi dịch vụ thanh toán xác minh trạng thái từ nguồn tin cậy.</p>
        </MutationForm>
        <MutationForm action={paymentAction} submitLabel="Ghi nhận thu tiền COD">
          <input type="hidden" name="operation" value="settle-cod" />
          <h2 className="text-lg font-bold">Ghi nhận thu tiền mặt (COD)</h2>
          <Field label="Mã nội bộ của đơn"><input className={inputClassName} name="orderId" required {...idInputProps} /></Field>
          <Field label="Phiên bản hiện tại của đơn"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
          <Field label="Ghi chú của người thu tiền"><input className={inputClassName} name="note" required minLength={3} maxLength={240} /></Field>
          <p className="text-xs text-slate-500">Chỉ dùng cho đơn COD chưa hủy và chưa thanh toán. Thao tác được ghi vào lịch sử đơn hàng và nhật ký kèm tài khoản thực hiện.</p>
        </MutationForm>
        <MutationForm action={paymentAction} submitLabel="Xác nhận đã nhận chuyển khoản">
          <input type="hidden" name="operation" value="confirm-bank-transfer" />
          <h2 className="text-lg font-bold">Xác nhận chuyển khoản ngân hàng</h2>
          <Field label="Mã nội bộ của đơn"><input className={inputClassName} name="orderId" required {...idInputProps} /></Field>
          <Field label="Phiên bản hiện tại của đơn"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
          <Field label="Ghi chú đối chiếu (số bút toán, sao kê…)"><input className={inputClassName} name="note" required minLength={3} maxLength={240} /></Field>
          <p className="text-xs text-slate-500">Chỉ dùng cho đơn chuyển khoản chưa hủy và chưa thanh toán. Chỉ xác nhận sau khi tiền đã vào tài khoản nhận; thao tác sẽ xác nhận đơn và giữ hàng cho khách.</p>
        </MutationForm>
        <MutationForm action={paymentAction} submitLabel="Ghi nhận hoàn tiền">
          <input type="hidden" name="operation" value="refund" />
          <h2 className="text-lg font-bold">Hoàn tiền cho khách</h2>
          <Field label="Mã thanh toán"><input className={inputClassName} name="paymentId" required {...idInputProps} /></Field>
          <Field label="Số tiền hoàn (VND)"><input className={inputClassName} name="amountVnd" type="number" min={1} step={1} required /></Field>
          <Field label="Lý do hoàn tiền"><textarea className={inputClassName} name="reason" rows={3} minLength={3} maxLength={240} required /></Field>
          <Field label="Mã tham chiếu (không bắt buộc)"><input className={inputClassName} name="reference" maxLength={120} /></Field>
          <p className="text-xs text-slate-500">Hai khoản hoàn tiền cùng số tiền và cùng lý do được coi là một giao dịch lặp lại; hãy nhập mã tham chiếu khác nhau nếu đây là hai lần hoàn thật.</p>
          <p className="text-xs text-slate-500">Chỉ áp dụng cho giao dịch đã thanh toán. Số tiền vượt quá phần còn lại của giao dịch sẽ bị từ chối; gửi lại cùng số tiền và lý do sẽ không hoàn hai lần.</p>
        </MutationForm>
      </div>
    </>
  );
}
