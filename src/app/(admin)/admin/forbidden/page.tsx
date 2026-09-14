import Link from "next/link";
import { requireAdminPage } from "@/modules/auth/guards";

export default async function ForbiddenPage() {
  await requireAdminPage();
  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <section className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black uppercase tracking-widest text-pink-600">403</p>
        <h1 className="mt-2 text-3xl font-black">Không đủ quyền truy cập</h1>
        <p className="mt-3 text-slate-600">Tài khoản của bạn không có capability cần thiết cho khu vực này.</p>
        <Link href="/admin" className="mt-6 inline-block rounded-xl bg-purple-700 px-5 py-3 font-bold text-white">Về tổng quan</Link>
      </section>
    </main>
  );
}
