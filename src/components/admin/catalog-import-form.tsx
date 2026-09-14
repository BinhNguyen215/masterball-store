"use client";

import { useState, type FormEvent } from "react";

export function CatalogImportForm() {
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Array<{ rowNumber: number; field?: string; message: string }>>([]);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("csv");
    if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) {
      setMessage("Chọn tệp CSV không rỗng và không quá 2 MB.");
      setErrors([]);
      return;
    }
    setPending(true);
    setMessage("");
    setErrors([]);
    const dryRun = data.get("dryRun") === "on";
    const response = await fetch(`/api/admin/imports/products?dryRun=${dryRun}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "text/csv" },
      body: file,
    });
    setPending(false);
    const payload = await response.json().catch(() => null) as {
      result?: {
        valid?: boolean;
        rows?: unknown[];
        errors?: Array<{ rowNumber: number; field?: string; message: string }>;
      };
    } | null;
    const rowErrors = payload?.result?.errors ?? [];
    setErrors(rowErrors);
    if (!response.ok || payload?.result?.valid !== true) {
      setMessage(
        rowErrors.length
          ? `CSV có ${rowErrors.length} lỗi. Không có dữ liệu nào được ghi.`
          : "Không thể xử lý CSV. Không có import nào được giả định là thành công.",
      );
      return;
    }
    setMessage(
      dryRun
        ? `Dry-run hợp lệ cho ${payload.result.rows?.length ?? 0} dòng. Bỏ chọn dry-run chỉ sau khi đã rà soát.`
        : "Import đã hoàn tất trong một giao dịch.",
    );
  }

  return (
    <form onSubmit={submit} className="mt-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="text-lg font-black">Import catalog CSV</h2><p className="mt-1 text-sm text-slate-500">Luôn chạy dry-run và rà soát lỗi theo dòng trước khi bỏ chọn tùy chọn này.</p></div>
      <input name="csv" type="file" accept=".csv,text/csv" required className="block w-full rounded-xl border border-slate-300 p-3 text-sm" />
      <label className="flex items-center gap-2 text-sm font-semibold"><input name="dryRun" type="checkbox" defaultChecked className="size-4" /> Chỉ kiểm tra, chưa ghi dữ liệu</label>
      {message ? <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      {errors.length ? (
        <div role="alert" className="max-h-72 overflow-auto rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-bold">Chi tiết lỗi theo dòng</p>
          <ul className="mt-2 grid gap-1">
            {errors.slice(0, 100).map((error, index) => (
              <li key={`${error.rowNumber}:${error.field ?? "row"}:${index}`}>
                Dòng {error.rowNumber}{error.field ? `, cột ${error.field}` : ""}: {error.message}
              </li>
            ))}
          </ul>
          {errors.length > 100 ? <p className="mt-2">Còn {errors.length - 100} lỗi khác. Hãy sửa các lỗi đầu rồi chạy lại dry-run.</p> : null}
        </div>
      ) : null}
      <button disabled={pending} type="submit" className="justify-self-start rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Đang kiểm tra…" : "Xử lý CSV"}</button>
    </form>
  );
}
