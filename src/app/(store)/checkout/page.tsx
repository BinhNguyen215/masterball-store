import type { Metadata } from "next";

import { CheckoutView } from "@/components/storefront/checkout-view";
import { PageIntro } from "@/components/storefront/page-intro";
import { CartError, getCart } from "@/modules/cart";

import { createCheckoutOrder } from "./actions";
import { readCartToken } from "../cart/cart-cookie";
import {
  isCheckoutReady,
  mapCartItems,
  type CartSnapshot,
} from "../cart/cart-commerce";
import { getCheckoutPageMessage } from "./checkout-commerce";

export const metadata: Metadata = {
  title: "Thanh toán",
  description: "Nhập thông tin nhận hàng và xác nhận đơn mua TCG.",
  robots: { follow: false, index: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const configured = Boolean(process.env.DATABASE_URL?.trim());
  let snapshot: CartSnapshot | null = null;
  let loadMessage: { kind: "error"; text: string } | undefined;

  if (configured) {
    const token = await readCartToken();
    if (token) {
      try {
        snapshot = await getCart(token);
        if (!isCheckoutReady(snapshot)) {
          loadMessage = {
            kind: "error",
            text: "Giỏ hàng trống, đã hết hiệu lực hoặc có sản phẩm không đủ tồn kho. Vui lòng kiểm tra lại giỏ hàng.",
          };
        }
      } catch (error) {
        loadMessage = {
          kind: "error",
          text:
            error instanceof CartError
              ? "Giỏ hàng không còn hiệu lực. Vui lòng quay lại giỏ hàng."
              : "Chưa thể tải giỏ hàng lúc này. Vui lòng thử lại sau.",
        };
      }
    } else {
      loadMessage = {
        kind: "error",
        text: "Bạn chưa có giỏ hàng để thanh toán.",
      };
    }
  } else {
    loadMessage = {
      kind: "error",
      text: "Thanh toán chưa khả dụng vì cửa hàng chưa kết nối cơ sở dữ liệu.",
    };
  }

  const enabled = snapshot ? isCheckoutReady(snapshot) : false;

  return (
    <>
      <PageIntro
        breadcrumbLabel="Thanh toán"
        description="Giá, tồn kho và lựa chọn thanh toán phải được xác thực trước khi đơn hàng được tạo."
        title="Hoàn tất đơn hàng"
      />
      <div className="section-inner">
        <CheckoutView
          cartVersion={snapshot?.version}
          checkoutAction={enabled ? createCheckoutOrder : undefined}
          enabled={enabled}
          items={snapshot ? mapCartItems(snapshot) : []}
          message={getCheckoutPageMessage(query) ?? loadMessage}
          subtotalVnd={snapshot?.subtotalVnd ?? 0}
        />
      </div>
    </>
  );
}
