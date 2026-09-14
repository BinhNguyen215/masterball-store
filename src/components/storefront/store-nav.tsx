"use client";

import { Menu, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/products", label: "Sản phẩm" },
  { href: "/tournaments", label: "Giải đấu" },
  { href: "/policies/shipping", label: "Chính sách" },
] as const;

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <ul className="nav-list">
      {navigation.map((item) => (
        <li key={item.href}>
          <Link
            aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
            className="nav-link"
            href={item.href}
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StoreNav() {
  const pathname = usePathname();
  const cartIsCurrent = isCurrentPath(pathname, "/cart");

  return (
    <>
      <nav aria-label="Điều hướng chính" className="desktop-nav">
        <NavLinks pathname={pathname} />
      </nav>
      <div className="mobile-actions">
        <Link
          aria-current={cartIsCurrent ? "page" : undefined}
          aria-label="Mở giỏ hàng"
          className="cart-link"
          href="/cart"
        >
          <ShoppingBag aria-hidden="true" size={20} strokeWidth={1.8} />
        </Link>
        <details className="mobile-nav">
          <summary aria-label="Mở trình đơn">
            <Menu aria-hidden="true" size={22} strokeWidth={1.8} />
          </summary>
          <nav aria-label="Điều hướng trên thiết bị di động" className="mobile-menu">
            <NavLinks pathname={pathname} />
          </nav>
        </details>
      </div>
    </>
  );
}
