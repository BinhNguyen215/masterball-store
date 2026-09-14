import { adminApplication } from "@/modules/auth/admin-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function returnPage(title: string, message: string, status = 200): Response {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui,sans-serif;background:#07152d;color:#111827;margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}.card{max-width:560px;background:#f8f7fa;border-radius:24px;padding:32px;box-shadow:0 20px 60px #0006}h1{margin:0 0 12px}p{line-height:1.6;color:#475569}a{display:inline-block;margin-top:16px;color:#6f35c5;font-weight:700}</style></head><body><main class="card"><h1>${title}</h1><p>${message}</p><a href="/">Về cửa hàng</a></main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; navigate-to 'self'; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  try {
    // Read-only inspection. This endpoint never changes order or payment state.
    const result = await adminApplication.inspectVnpayReturn(new URL(request.url).searchParams);
    if (!result.valid) {
      return returnPage("Không thể xác minh kết quả", "Thông tin trả về không hợp lệ. Đơn hàng chưa được đánh dấu đã thanh toán.", 400);
    }
    if (result.status === "SUCCESS") {
      return returnPage("Đã nhận kết quả thanh toán", "Chúng tôi đang xác nhận giao dịch qua kênh IPN bảo mật. Trạng thái đơn sẽ được cập nhật sau khi xác minh hoàn tất.");
    }
    return returnPage("Thanh toán chưa hoàn tất", "Đơn hàng chưa được đánh dấu đã thanh toán. Bạn có thể quay lại cửa hàng và thử lại nếu cần.");
  } catch {
    return returnPage("Chưa thể kiểm tra giao dịch", "Hệ thống chưa thể xác minh kết quả lúc này. Đơn hàng không bị thay đổi.", 503);
  }
}
