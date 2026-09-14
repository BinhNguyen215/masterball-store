import Link from "next/link";

import { BrandMark } from "@/components/storefront/brand-mark";

const shopLinks = [
  { href: "/products", label: "Sản phẩm" },
  { href: "/tournaments", label: "Giải đấu" },
  { href: "/cart", label: "Giỏ hàng" },
] as const;

const policyLinks = [
  { href: "/policies/shipping", label: "Giao hàng" },
  { href: "/policies/returns", label: "Đổi trả" },
  { href: "/policies/privacy", label: "Quyền riêng tư" },
  { href: "/policies/terms", label: "Điều khoản" },
] as const;

export function StoreFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-intro">
            <BrandMark />
            <p>
              Không gian TCG dành cho người chơi, người sưu tầm và những buổi
              gặp gỡ quanh bàn đấu.
            </p>
          </div>
          <nav aria-label="Điều hướng cuối trang" className="footer-nav">
            <div>
              <h2>Cửa hàng</h2>
              <ul>
                {shopLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Thông tin</h2>
              <ul>
                {policyLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MasterBall Store</span>
          <span>Thiết kế riêng cho cộng đồng TCG Việt Nam</span>
        </div>
      </div>
    </footer>
  );
}
