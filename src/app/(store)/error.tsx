"use client";

import { CircleAlert, RefreshCw } from "lucide-react";

import { useClientLocale } from "@/i18n/use-client-locale";

export default function StoreError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const chrome = useClientLocale().chrome;
  const copy = chrome.status;

  return (
    <div className="section-inner">
      <section className="state-screen" role="alert">
        <span aria-hidden="true" className="state-icon">
          <CircleAlert size={24} strokeWidth={1.8} />
        </span>
        <h1>{copy.errorTitle}</h1>
        <p>{copy.errorDescription}</p>
        {error.digest ? (
          <p className="state-code">
            {copy.errorCode}: {error.digest}
          </p>
        ) : null}
        <button className="button button--primary" onClick={retry} type="button">
          <RefreshCw aria-hidden="true" size={18} strokeWidth={1.8} />
          {chrome.actions.tryAgain}
        </button>
      </section>
    </div>
  );
}
