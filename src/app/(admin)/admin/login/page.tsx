import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { getAdminActor } from "@/modules/auth/guards";

export default async function AdminLoginPage() {
  if (await getAdminActor()) {
    redirect("/admin");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#07152d] px-4 py-12">
      <section className="w-full max-w-md rounded-3xl bg-slate-50 p-7 shadow-2xl sm:p-9">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600">MasterBall Store</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Khu vực quản trị</h1>
        <p className="mb-7 mt-2 text-sm leading-6 text-slate-600">Đăng nhập bằng tài khoản nhân viên đã được chủ cửa hàng cấp.</p>
        <LoginForm />
      </section>
    </main>
  );
}
