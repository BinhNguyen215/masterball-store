import { Moon, Sun } from "lucide-react";

import type { StorefrontCopy } from "@/i18n";
import type { StorefrontTheme } from "@/i18n/storefront";

/**
 * The neon lamp: a switch that turns the shop's neon theme on and off. It is a
 * plain form post (no client state, so nothing flashes on load) that submits the
 * theme to switch to, and it reports its state through `role="switch"` +
 * `aria-checked` rather than through the glow alone.
 */
export function ThemeSwitch({
  action,
  copy,
  theme,
}: {
  action: (formData: FormData) => Promise<void>;
  copy: StorefrontCopy["chrome"]["theme"];
  theme: StorefrontTheme;
}) {
  const neonOn = theme === "dark";
  const target: StorefrontTheme = neonOn ? "light" : "dark";

  return (
    <form action={action} className="theme-switch-form">
      <button
        aria-checked={neonOn}
        aria-label={copy.label}
        className="theme-switch"
        name="theme"
        role="switch"
        title={neonOn ? copy.switchToLight : copy.switchToDark}
        type="submit"
        value={target}
      >
        <span aria-hidden="true" className="theme-switch-track">
          <Sun className="theme-switch-icon theme-switch-icon--day" size={14} strokeWidth={2} />
          <Moon className="theme-switch-icon theme-switch-icon--night" size={14} strokeWidth={2} />
          <span className="theme-switch-knob" />
        </span>
        <span className="sr-only">{neonOn ? copy.on : copy.off}</span>
      </button>
    </form>
  );
}
