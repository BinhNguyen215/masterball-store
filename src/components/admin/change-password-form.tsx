"use client";

import { useState, type FormEvent } from "react";
import { authClient } from "@/modules/auth/auth-client";
import { inputClassName } from "./mutation-form";

export function ChangePasswordForm() {
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmation = String(data.get("confirmation") ?? "");
    if (newPassword !== confirmation) {
      setState({ ok: false, message: "Mật khẩu xác nhận không khớp." });
      return;
    }

    setPending(true);
    setState(null);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (result.error) {
      setState({ ok: false, message: "Không thể đổi mật khẩu. Hãy kiểm tra mật khẩu hiện tại." });
      return;
    }
    form.reset();
    setState({ ok: true, message: "Đã đổi mật khẩu và thu hồi các phiên khác." });
  }

  return (
    <form onSubmit={submit} className="mt-7 grid max-w-2xl gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black">Đổi mật khẩu</h2>
      <label className="grid gap-1.5 text-sm font-semibold">Mật khẩu hiện tại<input className={inputClassName} name="currentPassword" type="password" autoComplete="current-password" required minLength={14} maxLength={128} /></label>
      <label className="grid gap-1.5 text-sm font-semibold">Mật khẩu mới<input className={inputClassName} name="newPassword" type="password" autoComplete="new-password" required minLength={14} maxLength={128} /></label>
      <label className="grid gap-1.5 text-sm font-semibold">Nhập lại mật khẩu mới<input className={inputClassName} name="confirmation" type="password" autoComplete="new-password" required minLength={14} maxLength={128} /></label>
      {state ? <p role="status" className={state.ok ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"}>{state.message}</p> : null}
      <button type="submit" disabled={pending} className="justify-self-start rounded-xl bg-purple-700 px-5 py-2.5 font-bold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Đang đổi…" : "Đổi mật khẩu"}</button>
    </form>
  );
}
