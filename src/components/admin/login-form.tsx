"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/modules/auth/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    const result = await authClient.signIn.email({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
      rememberMe: data.get("rememberMe") === "on",
      callbackURL: "/admin",
    });

    if (result.error) {
      setError("Email hoặc mật khẩu không đúng.");
      setPending(false);
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5" aria-describedby={error ? "login-error" : undefined}>
      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        Email quản trị
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-800">
        Mật khẩu
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={14}
          maxLength={128}
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input name="rememberMe" type="checkbox" className="size-4 rounded border-slate-300" />
        Duy trì đăng nhập trên thiết bị này
      </label>
      {error ? (
        <p id="login-error" role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-purple-700 px-5 py-3 font-bold text-white transition hover:bg-purple-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Đang xác thực…" : "Đăng nhập"}
      </button>
    </form>
  );
}
