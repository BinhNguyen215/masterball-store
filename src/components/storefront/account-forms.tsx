"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { adoptGuestCart, allowCustomerAuth } from "@/app/(store)/account/actions";
import type { StorefrontCopy } from "@/i18n";
import { customerAuthClient } from "@/modules/auth/customer-auth-client";

type AccountCopy = StorefrontCopy["account"];

/**
 * Sign-in and registration forms for the shopper account. Both call the
 * throttling server action first, then the customer auth client, and finally
 * adopt the guest cart so the items collected before signing in are not lost.
 */
export function AccountAuthForms({ copy }: { copy: AccountCopy }) {
  const router = useRouter();
  const [failure, setFailure] = useState<{ mode: "sign-in" | "register"; text: string } | null>(null);
  const [pending, setPending] = useState<"sign-in" | "register" | null>(null);

  async function submit(
    mode: "sign-in" | "register",
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setFailure(null);
    setPending(mode);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    const gate = await allowCustomerAuth();
    if (!gate.allowed) {
      setFailure({
        mode,
        text: gate.reason === "throttled" ? copy.throttledError : copy.unavailableDescription,
      });
      setPending(null);
      return;
    }

    const result =
      mode === "sign-in"
        ? await customerAuthClient.signIn.email({
            email,
            password,
            rememberMe: data.get("rememberMe") === "on",
            callbackURL: "/account",
          })
        : await customerAuthClient.signUp.email({
            email,
            name: String(data.get("name") ?? "").trim(),
            password,
            callbackURL: "/account",
          });

    if (result.error) {
      setFailure({ mode, text: mode === "sign-in" ? copy.signInError : copy.registerError });
      setPending(null);
      return;
    }

    await adoptGuestCart();
    router.replace("/account");
    router.refresh();
  }

  return (
    <div className="checkout-layout">
      <section aria-labelledby="account-sign-in-title" className="checkout-panel">
        <h2 id="account-sign-in-title">{copy.signInTitle}</h2>
        <p className="field-help">{copy.signInDescription}</p>
        <form
          className="checkout-form"
          id="account-sign-in-form"
          onSubmit={(event) => submit("sign-in", event)}
        >
          <div className="field">
            <label className="field-label" htmlFor="account-sign-in-email">
              {copy.emailLabel}
            </label>
            <input
              autoComplete="username"
              id="account-sign-in-email"
              maxLength={254}
              name="email"
              placeholder={copy.emailPlaceholder}
              required
              type="email"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="account-sign-in-password">
              {copy.passwordLabel}
            </label>
            <input
              autoComplete="current-password"
              id="account-sign-in-password"
              maxLength={128}
              minLength={8}
              name="password"
              required
              type="password"
            />
          </div>
          <label className="consent-field" htmlFor="account-sign-in-remember">
            <input id="account-sign-in-remember" name="rememberMe" type="checkbox" />
            {copy.rememberLabel}
          </label>
          {failure?.mode === "sign-in" ? (
            <div className="notice" role="alert">
              <p>{failure.text}</p>
            </div>
          ) : null}
          <button
            className="button button--primary"
            disabled={pending !== null}
            type="submit"
          >
            {pending === "sign-in" ? copy.signInPending : copy.signInSubmit}
          </button>
        </form>
      </section>
      <section aria-labelledby="account-register-title" className="checkout-panel">
        <h2 id="account-register-title">{copy.registerTitle}</h2>
        <p className="field-help">{copy.registerDescription}</p>
        <form
          className="checkout-form"
          id="account-register-form"
          onSubmit={(event) => submit("register", event)}
        >
          <div className="field">
            <label className="field-label" htmlFor="account-register-name">
              {copy.nameLabel}
            </label>
            <input
              autoComplete="name"
              id="account-register-name"
              maxLength={120}
              minLength={2}
              name="name"
              placeholder={copy.namePlaceholder}
              required
              type="text"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="account-register-email">
              {copy.emailLabel}
            </label>
            <input
              autoComplete="email"
              id="account-register-email"
              maxLength={254}
              name="email"
              placeholder={copy.emailPlaceholder}
              required
              type="email"
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="account-register-password">
              {copy.passwordLabel}
            </label>
            <input
              autoComplete="new-password"
              id="account-register-password"
              maxLength={128}
              minLength={8}
              name="password"
              required
              type="password"
            />
            <p className="field-help">{copy.passwordHelp}</p>
          </div>
          {failure?.mode === "register" ? (
            <div className="notice" role="alert">
              <p>{failure.text}</p>
            </div>
          ) : null}
          <button
            className="button button--primary"
            disabled={pending !== null}
            type="submit"
          >
            {pending === "register" ? copy.registerPending : copy.registerSubmit}
          </button>
        </form>
      </section>
    </div>
  );
}

/**
 * Ends the shopper session with the customer client. Sign-out is not a server
 * action: the cookie belongs to the browser, and this mirrors the staff
 * console's button.
 */
export function AccountSignOutButton({ copy }: { copy: AccountCopy }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      className="button button--secondary"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await customerAuthClient.signOut();
        router.replace("/account");
        router.refresh();
      }}
      type="button"
    >
      {pending ? copy.signOutPending : copy.signOut}
    </button>
  );
}
