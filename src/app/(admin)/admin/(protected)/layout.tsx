import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/modules/auth/guards";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireAdminPage();
  return <AdminShell actor={actor}>{children}</AdminShell>;
}
