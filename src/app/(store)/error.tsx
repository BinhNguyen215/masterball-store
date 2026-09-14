"use client";

import { CircleAlert, RefreshCw } from "lucide-react";

export default function StoreError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="section-inner">
      <section className="state-screen" role="alert">
        <span aria-hidden="true" className="state-icon">
          <CircleAlert size={24} strokeWidth={1.8} />
        </span>
        <h1>Không thể tải nội dung</h1>
        <p>
          Kết nối hoặc dữ liệu có thể đang gặp sự cố. Hãy thử tải lại phần này.
        </p>
        {error.digest ? <p className="state-code">Mã lỗi: {error.digest}</p> : null}
        <button className="button button--primary" onClick={retry} type="button">
          <RefreshCw aria-hidden="true" size={18} strokeWidth={1.8} />
          Thử lại
        </button>
      </section>
    </div>
  );
}
