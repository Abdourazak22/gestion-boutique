import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-card border border-line bg-surface ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  titre,
  sousTitre,
  action,
}: {
  titre: string;
  sousTitre?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          {titre}
        </h2>
        {sousTitre ? (
          <p className="mt-0.5 text-xs text-ink-2">{sousTitre}</p>
        ) : null}
      </div>
      {action}
    </header>
  );
}
