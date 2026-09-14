import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminActor } from "@/modules/auth/guards";
import { hasCapability, type Capability } from "@/modules/auth/roles";
import { SignOutButton } from "./sign-out-button";

const NAVIGATION: { href: string; label: string; capability?: Capability }[] = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/products", label: "Sản phẩm", capability: "catalog.read" },
  { href: "/admin/inventory", label: "Tồn kho", capability: "inventory.read" },
  { href: "/admin/orders", label: "Đơn hàng", capability: "orders.read" },
  { href: "/admin/payments", label: "Thanh toán", capability: "payments.read" },
  { href: "/admin/tournaments", label: "Giải đấu", capability: "tournaments.read" },
  { href: "/admin/audit", label: "Nhật ký", capability: "audit.read" },
  { href: "/admin/settings", label: "Cấu hình", capability: "settings.read" },
];

export function AdminShell({ actor, children }: { actor: AdminActor; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="bg-[#07152d] px-5 py-6 text-white lg:min-h-screen">
        <div className="mb-8 flex items-center justify-between gap-4 lg:block">
          <Link href="/admin" className="text-xl font-black tracking-tight">
            MasterBall <span className="text-pink-400">Admin</span>
          </Link>
          <div className="lg:mt-5">
            <SignOutButton />
          </div>
        </div>
        <nav aria-label="Điều hướng quản trị" className="flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible">
          {NAVIGATION.filter((item) => !item.capability || hasCapability(actor.role, item.capability)).map((item) => (
            <Link key={item.href} href={item.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 hidden border-t border-white/10 pt-5 text-sm text-slate-300 lg:block">
          <p className="font-semibold text-white">{actor.name}</p>
          <p>{actor.role}</p>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-7 lg:p-10">{children}</main>
    </div>
  );
}
