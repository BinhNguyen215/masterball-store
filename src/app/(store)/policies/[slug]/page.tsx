import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/storefront/page-intro";

const policies = {
  privacy: {
    description:
      "Phạm vi dữ liệu và cách cửa hàng bảo vệ thông tin khách hàng sẽ được công bố tại đây.",
    sections: [
      {
        heading: "Trạng thái nội dung",
        paragraphs: [
          "Chính sách quyền riêng tư chính thức chưa được cửa hàng phê duyệt. Trang này không thay thế thông báo pháp lý hoàn chỉnh.",
          "Trước khi checkout mở, cửa hàng cần công bố loại dữ liệu thu thập, mục đích xử lý, thời gian lưu và cách khách hàng yêu cầu hỗ trợ.",
        ],
      },
    ],
    title: "Quyền riêng tư",
  },
  returns: {
    description:
      "Điều kiện đổi trả sẽ phân biệt sản phẩm sealed, thẻ lẻ và phụ kiện theo tình trạng thực tế.",
    sections: [
      {
        heading: "Trước khi gửi hàng",
        paragraphs: [
          "Chính sách đổi trả chính thức chưa được cửa hàng phê duyệt. Không gửi sản phẩm về cửa hàng khi chưa nhận hướng dẫn xác nhận.",
          "Khi nội dung được công bố, trang sẽ nêu rõ thời hạn yêu cầu, tình trạng sản phẩm được chấp nhận và trách nhiệm chi phí vận chuyển.",
        ],
      },
    ],
    title: "Đổi trả",
  },
  shipping: {
    description:
      "Thông tin về khu vực giao, thời gian dự kiến và cách tính phí sẽ được công bố tại đây.",
    sections: [
      {
        heading: "Phí và thời gian giao",
        paragraphs: [
          "Bảng phí giao hàng chính thức chưa được cửa hàng phê duyệt. Checkout không được phép tự ước tính hoặc cam kết thời gian giao khi chưa có cấu hình vận hành.",
          "Sau khi cấu hình hoàn tất, chi phí và phương thức giao sẽ được hiển thị trước khi khách xác nhận đặt hàng.",
        ],
      },
    ],
    title: "Giao hàng",
  },
  terms: {
    description:
      "Các điều kiện mua bán, thanh toán và xử lý đơn sẽ được trình bày minh bạch trước khi cửa hàng nhận đơn trực tuyến.",
    sections: [
      {
        heading: "Trạng thái điều khoản",
        paragraphs: [
          "Điều khoản mua bán chính thức chưa được cửa hàng phê duyệt. Trang này chỉ ghi nhận rằng nội dung còn trong quá trình hoàn thiện.",
          "Checkout phải dẫn tới điều khoản hoàn chỉnh trước khi yêu cầu khách đồng ý hoặc gửi đơn hàng.",
        ],
      },
    ],
    title: "Điều khoản mua bán",
  },
} as const;

type PolicySlug = keyof typeof policies;

function isPolicySlug(slug: string): slug is PolicySlug {
  return slug in policies;
}

export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (!isPolicySlug(slug)) {
    return { title: "Không tìm thấy chính sách" };
  }

  return {
    title: policies[slug].title,
    description: policies[slug].description,
    robots: { follow: false, index: false },
  };
}

export default async function PolicyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isPolicySlug(slug)) {
    notFound();
  }

  const policy = policies[slug];

  return (
    <>
      <PageIntro
        breadcrumbLabel={policy.title}
        description={policy.description}
        title={policy.title}
      />
      <div className="section-inner policy-layout">
        <nav aria-label="Các chính sách" className="policy-nav">
          {Object.entries(policies).map(([policySlug, item]) => (
            <Link
              aria-current={policySlug === slug ? "page" : undefined}
              href={`/policies/${policySlug}`}
              key={policySlug}
            >
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="notice" role="status">
          <AlertTriangle aria-hidden="true" size={20} strokeWidth={1.8} />
          <p>
            Nội dung đang chờ phê duyệt vận hành. Vui lòng chưa dựa vào trang này
            để quyết định mua hàng.
          </p>
        </div>
        <article className="policy-content">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
