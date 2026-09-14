import Link from "next/link";
import { PageHeading } from "@/components/admin/page-heading";
import { requireAdminPage } from "@/modules/auth/guards";
import { ROLE_CAPABILITIES } from "@/modules/auth/roles";

const cards = [
  ["Sản phẩm", "/admin/products", "catalog.read"],
  ["Tồn kho", "/admin/inventory", "inventory.read"],
  ["Đơn hàng", "/admin/orders", "orders.read"],
  ["Thanh toán", "/admin/payments", "payments.read"],
  ["Giải đấu", "/admin/tournaments", "tournaments.read"],
] as const;

export default async function AdminDashboardPage() {
  const actor = await requireAdminPage();
  return (
    <>
      <PageHeading title="Tổng quan vận hành" description="Các khu vực hiển thị theo quyền đã được cấp cho tài khoản hiện tại." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.filter((card) => ROLE_CAPABILITIES[actor.role].has(card[2])).map(([label, href]) => (
          <Link key={href} href={href} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:shadow-md">
            <span className="text-lg font-black text-slate-900">{label}</span>
            <span className="mt-5 block text-sm font-bold text-purple-700 group-hover:text-purple-900">Mở khu vực →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
