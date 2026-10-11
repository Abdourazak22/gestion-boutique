import type { ReactNode } from "react";

type Ton = "good" | "warning" | "serious" | "critical" | "neutre";

const tons: Record<Ton, string> = {
  good: "bg-brand-50 text-brand-700 ring-brand-200",
  warning: "bg-[#fff7e3] text-[#8a5d00] ring-[#f6dca0]",
  serious: "bg-[#fdeee7] text-[#9a4a23] ring-[#f3cbb9]",
  critical: "bg-[#fdecec] text-[#9d2626] ring-[#f2c2c2]",
  neutre: "bg-plane text-ink-2 ring-line",
};

/**
 * La couleur ne porte jamais seule l'information : icône + libellé
 * accompagnent systématiquement la teinte de statut.
 */
export function Badge({
  ton = "neutre",
  icone,
  children,
}: {
  ton?: Ton;
  icone?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${tons[ton]}`}
    >
      {icone}
      {children}
    </span>
  );
}
