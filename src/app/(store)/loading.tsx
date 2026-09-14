export default function StoreLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="section-inner skeleton-stack">
      <span className="sr-only">Đang tải…</span>
      <div aria-hidden="true" className="skeleton-line skeleton-line--short" />
      <div aria-hidden="true" className="skeleton-line" />
      <div aria-hidden="true" className="skeleton-block" />
    </div>
  );
}
