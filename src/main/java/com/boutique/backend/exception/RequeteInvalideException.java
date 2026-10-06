package com.boutique.backend.exception;

import java.util.Map;

/**
 * Requête mal formée au regard d'une règle que les annotations de validation ne
 * savent pas exprimer, parce qu'elle dépend de l'état en base.
 *
 * <p>Exemple : le motif d'un ajustement de stock n'est obligatoire que si le
 * comptage révèle un écart, ce qui ne se sait qu'après lecture du stock
 * courant. Traduite en 400 par le GestionnaireExceptions, et non en 409 : la
 * requête est invalide, l'état des données n'est pas en cause.
 */
public class RequeteInvalideException extends RuntimeException {

    private final Map<String, String> champs;

    public RequeteInvalideException(String message) {
        this(message, Map.of());
    }

    private RequeteInvalideException(String message, Map<String, String> champs) {
        super(message);
        this.champs = champs;
    }

    /**
     * Erreur rattachée à un champ précis, que le frontend affiche sous l'input
     * correspondant au lieu d'un « requête invalide » générique.
     */
    public static RequeteInvalideException surChamp(String champ, String message) {
        return new RequeteInvalideException(message, Map.of(champ, message));
    }

    public Map<String, String> getChamps() {
        return champs;
    }
}
