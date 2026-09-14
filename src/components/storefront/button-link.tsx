import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  children: ReactNode;
  href: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
};

export function ButtonLink({
  children,
  href,
  icon: Icon,
  variant = "primary",
}: ButtonLinkProps) {
  return (
    <Link className={`button-link button-link--${variant}`} href={href}>
      {children}
      {Icon ? <Icon aria-hidden="true" size={18} strokeWidth={1.8} /> : null}
    </Link>
  );
}
