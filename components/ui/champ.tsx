import type { ComponentProps, ReactNode } from "react";

const BASE =
  "h-11 w-full rounded-lg border bg-plane px-3 text-sm text-ink placeholder:text-ink-3 focus:bg-surface disabled:cursor-not-allowed disabled:text-ink-3";

/**
 * Champ de formulaire étiqueté.
 *
 * `erreur` vient du serveur (la carte `champs` d'un 400) ou d'un contrôle
 * local : dans les deux cas elle est rendue sous le champ, reliée par
 * `aria-describedby` et signalée par `aria-invalid` : la couleur rouge ne
 * suffit pas à porter l'information.
 */
export function Champ({
  id,
  libelle,
  erreur,
  indice,
  obligatoire = false,
  children,
}: {
  id: string;
  libelle: string;
  erreur?: string;
  indice?: ReactNode;
  obligatoire?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {libelle}
        {obligatoire ? (
          <span className="ml-1 text-critical" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {erreur ? (
        <p id={`${id}-erreur`} role="alert" className="mt-1.5 text-xs text-critical">
          {erreur}
        </p>
      ) : indice ? (
        <p id={`${id}-indice`} className="mt-1.5 text-xs text-ink-2">
          {indice}
        </p>
      ) : null}
    </div>
  );
}

/** Attributs d'accessibilité à poser sur l'input, dérivés de son état d'erreur. */
export const liaisonsChamp = (id: string, erreur?: string, indice?: boolean) => ({
  id,
  "aria-invalid": erreur ? true : undefined,
  "aria-describedby": erreur
    ? `${id}-erreur`
    : indice
      ? `${id}-indice`
      : undefined,
});

export function Saisie({
  erreur,
  className = "",
  ...props
}: ComponentProps<"input"> & { erreur?: string }) {
  return (
    <input
      className={`${BASE} ${erreur ? "border-critical focus:border-critical" : "border-line focus:border-brand-400"} ${className}`}
      {...props}
    />
  );
}

export function Liste({
  erreur,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { erreur?: string }) {
  return (
    <select
      className={`${BASE} cursor-pointer ${erreur ? "border-critical focus:border-critical" : "border-line focus:border-brand-400"} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Zone({
  erreur,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { erreur?: string }) {
  return (
    <textarea
      className={`${BASE} h-auto py-2.5 ${erreur ? "border-critical focus:border-critical" : "border-line focus:border-brand-400"} ${className}`}
      {...props}
    />
  );
}
