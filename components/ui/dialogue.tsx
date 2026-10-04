"use client";

import { useEffect, useId, useRef } from "react";
import { IconFermer } from "@/components/icons";

/**
 * Boîte de dialogue modale, bâtie sur l'élément `<dialog>` natif : le piège à
 * focus, la touche Échap et l'inertie de l'arrière-plan sont fournis par le
 * navigateur, inutile de les réimplémenter.
 */
export function Dialogue({
  ouvert,
  titre,
  description,
  onFermer,
  children,
}: {
  ouvert: boolean;
  titre: string;
  description?: string;
  onFermer: () => void;
  children: React.ReactNode;
}) {
  const reference = useRef<HTMLDialogElement>(null);
  // Identifiants propres à l'instance : deux boîtes montées en même temps
  // partageraient sinon le même `id`, et `aria-labelledby` deviendrait ambigu.
  const idTitre = useId();
  const idDescription = useId();

  useEffect(() => {
    const dialogue = reference.current;
    if (!dialogue) return;
    // `showModal()` et non l'attribut `open` : seul l'appel impératif rend
    // l'arrière-plan inerte et pose le piège à focus.
    if (ouvert && !dialogue.open) dialogue.showModal();
    if (!ouvert && dialogue.open) dialogue.close();
  }, [ouvert]);

  return (
    <dialog
      ref={reference}
      aria-labelledby={idTitre}
      aria-describedby={description ? idDescription : undefined}
      // `close` couvre aussi la touche Échap, qui ferme sans passer par nos boutons.
      onClose={onFermer}
      className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-card bg-surface p-0 text-ink backdrop:bg-shell/50 backdrop:backdrop-blur-sm"
    >
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 id={idTitre} className="text-[15px] font-semibold tracking-tight">
            {titre}
          </h2>
          {description ? (
            <p id={idDescription} className="mt-0.5 text-xs text-ink-2">
              {description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition-colors duration-200 hover:bg-plane hover:text-ink"
        >
          <IconFermer className="h-4 w-4" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
