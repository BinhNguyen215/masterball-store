import Link from "next/link";

import type { StorefrontCopy } from "@/i18n";

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

type ProductFilterFormProps = {
  copy: StorefrontCopy["catalog"]["filters"];
  typeLabels: StorefrontCopy["catalog"]["productType"];
  values: ProductFilterValues;
};

export function ProductFilterForm({ copy, typeLabels, values }: ProductFilterFormProps) {
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
          {copy.query}
        </label>
        <input
          defaultValue={values.query}
          id="catalog-query"
          name="query"
          placeholder={copy.queryPlaceholder}
          type="search"
        />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="catalog-game">
          {copy.game}
        </label>
        <select defaultValue={values.game ?? ""} id="catalog-game" name="game">
          <option value="">{copy.all}</option>
          <option value="pokemon">{copy.gamePokemon}</option>
          <option value="riftbound">{copy.gameRiftbound}</option>
          <option value="other">{copy.gameOther}</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="catalog-type">
          {copy.type}
        </label>
        <select defaultValue={values.type ?? ""} id="catalog-type" name="type">
          <option value="">{copy.all}</option>
          <option value="sealed">{typeLabels.SEALED}</option>
          <option value="single">{typeLabels.SINGLE}</option>
          <option value="accessory">{typeLabels.ACCESSORY}</option>
        </select>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="catalog-availability">
          {copy.availability}
        </label>
        <select
          defaultValue={values.availability ?? ""}
          id="catalog-availability"
          name="availability"
        >
          <option value="">{copy.all}</option>
          <option value="in-stock">{copy.availabilityInStock}</option>
          <option value="out-of-stock">{copy.availabilityOutOfStock}</option>
        </select>
      </div>
      <details className="filter-more" open={hasAdvancedFilters}>
        <summary>{copy.more}</summary>
        <div className="filter-more-fields">
          <div className="field">
            <label className="field-label" htmlFor="catalog-set">
              {copy.set}
            </label>
            <input
              autoComplete="off"
              defaultValue={values.set}
              id="catalog-set"
              name="set"
              placeholder={copy.setPlaceholder}
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="catalog-language">
              {copy.language}
            </label>
            <select
              defaultValue={values.language ?? ""}
              id="catalog-language"
              name="language"
            >
              <option value="">{copy.all}</option>
              <option value="vi">{copy.languageVi}</option>
              <option value="en">{copy.languageEn}</option>
              <option value="ja">{copy.languageJa}</option>
              <option value="other">{copy.languageOther}</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="catalog-condition">
              {copy.condition}
            </label>
            <input
              autoComplete="off"
              defaultValue={values.condition}
              id="catalog-condition"
              name="condition"
              placeholder={copy.conditionPlaceholder}
              type="text"
            />
          </div>
          <fieldset className="price-fields">
            <legend>{copy.price}</legend>
            <div className="field">
              <label className="field-label" htmlFor="catalog-min-price">
                {copy.priceMin}
              </label>
              <input
                autoComplete="off"
                defaultValue={values.minPrice}
                id="catalog-min-price"
                inputMode="numeric"
                min="0"
                name="minPrice"
                placeholder={copy.priceMinPlaceholder}
                step="1000"
                type="number"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="catalog-max-price">
                {copy.priceMax}
              </label>
              <input
                autoComplete="off"
                defaultValue={values.maxPrice}
                id="catalog-max-price"
                inputMode="numeric"
                min="0"
                name="maxPrice"
                placeholder={copy.priceMaxPlaceholder}
                step="1000"
                type="number"
              />
            </div>
          </fieldset>
        </div>
      </details>
      <div className="field">
        <label className="field-label" htmlFor="catalog-sort">
          {copy.sort}
        </label>
        <select defaultValue={values.sort ?? "featured"} id="catalog-sort" name="sort">
          <option value="featured">{copy.sortFeatured}</option>
          <option value="newest">{copy.sortNewest}</option>
          <option value="price-asc">{copy.sortPriceAsc}</option>
          <option value="price-desc">{copy.sortPriceDesc}</option>
          <option value="name-asc">{copy.sortNameAsc}</option>
        </select>
      </div>
      <div className="filter-actions">
        <button className="button button--primary" type="submit">
          {copy.apply}
        </button>
        <Link className="button-link button-link--secondary" href="/products">
          {copy.clear}
        </Link>
      </div>
    </form>
  );
}
