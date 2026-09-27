import "server-only";

import { getAuthEnvironment } from "@/config/environment";
import { createAuth, type AuthInstance } from "./auth-factory";

let instance: AuthInstance | undefined;
let customerInstance: AuthInstance | undefined;

export function getAuth(): AuthInstance {
  if (!instance) {
    const environment = getAuthEnvironment();
    instance = createAuth({
      baseURL: environment.BETTER_AUTH_URL,
      secret: environment.BETTER_AUTH_SECRET,
    });
  }
  return instance;
}

/**
 * The shopper instance. Same tables and secret as staff, but a distinct base
 * path (`/api/auth/customer`), cookie prefix (`masterball-customer`) and role
 * default (`CUSTOMER`), so a customer session can never satisfy the admin
 * guards.
 */
export function getCustomerAuth(): AuthInstance {
  if (!customerInstance) {
    const environment = getAuthEnvironment();
    customerInstance = createAuth({
      audience: "customer",
      baseURL: environment.BETTER_AUTH_URL,
      secret: environment.BETTER_AUTH_SECRET,
    });
  }
  return customerInstance;
}
