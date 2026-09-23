import Link from "next/link";

import { BrandMark } from "@/components/storefront/brand-mark";
import type { StorefrontCopy } from "@/i18n";

import { StoreContact } from "./store-contact";

export function StoreFooter({ copy }: { copy: StorefrontCopy["chrome"] }) {
  const shopLinks = [
    { href: "/products", label: copy.nav.products },
    { href: "/tournaments", label: copy.nav.tournaments },
    { href: "/orders", label: copy.footer.orderLookup },
    { href: "/cart", label: copy.footer.cart },
  ];
  const policyLinks = [
    { href: "/policies/shipping", label: copy.footer.shipping },
    { href: "/policies/returns", label: copy.footer.returns },
    { href: "/policies/privacy", label: copy.footer.privacy },
    { href: "/policies/terms", label: copy.footer.terms },
  ];

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-intro">
            <BrandMark />
            <p>{copy.footer.brandLine}</p>
          </div>
          <nav aria-label={copy.footer.navAria} className="footer-nav">
            <div>
              <h2>{copy.footer.shopHeading}</h2>
              <ul>
                {shopLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>{copy.footer.infoHeading}</h2>
              <ul>
                {policyLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
          <StoreContact copy={copy} />
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MasterBall Store</span>
          <span>{copy.footer.designedIn}</span>
        </div>
      </div>
    </footer>
  );
}
