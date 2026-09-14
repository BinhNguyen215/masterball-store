import "server-only";

import { getAuthEnvironment } from "@/config/environment";
import { createAuth } from "./auth-factory";

let instance: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  if (!instance) {
    const environment = getAuthEnvironment();
    instance = createAuth({
      baseURL: environment.BETTER_AUTH_URL,
      secret: environment.BETTER_AUTH_SECRET,
    });
  }
  return instance;
}
