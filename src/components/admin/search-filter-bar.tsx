import type { AdminSearchParams } from "./resource-panel";

function firstValue(value: string | string[] | undefined): string {
  const first = Array.isArray(value) ? value[0] : value;
  return first ?? "";
}

export function SearchFilterBar({
  statusOptions,
  placeholder = "Tìm kiếm…",
  searchParams,
}: {
  statusOptions: { value: string; label: string }[];
  placeholder?: string;
  searchParams?: AdminSearchParams;
}) {
  const query = firstValue(searchParams?.q);
  const status = firstValue(searchParams?.status);

  return (
    <form method="get" className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_13rem_auto]">
      <label className="sr-only" htmlFor="admin-search">Tìm kiếm</label>
      <input defaultValue={query} id="admin-search" name="q" type="search" maxLength={120} placeholder={placeholder} className="rounded-xl border border-slate-300 px-4 py-2.5 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200" />
      <label className="sr-only" htmlFor="admin-status">Trạng thái</label>
      <select defaultValue={status} id="admin-status" name="status" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200">
        <option value="">Tất cả trạng thái</option>
        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <button type="submit" className="rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white hover:bg-slate-800">Lọc</button>
    </form>
  );
}
