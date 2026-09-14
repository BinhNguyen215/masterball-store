export function IntegrationError({ label }: { label: string }) {
  return (
    <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
      <p className="font-bold">Chưa thể tải {label}</p>
      <p className="mt-1 text-sm leading-6">Dịch vụ miền tương ứng chưa sẵn sàng. Không có thao tác nào được giả lập là thành công.</p>
    </div>
  );
}
