import { PackageOpen } from "lucide-react";

import { EmptyState } from "@/components/storefront/empty-state";
import { ProductCard } from "@/components/storefront/product-card";
import type { ProductViewModel } from "@/components/storefront/storefront-types";

type ProductGridProps = {
  emptyDescription?: string;
  products: ProductViewModel[];
};

export function ProductGrid({
  emptyDescription = "Catalog chưa có sản phẩm đã xuất bản phù hợp. Hãy quay lại sau khi cửa hàng cập nhật dữ liệu thật.",
  products,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <EmptyState
        description={emptyDescription}
        icon={PackageOpen}
        title="Chưa có sản phẩm"
      />
    );
  }

  return (
    <ul className="product-grid">
      {products.map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
