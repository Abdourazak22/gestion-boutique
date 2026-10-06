import { BoutonSecondaire } from "@/components/ui/entete-page";

/**
 * Pied d'une boîte de dialogue contenant un formulaire : renoncer à gauche,
 * soumettre à droite.
 *
 * Les quatre formulaires modaux le recopiaient à l'identique, chaîne de style
 * du bouton comprise. Une copie suffit pour qu'un changement de teinte ou de
 * hauteur de cible n'en oublie pas trois.
 */

/**
 * `disabled:cursor-progress` et non `cursor-not-allowed` comme les boutons
 * d'en-tête : ici désactivé veut dire « envoi en cours », pas « interdit ».
 */
const SOUMETTRE =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-600 disabled:cursor-progress disabled:bg-brand-500/60";

/**
 * Variante destructrice. Elle anime l'opacité et non la couleur : le rouge
 * reste rouge au survol, c'est son intensité qui répond.
 */
const SOUMETTRE_CRITIQUE =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-critical px-4 text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-progress disabled:opacity-60";

export function PiedFormulaire({
  onFermer,
  enCours,
  soumettre,
  enCoursLibelle = "Enregistrement…",
  annuler = "Annuler",
  critique = false,
}: {
  onFermer: () => void;
  enCours: boolean;
  /** Libellé du bouton de soumission au repos. */
  soumettre: string;
  /** Libellé pendant l'envoi. */
  enCoursLibelle?: string;
  annuler?: string;
  /** Action destructrice : bouton rouge. */
  critique?: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-end gap-2 border-t border-line pt-4">
      <BoutonSecondaire onClick={onFermer} disabled={enCours}>
        {annuler}
      </BoutonSecondaire>
      <button
        type="submit"
        disabled={enCours}
        className={critique ? SOUMETTRE_CRITIQUE : SOUMETTRE}
      >
        {enCours ? enCoursLibelle : soumettre}
      </button>
    </div>
  );
}
