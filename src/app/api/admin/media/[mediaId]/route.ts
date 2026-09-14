import { ZodError } from "zod";

import {
  deleteMediaAsset,
  MediaManagementError,
  MediaStorageError,
  updateMediaAsset,
} from "@/modules/media";
import {
  authorize,
  authorizationResponse,
} from "@/modules/auth/guards";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ mediaId: string }> };

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
  if (error instanceof MediaStorageError) {
    return Response.json({ error: "MEDIA_STORAGE_UNAVAILABLE" }, { status: 502 });
  }
  if (error instanceof MediaManagementError) {
    if (error.code === "MEDIA_NOT_FOUND") {
      return Response.json({ error: error.code }, { status: 404 });
    }
    if (error.code === "OBJECT_CLEANUP_FAILED") {
      return Response.json(
        {
          error: error.code,
          message: "Database record was deleted; storage cleanup requires retry.",
          objectKey: error.objectKey,
          databaseDeleted: error.databaseDeleted,
        },
        { status: 502 },
      );
    }
    return Response.json({ error: error.code }, { status: 409 });
  }
  return Response.json({ error: "MEDIA_OPERATION_FAILED" }, { status: 500 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    if (!sameOrigin(request)) {
      return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    }
    const actor = await authorize("catalog.write", request.headers);
    const advertisedLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(advertisedLength) && advertisedLength > 32 * 1024) {
      return Response.json({ error: "REQUEST_TOO_LARGE" }, { status: 413 });
    }
    const { mediaId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const asset = await updateMediaAsset({
      mediaId,
      altText: typeof body.altText === "string" ? body.altText : undefined,
      sortOrder:
        typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      actorId: actor.id,
    });
    return Response.json(
      { asset },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return mediaErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!sameOrigin(request)) {
      return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    }
    const actor = await authorize("catalog.write", request.headers);
    const { mediaId } = await context.params;
    await deleteMediaAsset({ mediaId, actorId: actor.id });
    return new Response(null, { status: 204 });
  } catch (error) {
    return mediaErrorResponse(error);
  }
}
