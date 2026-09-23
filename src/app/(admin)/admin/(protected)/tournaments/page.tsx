import { MutationForm, Field, idInputProps, inputClassName } from "@/components/admin/mutation-form";
import { PageHeading } from "@/components/admin/page-heading";
import { ResourcePanel, type AdminSearchParams } from "@/components/admin/resource-panel";
import { SearchFilterBar } from "@/components/admin/search-filter-bar";
import { TournamentStatusFields } from "@/components/admin/tournament-status-fields";
import { TournamentEditForm } from "@/components/admin/tournament-edit-form";
import { requireAdminPage } from "@/modules/auth/guards";
import { tournamentAction } from "../../actions";

export default async function TournamentsPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  await requireAdminPage("tournaments.read");
  const query = await searchParams;
  return (
    <>
      <PageHeading title="Giải đấu" description="Soạn bản nháp, lên lịch và xuất bản thông báo theo giờ Việt Nam (Asia/Ho_Chi_Minh)." />
      <SearchFilterBar placeholder="Tên hoặc slug giải đấu" searchParams={query} statusOptions={[{ value: "DRAFT", label: "Bản nháp" }, { value: "SCHEDULED", label: "Đã lên lịch" }, { value: "PUBLISHED", label: "Đã xuất bản" }, { value: "UNPUBLISHED", label: "Đã gỡ" }, { value: "CANCELLED", label: "Đã hủy" }, { value: "ARCHIVED", label: "Lưu trữ" }]} />
      <ResourcePanel resource="tournaments" searchParams={query} label="giải đấu" emptyMessage="Chưa có thông báo giải đấu phù hợp." />
      <div className="mt-7 grid gap-5 xl:grid-cols-2">
        <MutationForm action={tournamentAction} submitLabel="Lưu bản nháp">
          <input type="hidden" name="operation" value="create" />
          <h2 className="text-lg font-black">Thông báo mới</h2>
          <Field label="Tiêu đề"><input className={inputClassName} name="title" required minLength={2} maxLength={180} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Slug"><input className={inputClassName} name="slug" required maxLength={180} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></Field><Field label="Mã game"><input className={inputClassName} name="gameId" required {...idInputProps} /></Field></div>
          <Field label="Tóm tắt"><textarea className={inputClassName} name="summary" rows={3} minLength={2} maxLength={1000} required /></Field>
          <Field label="Địa điểm"><input className={inputClassName} name="venueName" required maxLength={240} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Bắt đầu"><input className={inputClassName} name="startsAt" type="datetime-local" required /></Field><Field label="Kết thúc"><input className={inputClassName} name="endsAt" type="datetime-local" required /></Field></div>
          <Field label="Hạn đăng ký"><input className={inputClassName} name="registrationDeadline" type="datetime-local" /></Field>
          <Field label="Link đăng ký bên thứ ba"><input className={inputClassName} name="ctaUrl" type="url" placeholder="https://..." maxLength={500} /></Field>
          <Field label="Thể lệ (văn bản thuần)"><textarea className={inputClassName} name="rules" rows={5} minLength={2} maxLength={10000} required /></Field>
        </MutationForm>
        <MutationForm action={tournamentAction} submitLabel="Lưu trạng thái">
          <input type="hidden" name="operation" value="status" />
          <h2 className="text-lg font-black">Xuất bản / lên lịch</h2>
          <Field label="Mã giải đấu"><input className={inputClassName} name="tournamentId" required maxLength={36} /></Field>
          <TournamentStatusFields />
          <Field label="Phiên bản hiện tại"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
        </MutationForm>
        <TournamentEditForm />
      </div>
    </>
  );
}
