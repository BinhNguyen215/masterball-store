"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { adminApplication, IntegrationUnavailableError, scheduledJobSchema } from "@/modules/auth/admin-application";
import { authorize, AuthorizationError } from "@/modules/auth/guards";
import {
  inventoryMutationSchema,
  orderMutationSchema,
  paymentMutationSchema,
  productMutationSchema,
  tournamentMutationSchema,
} from "@/modules/auth/schemas";
import type { MutationState } from "@/components/admin/mutation-form";
import { hasCapability } from "@/modules/auth/roles";
import { getRequestIpAddress } from "@/lib/request-ip";

const SUCCESS = "Đã lưu thay đổi.";

function values(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}

function failure(error: unknown): MutationState {
  if (error instanceof IntegrationUnavailableError) {
    return { ok: false, message: "Dịch vụ xử lý chưa sẵn sàng; không có thay đổi nào được ghi." };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, message: error.status === 401 ? "Phiên đăng nhập đã hết hạn." : "Bạn không có quyền thực hiện thao tác này." };
  }
  return { ok: false, message: "Dữ liệu không hợp lệ hoặc đã thay đổi. Hãy kiểm tra và thử lại." };
}

export async function productAction(_state: MutationState, formData: FormData): Promise<MutationState> {
  try {
    const actor = await authorize();
    const input = productMutationSchema.parse(values(formData));
    const publishes =
      ["status", "game-status", "set-status"].includes(input.operation) &&
      "status" in input &&
      input.status === "ACTIVE";
    const capability = publishes
      ? "catalog.publish"
      : ["create-variant", "update-variant"].includes(input.operation)
        ? "catalog.price"
        : "catalog.write";
    if (!hasCapability(actor.role, capability)) throw new AuthorizationError(403);
    switch (input.operation) {
      case "create":
        await adminApplication.createProduct(input, actor.id);
        break;
      case "update-product":
        await adminApplication.updateProduct(input, actor.id);
        break;
      case "create-variant":
        await adminApplication.createProductVariant(input, actor.id);
        break;
      case "update-variant":
        await adminApplication.updateProductVariant(input, actor.id);
        break;
      case "status":
        await adminApplication.setProductStatus(input, actor.id);
        break;
      case "create-game":
        await adminApplication.createGame(input, actor.id);
        break;
      case "game-status":
        await adminApplication.setGameStatus(input, actor.id);
        break;
      case "create-set":
        await adminApplication.createProductSet(input, actor.id);
        break;
      case "set-status":
        await adminApplication.setProductSetStatus(input, actor.id);
        break;
      case "create-tag":
        await adminApplication.createTag(input, actor.id);
        break;
      case "replace-tags":
        await adminApplication.replaceProductTags(input, actor.id);
        break;
    }
    revalidatePath("/admin/products");
    return { ok: true, message: SUCCESS };
  } catch (error) {
    return failure(error);
  }
}

export async function inventoryAction(_state: MutationState, formData: FormData): Promise<MutationState> {
  try {
    const actor = await authorize("inventory.adjust");
    const input = inventoryMutationSchema.parse(values(formData));
    await adminApplication.adjustInventory(input, actor.id);
    revalidatePath("/admin/inventory");
    return { ok: true, message: SUCCESS };
  } catch (error) {
    return failure(error);
  }
}

export async function orderAction(_state: MutationState, formData: FormData): Promise<MutationState> {
  try {
    const actor = await authorize("orders.transition");
    const input = orderMutationSchema.parse(values(formData));
    await adminApplication.transitionOrder(input, actor.id);
    revalidatePath("/admin/orders");
    return { ok: true, message: SUCCESS };
  } catch (error) {
    return failure(error);
  }
}

export async function paymentAction(_state: MutationState, formData: FormData): Promise<MutationState> {
  try {
    const actor = await authorize("payments.reconcile");
    const input = paymentMutationSchema.parse(values(formData));
    await adminApplication.reconcilePayment(
      input,
      actor.id,
      getRequestIpAddress(await headers()),
    );
    revalidatePath("/admin/payments");
    return { ok: true, message: "Đã yêu cầu đối soát an toàn." };
  } catch (error) {
    return failure(error);
  }
}

export async function tournamentAction(_state: MutationState, formData: FormData): Promise<MutationState> {
  try {
    const actor = await authorize();
    const input = tournamentMutationSchema.parse(values(formData));
    const capability = input.operation === "status" && ["PUBLISHED", "SCHEDULED"].includes(input.status)
      ? "tournaments.publish"
      : "tournaments.write";
    if (!hasCapability(actor.role, capability)) throw new AuthorizationError(403);
    if (input.operation === "create") {
      await adminApplication.createTournament(input, actor.id);
    } else if (input.operation === "update-tournament") {
      await adminApplication.updateTournament(input, actor.id);
    } else {
      await adminApplication.setTournamentStatus(input, actor.id);
    }
    revalidatePath("/admin/tournaments");
    revalidatePath("/tournaments");
    return { ok: true, message: SUCCESS };
  } catch (error) {
    return failure(error);
  }
}

export async function runJobAction(_state: MutationState, formData: FormData): Promise<MutationState> {
  try {
    await authorize("jobs.run");
    const job = scheduledJobSchema.parse(values(formData).job);
    const result = await adminApplication.runScheduledJob(job, new Date());
    revalidatePath("/admin/jobs");
    return { ok: true, message: `Đã chạy ${result.job}: ${result.summary}.` };
  } catch (error) {
    return failure(error);
  }
}
