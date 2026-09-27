"use client";

import { ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { StorefrontCopy } from "@/i18n";

const DISMISS_AFTER_MS = 5_000;

/**
 * Transient confirmation for a completed cart action. The server decides whether
 * to show it (the action redirects with a query flag), so there is no client
 * state to hydrate; the component only owns the countdown and the dismissal, and
 * it strips the flag from the URL so a refresh does not replay the notice.
 */
export function CartToast({
  copy,
  message,
  show,
}: {
  copy: StorefrontCopy["chrome"];
  message: string;
  show: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      setDismissed(true);
      router.replace(pathname, { scroll: false });
    }, DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [pathname, router, show]);

  if (!show || dismissed) return null;

  return (
    <div className="cart-toast" role="status">
      <ShoppingBag aria-hidden="true" size={18} strokeWidth={1.8} />
      <p>{message}</p>
      <Link className="cart-toast-link" href="/cart">
        {copy.actions.viewCart}
      </Link>
      <button
        aria-label={copy.cartToast.dismiss}
        className="cart-toast-dismiss"
        onClick={() => {
          setDismissed(true);
          router.replace(pathname, { scroll: false });
        }}
        type="button"
      >
        <X aria-hidden="true" size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
