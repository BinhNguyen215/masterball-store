import { SearchX } from "lucide-react";

import { ButtonLink } from "@/components/storefront/button-link";

export default function StoreNotFound() {
  return (
    <div className="section-inner">
      <section className="state-screen">
        <span aria-hidden="true" className="state-icon">
          <SearchX size={24} strokeWidth={1.8} />
        </span>
        <h1>Không tìm thấy trang</h1>
        <p>
          Địa chỉ có thể đã thay đổi hoặc nội dung chưa được xuất bản. Hãy quay
          về catalog để tiếp tục.
        </p>
        <ButtonLink href="/products">Về catalog</ButtonLink>
      </section>
    </div>
  );
}
