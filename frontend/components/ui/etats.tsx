import type { ReactNode } from "react";
import { IconAlerte } from "@/components/icons";

/** Bloc de substitution pendant le chargement, aux dimensions du contenu attendu. */
export function Squelette({ className = "h-24" }: { className?: string }) {
  return (
    <output
      aria-busy="true"
      aria-label="Chargement"
      className={`block w-full animate-pulse rounded-card bg-plane ${className}`}
    />
  );
}

/**
 * Échec de chargement. Toujours accompagné du moyen de réessayer : une erreur
 * réseau est le plus souvent passagère.
 */
export function Erreur({
  message,
  onReessayer,
}: {
  message: string;
  onReessayer?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-card border border-line bg-surface px-6 py-10 text-center"
    >
      <IconAlerte className="mx-auto h-5 w-5 text-critical" />
      <p className="mt-3 text-sm font-medium text-ink">
        Les données n’ont pas pu être chargées
      </p>
      <p className="mt-1 text-xs text-ink-2">{message}</p>
      {onReessayer ? (
        <button
          type="button"
          onClick={onReessayer}
          className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors duration-200 hover:bg-plane"
        >
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

/** Absence de données, à distinguer d'une erreur : la requête a abouti. */
export function Vide({
  titre,
  indice,
  action,
}: {
  titre: string;
  indice?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
      <p className="text-sm font-medium text-ink">{titre}</p>
      {indice ? <p className="mt-1 text-xs text-ink-2">{indice}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/**
 * Page de pagination vide alors que la collection, elle, ne l'est pas.
 *
 * Le cas se produit dès que la liste raccourcit sous les pieds de
 * l'utilisateur (suppression, filtre, création ailleurs) : le serveur répond
 * `content: []` avec un `number` supérieur au dernier index valide. Sans ce
 * message, l'écran affirmait « la liste est vide » et, la pagination étant
 * masquée faute de pages, ne laissait aucun moyen de revenir.
 */
export function PageHorsLimites({ onRetour }: { onRetour: () => void }) {
  return (
    <Vide
      titre="Cette page ne contient rien"
      indice="La liste a changé depuis votre dernière navigation."
      action={
        <button
          type="button"
          onClick={onRetour}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600"
        >
          Revenir à la première page
        </button>
      }
    />
  );
}
