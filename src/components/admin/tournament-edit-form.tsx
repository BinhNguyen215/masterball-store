"use client";

import { tournamentAction } from "@/app/(admin)/admin/actions";

import { Field, idInputProps, inputClassName, MutationForm } from "./mutation-form";

export function TournamentEditForm() {
  return (
    <MutationForm action={tournamentAction} submitLabel="Lưu thay đổi">
      <input type="hidden" name="operation" value="update-tournament" />
      <h2 className="text-lg font-black">Sửa thông báo đã tạo</h2>
      <p className="text-xs text-slate-500">
        Bản nháp, đã lên lịch và đã xuất bản đều sửa được; thông báo đã lưu trữ thì không. Slug và game giữ nguyên.
      </p>
      <Field label="Mã giải đấu"><input className={inputClassName} name="tournamentId" required {...idInputProps} /></Field>
      <Field label="Phiên bản hiện tại"><input className={inputClassName} name="version" type="number" min={1} step={1} required /></Field>
      <Field label="Tiêu đề"><input className={inputClassName} name="title" required minLength={2} maxLength={180} /></Field>
      <Field label="Tóm tắt"><textarea className={inputClassName} name="summary" rows={3} minLength={2} maxLength={1000} required /></Field>
      <Field label="Địa điểm"><input className={inputClassName} name="venueName" maxLength={240} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bắt đầu"><input className={inputClassName} name="startsAt" type="datetime-local" required /></Field>
        <Field label="Kết thúc"><input className={inputClassName} name="endsAt" type="datetime-local" required /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hạn đăng ký"><input className={inputClassName} name="registrationDeadline" type="datetime-local" /></Field>
        <Field label="Số người tối đa"><input className={inputClassName} name="capacity" type="number" min={1} max={10000} step={1} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lệ phí (VND)"><input className={inputClassName} name="feeVnd" type="number" min={0} max={2147483647} step="1000" /></Field>
        <Field label="Liên hệ"><input className={inputClassName} name="contact" maxLength={250} /></Field>
      </div>
      <Field label="Link đăng ký bên thứ ba"><input className={inputClassName} name="ctaUrl" type="url" placeholder="https://..." maxLength={500} /></Field>
      <Field label="Thể lệ (văn bản thuần)"><textarea className={inputClassName} name="rules" rows={5} minLength={2} maxLength={10000} required /></Field>
    </MutationForm>
  );
}
