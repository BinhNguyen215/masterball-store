import { CatalogImportForm } from "@/components/admin/catalog-import-form";
import { CatalogManagementForms } from "@/components/admin/catalog-management-forms";
import { PageHeading } from "@/components/admin/page-heading";
import { MediaManager } from "@/components/admin/media-manager";
import { ResourcePanel, type AdminSearchParams } from "@/components/admin/resource-panel";
import { SearchFilterBar } from "@/components/admin/search-filter-bar";
import { requireAdminPage } from "@/modules/auth/guards";
import { hasCapability } from "@/modules/auth/roles";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const actor = await requireAdminPage("catalog.read");
  const query = await searchParams;
  return (
    <>
      <PageHeading title="Sản phẩm" description="Tạo bản nháp, tìm kiếm và thay đổi trạng thái sản phẩm bằng thao tác lưu rõ ràng." />
      <SearchFilterBar placeholder="Tên, slug hoặc SKU" searchParams={query} statusOptions={[{ value: "DRAFT", label: "Bản nháp" }, { value: "ACTIVE", label: "Đang bán" }, { value: "ARCHIVED", label: "Lưu trữ" }]} />
      <ResourcePanel resource="products" searchParams={query} label="danh sách sản phẩm" emptyMessage="Tạo bản nháp đầu tiên bằng biểu mẫu bên dưới." />
      <div className="mt-7">
        <h2 className="mb-3 text-xl font-black">Mã tham chiếu catalog</h2>
        <ResourcePanel resource="catalog-references" searchParams={query} label="mã tham chiếu catalog" emptyMessage="Tạo game, set hoặc tag bằng biểu mẫu bên dưới." />
      </div>
      {hasCapability(actor.role, "catalog.write") ? <CatalogManagementForms /> : null}
      {hasCapability(actor.role, "catalog.import") ? (
        <div className="grid gap-4">
          <a className="w-fit rounded-xl border border-purple-300 px-4 py-2.5 font-bold text-purple-800 hover:bg-purple-50" href="/api/admin/exports/products">
            Tải CSV catalog và tồn kho
          </a>
          <CatalogImportForm />
        </div>
      ) : null}
      {hasCapability(actor.role, "catalog.write") ? <MediaManager /> : null}
    </>
  );
}
