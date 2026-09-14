import type { LucideIcon } from "lucide-react";

import { ButtonLink } from "@/components/storefront/button-link";

type EmptyStateProps = {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  icon: LucideIcon;
  title: string;
};

export function EmptyState({
  actionHref,
  actionLabel,
  description,
  icon: Icon,
  title,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-state-icon">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionHref && actionLabel ? (
        <ButtonLink href={actionHref} variant="secondary">
          {actionLabel}
        </ButtonLink>
      ) : null}
    </div>
  );
}
