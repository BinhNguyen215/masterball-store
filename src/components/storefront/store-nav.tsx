"use client";

import { Menu, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { StorefrontCopy, StorefrontLocale } from "@/i18n";

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  copy,
  pathname,
}: {
  copy: StorefrontCopy["chrome"];
  pathname: string;
}) {
  const navigation = [
    { href: "/products", label: copy.nav.products },
    { href: "/tournaments", label: copy.nav.tournaments },
    { href: "/policies/shipping", label: copy.nav.policies },
  ];

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

export function StoreNav({
  copy,
  locale,
  switcher,
}: {
  copy: StorefrontCopy["chrome"];
  locale: StorefrontLocale;
  switcher: ReactNode;
}) {
  const pathname = usePathname();
  const cartIsCurrent = isCurrentPath(pathname, "/cart");

  return (
    <>
      <nav aria-label={copy.nav.aria} className="desktop-nav">
        <NavLinks copy={copy} pathname={pathname} />
      </nav>
      <div className="mobile-actions" data-locale={locale}>
        {switcher}
        <Link
          aria-current={cartIsCurrent ? "page" : undefined}
          aria-label={copy.nav.openCart}
          className="cart-link"
          href="/cart"
        >
          <ShoppingBag aria-hidden="true" size={20} strokeWidth={1.8} />
        </Link>
        <details className="mobile-nav">
          <summary aria-label={copy.nav.openMenu}>
            <Menu aria-hidden="true" size={22} strokeWidth={1.8} />
          </summary>
          <nav aria-label={copy.nav.mobileAria} className="mobile-menu">
            <NavLinks copy={copy} pathname={pathname} />
          </nav>
        </details>
      </div>
    </>
  );
}
