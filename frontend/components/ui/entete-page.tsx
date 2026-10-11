import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function EntetePage({
  titre,
  sousTitre,
  actions,
}: {
  titre: string;
  sousTitre: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {titre}
        </h1>
        <p className="mt-1 text-sm text-ink-2">{sousTitre}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const PRINCIPAL =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/50";

const SECONDAIRE =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-plane disabled:cursor-not-allowed disabled:text-ink-3";

/** `type="button"` par défaut : un bouton d'en-tête ne soumet jamais de formulaire. */
export function BoutonPrincipal({
  children,
  className = "",
  ...props
}: ComponentProps<"button">) {
  return (
    <button type="button" className={`${PRINCIPAL} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function BoutonSecondaire({
  children,
  className = "",
  ...props
}: ComponentProps<"button">) {
  return (
    <button type="button" className={`${SECONDAIRE} ${className}`} {...props}>
      {children}
    </button>
  );
}

/** Même allure que `BoutonPrincipal`, mais c'est une navigation : un lien. */
export function LienPrincipal({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link className={`${PRINCIPAL} ${className}`} {...props}>
      {children}
    </Link>
  );
}
