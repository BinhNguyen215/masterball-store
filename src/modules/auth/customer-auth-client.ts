"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Shopper browser client. It talks to the customer instance's own base path,
 * so it never touches the staff session (`masterball-admin`).
 */
export const customerAuthClient = createAuthClient({
  basePath: "/api/auth/customer",
});
