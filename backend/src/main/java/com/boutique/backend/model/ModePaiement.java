package com.boutique.backend.model;

/**
 * Moyen par lequel le client a réglé son achat.
 *
 * <p>Les portefeuilles mobiles sont nommés par opérateur plutôt que regroupés
 * sous un « mobile money » générique : au Burkina Faso ce sont deux comptes
 * distincts, rapprochés séparément en fin de journée. Le gérant doit savoir ce
 * qui est dans le tiroir-caisse et ce qui est sur quel téléphone.
 *
 * <p>Le règlement à crédit n'y figure pas : il supposerait un suivi de dette
 * par client, qui n'existe pas encore. Une vente enregistrée ici est une vente
 * encaissée.
 */
public enum ModePaiement {
    ESPECES,
    ORANGE_MONEY,
    MOOV_MONEY,
    CARTE
}
