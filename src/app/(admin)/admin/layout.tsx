import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  // The console ships Vietnamese copy only, so it must not inherit the
  // storefront locale the customer selected.
  return (
    <div className="min-h-screen bg-slate-100" lang="vi">
      {children}
    </div>
  );
}
