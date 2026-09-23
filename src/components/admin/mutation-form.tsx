"use client";

import { useActionState, type ReactNode } from "react";

export type MutationState = { ok: boolean; message: string };

export function MutationForm({
  action,
  submitLabel,
  children,
}: {
  action: (state: MutationState, formData: FormData) => Promise<MutationState>;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: "" });

  return (
    <form action={formAction} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
      {state.message ? (
        <p role="status" className={state.ok ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"}>
          {state.message}
        </p>
      ) : null}
      <button disabled={pending} type="submit" className="justify-self-start rounded-xl bg-purple-700 px-5 py-2.5 font-bold text-white hover:bg-purple-800 disabled:cursor-wait disabled:opacity-60">
        {pending ? "Đang xử lý…" : submitLabel}
      </button>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-800">{label}{children}</label>;
}

export const inputClassName = "rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200";

/**
 * Every internal identifier in this console is a database UUID. The pattern only
 * gives immediate browser feedback; the server re-validates on submit.
 */
export const idInputProps = {
  maxLength: 36,
  pattern: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
  placeholder: "00000000-0000-0000-0000-000000000000",
} as const;
