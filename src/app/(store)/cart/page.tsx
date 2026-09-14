import type { Metadata } from "next";

import { CartView } from "@/components/storefront/cart-view";
import { PageIntro } from "@/components/storefront/page-intro";
import { CartError, getCart } from "@/modules/cart";

import { removeCartItem, updateCartItem } from "./actions";
import { readCartToken } from "./cart-cookie";
import {
  getCartPageMessage,
  isActiveCart,
  isCheckoutReady,
  mapCartItems,
  type CartSnapshot,
} from "./cart-commerce";

export const metadata: Metadata = {
  title: "Giỏ hàng",
  description: "Kiểm tra sản phẩm, số lượng và giá trước khi thanh toán.",
  robots: { follow: false, index: false },
};

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string | string[];
    status?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const configured = Boolean(process.env.DATABASE_URL?.trim());
  let snapshot: CartSnapshot | null = null;
  let loadMessage: { kind: "error" | "success"; text: string } | undefined;

  if (configured) {
    const token = await readCartToken();
    if (token) {
      try {
        snapshot = await getCart(token);
        if (!isActiveCart(snapshot)) {
          snapshot = null;
          loadMessage = {
            kind: "error",
            text: "Giỏ hàng trước đó không còn hiệu lực. Hãy thêm lại sản phẩm bạn muốn mua.",
          };
        }
      } catch (error) {
        loadMessage = {
          kind: "error",
          text:
            error instanceof CartError
              ? "Không thể mở giỏ hàng này. Hãy thêm lại sản phẩm bạn muốn mua."
              : "Chưa thể tải giỏ hàng lúc này. Vui lòng thử lại sau.",
        };
      }
    }
  } else {
    loadMessage = {
      kind: "error",
      text: "Giỏ hàng chưa khả dụng vì cửa hàng chưa kết nối cơ sở dữ liệu.",
    };
  }

  const ready = snapshot ? isCheckoutReady(snapshot) : false;

  return (
    <>
      <PageIntro
        breadcrumbLabel="Giỏ hàng"
        description="Mọi thay đổi về giá hoặc tồn kho phải được xác nhận rõ trước khi bạn tiếp tục."
        title="Kiểm tra giỏ hàng"
      />
      <div className="section-inner">
        <CartView
          cartVersion={snapshot?.version}
          checkoutAvailable={ready}
          items={snapshot ? mapCartItems(snapshot) : []}
          message={getCartPageMessage(query) ?? loadMessage}
          removeItemAction={snapshot ? removeCartItem : undefined}
          updateQuantityAction={snapshot ? updateCartItem : undefined}
        />
      </div>
    </>
  );
}
