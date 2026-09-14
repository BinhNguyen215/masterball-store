import Link from "next/link";

import { AdminTable } from "./admin-table";
import { IntegrationError } from "./integration-state";
import {
  adminApplication,
  IntegrationUnavailableError,
  type AdminResource,
} from "@/modules/auth/admin-application";

export type AdminSearchParams = Record<string, string | string[] | undefined>;

export function toUrlSearchParams(input: AdminSearchParams): URLSearchParams {
  const output = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) output.append(key, item);
    } else if (value !== undefined) {
      output.set(key, value);
    }
  }
  return output;
}

export async function ResourcePanel({
  resource,
  searchParams,
  label,
  emptyMessage,
}: {
  resource: AdminResource;
  searchParams: AdminSearchParams;
  label: string;
  emptyMessage: string;
}) {
  let data;
  try {
    data = await adminApplication.list(resource, toUrlSearchParams(searchParams));
  } catch (error) {
    if (error instanceof IntegrationUnavailableError) {
      return <IntegrationError label={label} />;
    }
    throw error;
  }
  const rawPage = Array.isArray(searchParams.page)
    ? searchParams.page[0]
    : searchParams.page;
  const page = Math.max(1, Number(rawPage) || 1);
  const pageSize = 50;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const href = (targetPage: number) => {
    const query = toUrlSearchParams(searchParams);
    query.set("page", String(targetPage));
    return `?${query.toString()}`;
  };

  return (
    <div className="grid gap-4">
      <AdminTable data={data} emptyMessage={emptyMessage} />
      {data.total > pageSize ? (
        <nav className="flex items-center justify-between gap-4" aria-label={`Phân trang ${label}`}>
          {page > 1 ? (
            <Link className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700" href={href(page - 1)}>
              Trang trước
            </Link>
          ) : <span />}
          <span className="text-sm text-slate-600">Trang {Math.min(page, totalPages)} / {totalPages}</span>
          {page < totalPages ? (
            <Link className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700" href={href(page + 1)}>
              Trang sau
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}
