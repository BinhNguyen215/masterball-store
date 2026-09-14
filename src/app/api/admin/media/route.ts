import { ZodError } from "zod";

import {
  listProductMedia,
  MediaManagementError,
  MediaRequestTooLargeError,
  MediaStorageError,
  MediaValidationError,
  readBoundedRequestBody,
  uploadProductMedia,
} from "@/modules/media";
import {
  authorize,
  authorizationResponse,
} from "@/modules/auth/guards";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 256 * 1024;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

function mediaErrorResponse(error: unknown): Response {
  const denied = authorizationResponse(error);
  if (denied) return denied;
  if (error instanceof ZodError) {
    return Response.json({ error: "INVALID_MEDIA_INPUT" }, { status: 400 });
  }
  if (error instanceof MediaValidationError) {
    return Response.json({ error: "INVALID_RASTER_IMAGE" }, { status: 400 });
  }
  if (error instanceof MediaRequestTooLargeError) {
    return Response.json({ error: "MEDIA_TOO_LARGE" }, { status: 413 });
  }
  if (error instanceof MediaStorageError) {
    return Response.json({ error: "MEDIA_STORAGE_UNAVAILABLE" }, { status: 502 });
  }
  if (error instanceof MediaManagementError) {
    if (
      error.code === "PRODUCT_NOT_FOUND" ||
      error.code === "VARIANT_NOT_FOUND" ||
      error.code === "MEDIA_NOT_FOUND"
    ) {
      return Response.json({ error: error.code }, { status: 404 });
    }
    if (error.code === "ARCHIVED_PRODUCT") {
      return Response.json({ error: error.code }, { status: 409 });
    }
    return Response.json({ error: error.code }, { status: 502 });
  }
  return Response.json({ error: "MEDIA_OPERATION_FAILED" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await authorize("catalog.read", request.headers);
    const productId = new URL(request.url).searchParams.get("productId");
    if (!productId) {
      return Response.json({ error: "PRODUCT_ID_REQUIRED" }, { status: 400 });
    }
    const items = await listProductMedia(productId);
    return Response.json(
      { items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return mediaErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) {
      return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    }
    const actor = await authorize("catalog.write", request.headers);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
      return Response.json({ error: "MULTIPART_REQUIRED" }, { status: 415 });
    }
    const advertisedLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(advertisedLength) && advertisedLength > MAX_MULTIPART_BYTES) {
      return Response.json({ error: "MEDIA_TOO_LARGE" }, { status: 413 });
    }

    const contentType = request.headers.get("content-type")!;
    const boundedBody = await readBoundedRequestBody(
      request,
      MAX_MULTIPART_BYTES,
    );
    const formData = await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: boundedBody.buffer,
    }).formData();
    const file = formData.get("file");
    const productId = formData.get("productId");
    const variantId = formData.get("variantId");
    const altText = formData.get("altText");
    if (
      !(file instanceof File) ||
      typeof productId !== "string" ||
      typeof altText !== "string"
    ) {
      return Response.json({ error: "INVALID_MEDIA_INPUT" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "MEDIA_TOO_LARGE" }, { status: 413 });
    }
    const asset = await uploadProductMedia({
      productId,
      variantId: typeof variantId === "string" && variantId.trim() ? variantId : null,
      altText,
      bytes: Buffer.from(await file.arrayBuffer()),
      actorId: actor.id,
    });
    return Response.json(
      { asset },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
