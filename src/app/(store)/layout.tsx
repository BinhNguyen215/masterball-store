import type { ReactNode } from "react";

import { StoreFooter } from "@/components/storefront/store-footer";
import { StoreHeader } from "@/components/storefront/store-header";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Chuyển đến nội dung chính
      </a>
      <StoreHeader />
      <main className="store-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <StoreFooter />
    </div>
  );
}
