import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-slate-100">{children}</div>;
}
