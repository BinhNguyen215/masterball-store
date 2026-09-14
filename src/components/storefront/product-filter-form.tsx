import Link from "next/link";

export type ProductFilterValues = {
  availability?: string;
  condition?: string;
  game?: string;
  language?: string;
  maxPrice?: string;
  minPrice?: string;
  page?: string;
  query?: string;
  set?: string;
  sort?: string;
  type?: string;
};

export function ProductFilterForm({ values }: { values: ProductFilterValues }) {
  const hasAdvancedFilters = Boolean(
    values.set ||
      values.language ||
      values.condition ||
      values.minPrice ||
      values.maxPrice,
  );

  return (
    <form action="/products" className="filter-form" method="get">
      <div className="field">
        <label className="field-label" htmlFor="catalog-query">
          Tìm sản phẩm
        </label>
        <input
          defaultValue={values.query}
          id="catalog-query"
          name="query"
          placeholder="Ví dụ: booster box…"
          type="search"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="catalog-game">
          Trò chơi
        </label>
        <select defaultValue={values.game ?? ""} id="catalog-game" name="game">
          <option value="">Tất cả</option>
          <option value="pokemon">Pokémon TCG</option>
          <option value="riftbound">Riftbound TCG</option>
          <option value="other">TCG khác</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="catalog-type">
          Loại sản phẩm
        </label>
        <select defaultValue={values.type ?? ""} id="catalog-type" name="type">
          <option value="">Tất cả</option>
          <option value="sealed">Sản phẩm sealed</option>
          <option value="single">Thẻ lẻ</option>
          <option value="accessory">Phụ kiện</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="catalog-availability">
          Tình trạng
        </label>
        <select
          defaultValue={values.availability ?? ""}
          id="catalog-availability"
          name="availability"
        >
          <option value="">Tất cả</option>
          <option value="in-stock">Còn hàng</option>
          <option value="out-of-stock">Tạm hết</option>
        </select>
      </div>
      <details className="filter-more" open={hasAdvancedFilters}>
        <summary>Bộ lọc chi tiết</summary>
        <div className="filter-more-fields">
          <div className="field">
            <label className="field-label" htmlFor="catalog-set">
              Mã bộ thẻ
            </label>
            <input
              autoComplete="off"
              defaultValue={values.set}
              id="catalog-set"
              name="set"
              placeholder="Ví dụ: SV08…"
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="catalog-language">
              Ngôn ngữ
            </label>
            <select
              defaultValue={values.language ?? ""}
              id="catalog-language"
              name="language"
            >
              <option value="">Tất cả</option>
              <option value="vi">Tiếng Việt</option>
              <option value="en">Tiếng Anh</option>
              <option value="ja">Tiếng Nhật</option>
              <option value="other">Ngôn ngữ khác</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="catalog-condition">
              Chất lượng
            </label>
            <input
              autoComplete="off"
              defaultValue={values.condition}
              id="catalog-condition"
              name="condition"
              placeholder="Ví dụ: Near Mint…"
              type="text"
            />
          </div>
          <fieldset className="price-fields">
            <legend>Khoảng giá</legend>
            <div className="field">
              <label className="field-label" htmlFor="catalog-min-price">
                Từ
              </label>
              <input
                autoComplete="off"
                defaultValue={values.minPrice}
                id="catalog-min-price"
                inputMode="numeric"
                min="0"
                name="minPrice"
                placeholder="0…"
                step="1000"
                type="number"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="catalog-max-price">
                Đến
              </label>
              <input
                autoComplete="off"
                defaultValue={values.maxPrice}
                id="catalog-max-price"
                inputMode="numeric"
                min="0"
                name="maxPrice"
                placeholder="5.000.000…"
                step="1000"
                type="number"
              />
            </div>
          </fieldset>
        </div>
      </details>
      <div className="field">
        <label className="field-label" htmlFor="catalog-sort">
          Sắp xếp
        </label>
        <select defaultValue={values.sort ?? "featured"} id="catalog-sort" name="sort">
          <option value="featured">Nổi bật</option>
          <option value="newest">Mới nhất</option>
          <option value="price-asc">Giá thấp đến cao</option>
          <option value="price-desc">Giá cao đến thấp</option>
          <option value="name-asc">Tên A đến Z</option>
        </select>
      </div>
      <div className="filter-actions">
        <button className="button button--primary" type="submit">
          Áp dụng bộ lọc
        </button>
        <Link className="button-link button-link--secondary" href="/products">
          Xóa bộ lọc
        </Link>
      </div>
    </form>
  );
}
