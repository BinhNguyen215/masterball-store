import "server-only";

import { z } from "zod";

/**
 * Current administrative units (post-2025 two-level structure: province and
 * ward). Only the province list is consumed today — it is what the shipping
 * rule and the courier label need, and it keeps checkout free of stale
 * pre-merger data.
 */
const PROVINCES_URL = "https://provinces.open-api.vn/api/v2/p/";
const REVALIDATE_SECONDS = 86_400;

const provinceSchema = z.object({
  code: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
});

export type VietnamProvince = z.infer<typeof provinceSchema>;

/** Returns an empty list when the upstream dataset is unreachable or invalid. */
export async function listVietnamProvinces(): Promise<VietnamProvince[]> {
  try {
    const response = await fetch(PROVINCES_URL, {
      headers: { accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) return [];

    const parsed = z.array(provinceSchema).safeParse(await response.json());
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
