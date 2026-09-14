import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderStatusView } from "@/components/storefront/order-status-view";
import { PageIntro } from "@/components/storefront/page-intro";
import { getOrderByLookupToken } from "@/modules/orders";

import {
  isValidOrderLookupToken,
  mapOrderForStorefront,
} from "./order-commerce";

export const metadata: Metadata = {
  title: "Tra cứu đơn hàng",
  description: "Tra cứu trạng thái đơn hàng MasterBall Store bằng liên kết bảo mật.",
  referrer: "no-referrer",
  robots: { follow: false, index: false, nocache: true },
};

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidOrderLookupToken(token)) notFound();

  let order = null;
  if (process.env.DATABASE_URL?.trim()) {
    const result = await getOrderByLookupToken(token);
    if (!result) notFound();
    order = mapOrderForStorefront(result);
  }

  return (
    <>
      <PageIntro
        breadcrumbLabel="Tra cứu đơn"
        description="Liên kết này chỉ nên được mở trên thiết bị bạn tin cậy. Không chia sẻ mã tra cứu công khai."
        title="Theo dõi đơn hàng"
      />
      <div className="section-inner">
        <OrderStatusView order={order} />
      </div>
    </>
  );
}
