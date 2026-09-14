import { BrandMark } from "@/components/storefront/brand-mark";
import { StoreNav } from "@/components/storefront/store-nav";

export function StoreHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <BrandMark />
        <StoreNav />
      </div>
    </header>
  );
}
