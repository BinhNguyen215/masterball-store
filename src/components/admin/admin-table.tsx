import type { AdminList } from "@/modules/auth/admin-application";

export function AdminTable({ data, emptyMessage }: { data: AdminList; emptyMessage: string }) {
  if (data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="font-bold text-slate-800">Chưa có dữ liệu</p>
        <p className="mt-1 text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {data.columns.map((column) => <th key={column.key} scope="col" className="px-5 py-4 font-bold">{column.label}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/70">
              {data.columns.map((column) => <td key={column.key} className="px-5 py-4 text-slate-700">{item.cells[column.key] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
