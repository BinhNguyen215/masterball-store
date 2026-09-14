import { MutationForm, Field, inputClassName } from "@/components/admin/mutation-form";
import { PageHeading } from "@/components/admin/page-heading";
import { ResourcePanel, type AdminSearchParams } from "@/components/admin/resource-panel";
import { SearchFilterBar } from "@/components/admin/search-filter-bar";
import { requireAdminPage } from "@/modules/auth/guards";
import { hasCapability } from "@/modules/auth/roles";
import { inventoryAction } from "../../actions";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const actor = await requireAdminPage("inventory.read");
  const query = await searchParams;
  return (
    <>
      <PageHeading title="Tồn kho" description="Theo dõi on-hand, reserved và available. Mọi điều chỉnh đi qua sổ cái tồn kho của dịch vụ miền." />
      <SearchFilterBar placeholder="SKU hoặc tên sản phẩm" statusOptions={[{ value: "LOW", label: "Sắp hết" }, { value: "OUT", label: "Hết hàng" }, { value: "AVAILABLE", label: "Còn hàng" }]} />
      <ResourcePanel resource="inventory" searchParams={query} label="tồn kho" emptyMessage="Không có biến thể phù hợp với bộ lọc." />
      {hasCapability(actor.role, "inventory.adjust") ? <div className="mt-7 max-w-2xl">
        <MutationForm action={inventoryAction} submitLabel="Ghi điều chỉnh">
          <h2 className="text-lg font-black">Điều chỉnh có kiểm soát</h2>
          <Field label="Mã biến thể"><input className={inputClassName} name="variantId" required maxLength={128} /></Field>
          <Field label="Chênh lệch (+/−)"><input className={inputClassName} name="delta" type="number" min={-100000} max={100000} step={1} required /></Field>
          <Field label="Lý do"><textarea className={inputClassName} name="reason" minLength={3} maxLength={240} rows={3} required /></Field>
          <p className="text-xs text-slate-500">Biểu mẫu không ghi SQL trực tiếp và không thể làm available âm.</p>
        </MutationForm>
      </div> : null}
    </>
  );
}
