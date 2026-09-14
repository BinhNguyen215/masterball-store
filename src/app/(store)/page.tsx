import { ArrowRight, CalendarClock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ButtonLink } from "@/components/storefront/button-link";
import { ProductGrid } from "@/components/storefront/product-grid";
import { loadStorefrontHome } from "@/components/storefront/storefront-data";
import { TournamentCard } from "@/components/storefront/tournament-card";

const categories = [
  {
    href: "/products?game=pokemon",
    name: "Pokémon TCG",
    note: "Booster, box và sản phẩm sealed",
  },
  {
    href: "/products?game=riftbound",
    name: "Riftbound TCG",
    note: "Sản phẩm cho người chơi chiến thuật",
  },
  {
    href: "/products?type=accessory",
    name: "Phụ kiện",
    note: "Sleeve, hộp bài và dụng cụ bảo quản",
  },
] as const;

export const revalidate = 300;

export default async function HomePage() {
  const { configured, products, tournaments } = await loadStorefrontHome();

  return (
    <>
      <section className="hero">
        <div className="hero-media">
          <Image
            alt="Thẻ sưu tầm, gói bài và hộp đựng TCG dưới ánh sáng xanh tím"
            fill
            priority
            sizes="100vw"
            src="/images/tcg-hero.webp"
          />
        </div>
        <div className="hero-content">
          <div className="hero-copy">
            <p className="hero-eyebrow" translate="no">
              MasterBall Store
            </p>
            <h1 className="hero-title">
              Chọn đúng. <span>Chơi chất.</span>
            </h1>
            <p className="hero-description">
              Sản phẩm TCG và phụ kiện cho bộ sưu tập, bàn đấu và khoảnh khắc mở
              pack của bạn.
            </p>
            <div className="hero-actions">
              <ButtonLink href="/products" icon={ArrowRight}>
                Xem sản phẩm
              </ButtonLink>
              <ButtonLink href="/tournaments" variant="secondary">
                Lịch giải đấu
              </ButtonLink>
            </div>
            <span aria-hidden="true" className="capture-mark hero-capture" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-inner">
          <div className="section-heading">
            <h2>Đi thẳng vào thế giới bạn chơi</h2>
            <p>
              Duyệt theo dòng TCG hoặc tìm phụ kiện phù hợp với cách bạn lưu trữ
              và mang bộ bài.
            </p>
          </div>
          <ul className="category-index">
            {categories.map((category) => (
              <li key={category.href}>
                <Link className="category-link" href={category.href}>
                  <strong>{category.name}</strong>
                  <span>{category.note}</span>
                  <ArrowRight aria-hidden="true" size={28} strokeWidth={1.8} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section section--raised">
        <div className="section-inner">
          <div className="section-heading">
            <h2>{products.length > 0 ? "Lựa chọn nổi bật" : "Sản phẩm đang được chuẩn bị"}</h2>
            <p>
              Khu vực này chỉ hiển thị mặt hàng đã xuất bản với giá và tồn kho
              từ hệ thống cửa hàng.
            </p>
          </div>
          <ProductGrid
            emptyDescription={
              configured
                ? "Catalog chưa có sản phẩm nổi bật đã xuất bản. Hãy quay lại sau khi cửa hàng cập nhật dữ liệu thật."
                : "Catalog chưa được kết nối với cơ sở dữ liệu. Không có sản phẩm mẫu hay giá tạm được hiển thị."
            }
            products={products}
          />
        </div>
      </section>

      <section className="section">
        <div className="section-inner tournament-empty-band">
          <div>
            <CalendarClock aria-hidden="true" size={32} strokeWidth={1.6} />
            <h2>Hẹn nhau tại bàn đấu</h2>
          </div>
          {tournaments[0] ? (
            <TournamentCard tournament={tournaments[0]} />
          ) : (
            <div>
              <p>
                {configured
                  ? "Chưa có giải đấu nào được xuất bản. Lịch mới sẽ xuất hiện tại đây sau khi cửa hàng xác nhận thời gian và địa điểm."
                  : "Lịch giải đấu chưa được kết nối với cơ sở dữ liệu. Không có thời gian hay địa điểm mẫu được hiển thị."}
              </p>
              <Link className="text-link" href="/tournaments">
                Xem trang giải đấu
                <ArrowRight aria-hidden="true" size={18} strokeWidth={1.8} />
              </Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
