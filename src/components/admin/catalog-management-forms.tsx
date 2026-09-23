import { productAction } from "@/app/(admin)/admin/actions";

import {
  Field,
  idInputProps,
  inputClassName,
  MutationForm,
} from "./mutation-form";

function CatalogStatusSelect() {
  return (
    <select className={inputClassName} name="status">
      <option value="DRAFT">Bản nháp</option>
      <option value="ACTIVE">Đang hoạt động</option>
      <option value="ARCHIVED">Lưu trữ</option>
    </select>
  );
}

function ProductFields() {
  return (
    <>
      <Field label="Tên sản phẩm">
        <input className={inputClassName} name="title" required minLength={2} maxLength={180} />
      </Field>
      <Field label="Slug">
        <input className={inputClassName} name="slug" required maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mã game">
          <input className={inputClassName} name="gameId" required {...idInputProps} />
        </Field>
        <Field label="Mã set (không bắt buộc)">
          <input className={inputClassName} name="setId" {...idInputProps} />
        </Field>
        <Field label="Loại">
          <select className={inputClassName} name="type">
            <option value="SEALED">Sealed</option>
            <option value="SINGLE">Single</option>
            <option value="ACCESSORY">Phụ kiện</option>
          </select>
        </Field>
        <Field label="Nổi bật">
          <span className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3">
            <input name="featured" type="checkbox" /> Hiển thị ở khu vực nổi bật
          </span>
        </Field>
      </div>
      <Field label="Mô tả">
        <textarea className={inputClassName} name="description" rows={4} maxLength={2000} />
      </Field>
      <Field label="SEO title (không bắt buộc)">
        <input className={inputClassName} name="seoTitle" maxLength={250} />
      </Field>
      <Field label="SEO description (không bắt buộc)">
        <textarea className={inputClassName} name="seoDescription" rows={2} maxLength={500} />
      </Field>
    </>
  );
}

function VariantFields({ includeStatus = false }: { includeStatus?: boolean }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU">
          <input className={inputClassName} name="sku" required maxLength={120} />
        </Field>
        <Field label="Ngôn ngữ">
          <input className={inputClassName} name="language" required maxLength={50} />
        </Field>
        {includeStatus ? (
          <Field label="Trạng thái biến thể"><CatalogStatusSelect /></Field>
        ) : null}
        <Field label="Tình trạng">
          <input className={inputClassName} name="condition" maxLength={80} />
        </Field>
        <Field label="Phiên bản / edition">
          <input className={inputClassName} name="edition" maxLength={80} />
        </Field>
        <Field label="Bề mặt / finish">
          <input className={inputClassName} name="finish" maxLength={80} />
        </Field>
        <Field label="Giá VND">
          <input className={inputClassName} name="priceVnd" type="number" min={0} step={1} required />
        </Field>
        <Field label="Khối lượng (gram)">
          <input className={inputClassName} name="weightGram" type="number" min={0} step={1} defaultValue={0} required />
        </Field>
      </div>
    </>
  );
}

export function CatalogManagementForms() {
  return (
    <div className="mt-7 grid gap-8">
      <section>
        <h2 className="mb-4 text-xl font-black">Game, set và tag</h2>
        <div className="grid gap-5 xl:grid-cols-2">
          <MutationForm action={productAction} submitLabel="Tạo game">
            <input type="hidden" name="operation" value="create-game" />
            <Field label="Tên game"><input className={inputClassName} name="name" required maxLength={120} /></Field>
            <Field label="Slug"><input className={inputClassName} name="slug" required maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></Field>
          </MutationForm>
          <MutationForm action={productAction} submitLabel="Lưu trạng thái game">
            <input type="hidden" name="operation" value="game-status" />
            <Field label="Mã game"><input className={inputClassName} name="gameId" required {...idInputProps} /></Field>
            <Field label="Trạng thái"><CatalogStatusSelect /></Field>
          </MutationForm>
          <MutationForm action={productAction} submitLabel="Tạo set">
            <input type="hidden" name="operation" value="create-set" />
            <Field label="Mã game"><input className={inputClassName} name="gameId" required {...idInputProps} /></Field>
            <Field label="Tên set"><input className={inputClassName} name="name" required maxLength={160} /></Field>
            <Field label="Mã set"><input className={inputClassName} name="code" required maxLength={80} /></Field>
            <Field label="Ngày phát hành"><input className={inputClassName} name="releaseDate" type="date" /></Field>
          </MutationForm>
          <MutationForm action={productAction} submitLabel="Lưu trạng thái set">
            <input type="hidden" name="operation" value="set-status" />
            <Field label="Mã set"><input className={inputClassName} name="setId" required {...idInputProps} /></Field>
            <Field label="Trạng thái"><CatalogStatusSelect /></Field>
          </MutationForm>
          <MutationForm action={productAction} submitLabel="Tạo tag">
            <input type="hidden" name="operation" value="create-tag" />
            <Field label="Tên tag"><input className={inputClassName} name="name" required maxLength={120} /></Field>
            <Field label="Slug"><input className={inputClassName} name="slug" required maxLength={160} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></Field>
          </MutationForm>
          <MutationForm action={productAction} submitLabel="Thay danh sách tag">
            <input type="hidden" name="operation" value="replace-tags" />
            <Field label="Mã sản phẩm"><input className={inputClassName} name="productId" required {...idInputProps} /></Field>
            <Field label="Các mã tag, ngăn cách bằng dấu phẩy"><textarea className={inputClassName} name="tagIds" rows={3} /></Field>
            <p className="text-xs text-slate-500">Để trống để gỡ toàn bộ tag khỏi sản phẩm.</p>
          </MutationForm>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-black">Sản phẩm</h2>
        <div className="grid gap-5 xl:grid-cols-2">
          <MutationForm action={productAction} submitLabel="Tạo bản nháp">
            <input type="hidden" name="operation" value="create" />
            <ProductFields />
          </MutationForm>
          <MutationForm action={productAction} submitLabel="Cập nhật sản phẩm">
            <input type="hidden" name="operation" value="update-product" />
            <Field label="Mã sản phẩm"><input className={inputClassName} name="productId" required {...idInputProps} /></Field>
            <Field label="Phiên bản hiện tại"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
            <ProductFields />
          </MutationForm>
          <MutationForm action={productAction} submitLabel="Lưu trạng thái">
            <input type="hidden" name="operation" value="status" />
            <Field label="Mã sản phẩm"><input className={inputClassName} name="productId" required {...idInputProps} /></Field>
            <Field label="Trạng thái"><CatalogStatusSelect /></Field>
            <Field label="Phiên bản hiện tại"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
            <p className="text-xs text-slate-500">Kích hoạt yêu cầu quyền xuất bản. Phiên bản giúp phát hiện chỉnh sửa đồng thời.</p>
          </MutationForm>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-black">Biến thể và giá</h2>
        <div className="grid gap-5 xl:grid-cols-2">
          <MutationForm action={productAction} submitLabel="Tạo biến thể">
            <input type="hidden" name="operation" value="create-variant" />
            <Field label="Mã sản phẩm"><input className={inputClassName} name="productId" required {...idInputProps} /></Field>
            <VariantFields />
            <p className="text-xs text-slate-500">Biến thể mới bắt đầu ở bản nháp với tồn kho bằng 0.</p>
          </MutationForm>
          <MutationForm action={productAction} submitLabel="Cập nhật biến thể">
            <input type="hidden" name="operation" value="update-variant" />
            <Field label="Mã biến thể"><input className={inputClassName} name="variantId" required {...idInputProps} /></Field>
            <Field label="Phiên bản hiện tại"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
            <VariantFields includeStatus />
          </MutationForm>
        </div>
      </section>
    </div>
  );
}
