import { defineCopy } from "@/i18n/storefront";

export const POLICY_SLUGS = ["privacy", "returns", "shipping", "terms"] as const;

export type PolicySlug = (typeof POLICY_SLUGS)[number];

export function isPolicySlug(slug: string): slug is PolicySlug {
  return (POLICY_SLUGS as readonly string[]).includes(slug);
}

type PolicySection = {
  readonly heading: string;
  readonly paragraphs: readonly string[];
};

type PolicyEntry = {
  readonly title: string;
  readonly description: string;
  readonly sections: readonly PolicySection[];
};

type PoliciesCopy = {
  readonly navAria: string;
  readonly notice: string;
  readonly notFoundTitle: string;
  readonly items: Readonly<Record<PolicySlug, PolicyEntry>>;
};

/**
 * Policy pages publish placeholders until the shop approves the final legal
 * text. Both locales must carry the same shape so a locale switch can never
 * leave a Vietnamese section inside an English page.
 */
export const policiesCopy = defineCopy<PoliciesCopy>({
  vi: {
    navAria: "Các chính sách",
    notice:
      "Nội dung đang chờ phê duyệt vận hành. Vui lòng chưa dựa vào trang này để quyết định mua hàng.",
    notFoundTitle: "Không tìm thấy chính sách",
    items: {
      privacy: {
        title: "Quyền riêng tư",
        description:
          "Phạm vi dữ liệu và cách cửa hàng bảo vệ thông tin khách hàng sẽ được công bố tại đây.",
        sections: [
          {
            heading: "Cookie và bộ nhớ trình duyệt",
            paragraphs: [
              "Cửa hàng chỉ đặt cookie thiết yếu: một cookie giỏ hàng đã ký để giữ sản phẩm bạn chọn, một cookie phiên đăng nhập cho nhân viên cửa hàng, một cookie ghi nhớ ngôn ngữ hiển thị, và một cookie tạm thời (30 phút) cấp quyền xem đúng đơn hàng bạn vừa tra cứu.",
              "Các cookie này không dùng cho quảng cáo, không theo dõi bạn trên trang khác và không bán dữ liệu cho bên thứ ba. Vì chỉ có cookie thiết yếu, cửa hàng không hiển thị banner đồng ý cookie; bạn có thể xoá cookie bất cứ lúc nào trong trình duyệt, khi đó giỏ hàng và ngôn ngữ sẽ được tạo lại.",
            ],
          },
          {
            heading: "Trạng thái nội dung",
            paragraphs: [
              "Chính sách quyền riêng tư chính thức chưa được cửa hàng phê duyệt. Trang này không thay thế thông báo pháp lý hoàn chỉnh.",
              "Trước khi checkout mở, cửa hàng cần công bố loại dữ liệu thu thập, mục đích xử lý, thời gian lưu và cách khách hàng yêu cầu hỗ trợ.",
            ],
          },
        ],
      },
      returns: {
        title: "Đổi trả",
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
      },
      shipping: {
        title: "Giao hàng",
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
      },
      terms: {
        title: "Điều khoản mua bán",
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
      },
    },
  },
  en: {
    navAria: "Store policies",
    notice:
      "This content is awaiting operations approval. Please do not rely on this page to decide a purchase.",
    notFoundTitle: "Policy not found",
    items: {
      privacy: {
        title: "Privacy",
        description:
          "The data the shop collects and how it protects customer information will be published here.",
        sections: [
          {
            heading: "Cookies and browser storage",
            paragraphs: [
              "The shop sets essential cookies only: a signed cart cookie that keeps the items you picked, a session cookie for shop staff, a cookie that remembers your display language, and a temporary 30-minute cookie that grants access to the order you just looked up.",
              "These cookies are not used for advertising, they do not track you across other sites, and the data is never sold to third parties. Because only essential cookies are used, the shop shows no cookie consent banner; you can delete cookies at any time in your browser, after which the cart and the language choice are created again.",
            ],
          },
          {
            heading: "Content status",
            paragraphs: [
              "The official privacy policy has not been approved by the shop yet. This page does not replace a complete legal notice.",
              "Before checkout opens, the shop must publish which data is collected, why it is processed, how long it is kept, and how customers can ask for support.",
            ],
          },
        ],
      },
      returns: {
        title: "Returns",
        description:
          "Return conditions will distinguish sealed products, single cards and accessories by their actual condition.",
        sections: [
          {
            heading: "Before sending anything back",
            paragraphs: [
              "The official return policy has not been approved by the shop yet. Do not send products back before you receive confirmed instructions.",
              "Once the content is published, this page will state the request deadline, the accepted product condition and who pays for shipping.",
            ],
          },
        ],
      },
      shipping: {
        title: "Shipping",
        description:
          "Delivery areas, expected timing and how fees are calculated will be published here.",
        sections: [
          {
            heading: "Fees and delivery time",
            paragraphs: [
              "The official shipping fee table has not been approved by the shop yet. Checkout must not estimate or promise delivery times before an operations configuration exists.",
              "Once that configuration is complete, the cost and the delivery method will be shown before the customer confirms the order.",
            ],
          },
        ],
      },
      terms: {
        title: "Terms of sale",
        description:
          "The conditions for sale, payment and order handling will be presented clearly before the shop accepts online orders.",
        sections: [
          {
            heading: "Terms status",
            paragraphs: [
              "The official terms of sale have not been approved by the shop yet. This page only records that the content is still being completed.",
              "Checkout must link to complete terms before asking the customer to agree or submit an order.",
            ],
          },
        ],
      },
    },
  },
});
