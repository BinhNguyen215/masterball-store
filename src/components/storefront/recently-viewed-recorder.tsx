"use client";

import { useEffect, useRef } from "react";

type RecentlyViewedRecorderProps = {
  action: (slug: string) => Promise<void>;
  slug: string;
};

/**
 * Records one product visit through a server action, because a cookie can only
 * be written from an action or route handler. The page renders this only when
 * the cookie head is not the current slug, so repeat visits cost no request.
 */
export function RecentlyViewedRecorder({ action, slug }: RecentlyViewedRecorderProps) {
  const recorded = useRef<string | null>(null);

  useEffect(() => {
    if (recorded.current === slug) return;
    recorded.current = slug;
    action(slug).catch(() => undefined);
  }, [action, slug]);

  return null;
}
