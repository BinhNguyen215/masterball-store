"use client";

import { useState } from "react";

import { Field, inputClassName } from "@/components/admin/mutation-form";

const statuses = [
  ["DRAFT", "Bản nháp"],
  ["SCHEDULED", "Lên lịch"],
  ["PUBLISHED", "Xuất bản ngay"],
  ["UNPUBLISHED", "Gỡ xuất bản"],
  ["CANCELLED", "Hủy"],
  ["ARCHIVED", "Lưu trữ"],
] as const;

export function TournamentStatusFields() {
  const [status, setStatus] = useState<string>("DRAFT");

  return (
    <>
      <Field label="Trạng thái">
        <select
          className={inputClassName}
          name="status"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          {statuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={
          status === "SCHEDULED"
            ? "Thời điểm xuất bản (bắt buộc khi lên lịch)"
            : "Thời điểm xuất bản (chỉ dùng khi lên lịch)"
        }
      >
        <input
          className={inputClassName}
          name="publishAt"
          required={status === "SCHEDULED"}
          type="datetime-local"
        />
      </Field>
      <p className="text-xs text-slate-500">
        Trạng thái hiện tại được máy chủ đọc từ cơ sở dữ liệu; không cần chọn lại.
      </p>
    </>
  );
}
