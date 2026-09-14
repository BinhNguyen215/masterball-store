"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-7 text-red-950">
      <h2 className="text-xl font-black">Không thể tải khu vực quản trị</h2>
      <p className="mt-2 text-sm">Yêu cầu chưa được hoàn tất. Không có thay đổi nào được giả định là thành công.</p>
      <button type="button" onClick={reset} className="mt-5 rounded-xl bg-red-800 px-4 py-2 font-bold text-white">Thử lại</button>
    </div>
  );
}
