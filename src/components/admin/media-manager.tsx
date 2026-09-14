"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";

type MediaAssetView = {
  id: string;
  productId: string;
  variantId: string | null;
  publicUrl: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
};

function errorMessage(status: number, operation: string): string {
  if (status === 401) return "Phiên đăng nhập đã hết hạn.";
  if (status === 403) return "Bạn không có quyền quản lý ảnh.";
  if (status === 413) return "Ảnh vượt quá giới hạn 10 MB.";
  if (status === 404) return "Không tìm thấy sản phẩm, biến thể hoặc ảnh.";
  if (status === 409) return "Sản phẩm/ảnh đã thay đổi và không thể cập nhật.";
  if (status === 502) return "Lưu trữ đối tượng chưa hoàn tất; cần thử lại hoặc kiểm tra cleanup.";
  return `Không thể ${operation}. Không có thành công nào được giả định.`;
}

function MediaRow({
  asset,
  refresh,
  report,
}: {
  asset: MediaAssetView;
  refresh: () => Promise<void>;
  report: (message: string) => void;
}) {
  const [altText, setAltText] = useState(asset.altText);
  const [sortOrder, setSortOrder] = useState(asset.sortOrder);
  const [pending, setPending] = useState(false);

  async function update() {
    setPending(true);
    const response = await fetch(`/api/admin/media/${asset.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ altText, sortOrder }),
    });
    setPending(false);
    if (!response.ok) {
      report(errorMessage(response.status, "cập nhật ảnh"));
      return;
    }
    report("Đã cập nhật alt text và thứ tự ảnh.");
    await refresh();
  }

  async function remove() {
    if (!window.confirm("Xóa ảnh này khỏi sản phẩm? Thao tác không thể hoàn tác.")) return;
    setPending(true);
    const response = await fetch(`/api/admin/media/${asset.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    setPending(false);
    if (!response.ok) {
      report(errorMessage(response.status, "xóa ảnh"));
      return;
    }
    report("Đã xóa ảnh và sắp xếp lại gallery.");
    await refresh();
  }

  return (
    <article className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-[9rem_1fr]">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
        <Image
          unoptimized
          fill
          sizes="144px"
          src={asset.publicUrl}
          alt={asset.altText}
          className="object-contain"
        />
      </div>
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {asset.isPrimary ? (
            <span className="rounded-full bg-purple-100 px-2.5 py-1 font-bold text-purple-800">
              Ảnh chính · thứ tự 0
            </span>
          ) : null}
          <span>{asset.mimeType}</span>
          <span>{asset.width} × {asset.height}px</span>
          <span>{Math.ceil(asset.byteSize / 1024)} KB</span>
          {asset.variantId ? <span>Variant: {asset.variantId}</span> : null}
        </div>
        <label className="grid gap-1 text-sm font-semibold text-slate-800">
          Alt text
          <input
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            required
            maxLength={500}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
        </label>
        <label className="grid max-w-40 gap-1 text-sm font-semibold text-slate-800">
          Thứ tự
          <input
            value={sortOrder}
            onChange={(event) => setSortOrder(Number(event.target.value))}
            type="number"
            min={0}
            step={1}
            className="rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || !altText.trim()}
            onClick={update}
            className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Lưu ảnh
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={remove}
            className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
          >
            Xóa ảnh
          </button>
        </div>
      </div>
    </article>
  );
}

export function MediaManager() {
  const [productId, setProductId] = useState("");
  const [assets, setAssets] = useState<MediaAssetView[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    if (!productId.trim()) {
      setMessage("Nhập mã sản phẩm trước khi tải gallery.");
      return;
    }
    setPending(true);
    const response = await fetch(
      `/api/admin/media?productId=${encodeURIComponent(productId.trim())}`,
      { credentials: "same-origin", cache: "no-store" },
    );
    setPending(false);
    if (!response.ok) {
      setAssets([]);
      setMessage(errorMessage(response.status, "tải gallery"));
      return;
    }
    const result = (await response.json()) as { items: MediaAssetView[] };
    setAssets(result.items);
    setMessage(result.items.length ? "Đã tải gallery." : "Sản phẩm chưa có ảnh.");
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setMessage("Chọn ảnh raster không rỗng và không quá 10 MB.");
      return;
    }
    setPending(true);
    setMessage("");
    const response = await fetch("/api/admin/media", {
      method: "POST",
      credentials: "same-origin",
      body: data,
    });
    setPending(false);
    if (!response.ok) {
      setMessage(errorMessage(response.status, "tải ảnh lên"));
      return;
    }
    form.reset();
    setMessage("Đã tải ảnh và lưu bản ghi media.");
    await refresh();
  }

  return (
    <section className="mt-7 grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-black">Gallery sản phẩm</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ảnh raster tối đa 10 MB. Thứ tự 0 luôn là ảnh chính; tên tệp phía client không được dùng làm object key.
        </p>
      </div>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
        Mã sản phẩm
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            required
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
          />
          <button
            type="button"
            disabled={pending || !productId.trim()}
            onClick={refresh}
            className="rounded-xl bg-slate-900 px-4 py-2.5 font-bold text-white disabled:opacity-50"
          >
            Tải gallery
          </button>
        </div>
      </label>
      <form onSubmit={upload} className="grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
        <input type="hidden" name="productId" value={productId} />
        <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
          Ảnh
          <input
            name="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            required
            className="rounded-xl border border-slate-300 bg-white p-3 font-normal"
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
          Variant ID (không bắt buộc)
          <input name="variantId" className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal" />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold text-slate-800 md:col-span-2">
          Alt text
          <input name="altText" required maxLength={500} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal" />
        </label>
        <button
          disabled={pending || !productId.trim()}
          className="justify-self-start rounded-xl bg-purple-700 px-5 py-2.5 font-bold text-white disabled:opacity-50"
        >
          {pending ? "Đang xử lý…" : "Tải ảnh lên"}
        </button>
      </form>
      {message ? <p role="status" className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
      <div className="grid gap-4">
        {assets.map((asset) => (
          <MediaRow key={asset.id} asset={asset} refresh={refresh} report={setMessage} />
        ))}
      </div>
    </section>
  );
}
