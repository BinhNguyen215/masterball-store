import { PageHeading } from "@/components/admin/page-heading";
import { ResourcePanel, type AdminSearchParams } from "@/components/admin/resource-panel";
import { SearchFilterBar } from "@/components/admin/search-filter-bar";
import { requireAdminPage } from "@/modules/auth/guards";

export default async function AuditPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("audit.read");
  const query = await searchParams;
  return (
    <>
      <PageHeading title="Nhật ký kiểm toán" description="Lịch sử chỉ đọc cho các thay đổi nhạy cảm. Nội dung không hiển thị secret hoặc dữ liệu thanh toán thô." />
      <SearchFilterBar placeholder="Actor hoặc mã đối tượng" searchParams={query} statusOptions={[{ value: "product", label: "Sản phẩm" }, { value: "product-variant", label: "Biến thể" }, { value: "game", label: "Game" }, { value: "product-set", label: "Set" }, { value: "tag", label: "Tag" }, { value: "catalog-import", label: "Nhập catalog" }, { value: "media-asset", label: "Hình ảnh" }, { value: "inventory", label: "Tồn kho" }, { value: "order", label: "Đơn hàng" }, { value: "payment", label: "Thanh toán" }, { value: "tournament", label: "Giải đấu" }]} />
      <ResourcePanel resource="audit" searchParams={query} label="nhật ký kiểm toán" emptyMessage="Chưa có sự kiện kiểm toán phù hợp." />
    </>
  );
}
