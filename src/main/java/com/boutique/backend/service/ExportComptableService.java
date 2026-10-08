package com.boutique.backend.service;

import com.boutique.backend.dto.FichierExport;
import com.boutique.backend.dto.PlageDeDates;
import com.boutique.backend.model.Achat;
import com.boutique.backend.model.LigneAchat;
import com.boutique.backend.model.ModePaiement;
import com.boutique.backend.model.MotifAnnulation;
import com.boutique.backend.model.StatutAchat;
import com.boutique.backend.repository.AchatRepository;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Export des ventes au format CSV, destiné à être ouvert dans un tableur.
 *
 * <p>Les choix de format visent un tableur configuré en français, pas un
 * analyseur de données :
 *
 * <ul>
 *   <li>point-virgule en séparateur, parce que la virgule sert de séparateur
 *       décimal dans cette locale ;
 *   <li>virgule décimale, pour que les montants soient reconnus comme des
 *       nombres et non comme du texte ;
 *   <li>marque d'ordre des octets en tête, sans laquelle Excel lit le fichier
 *       en ANSI et affiche « Espèces » en « EspÃ¨ces ».
 * </ul>
 *
 * <p>Les libellés sont définis ici et non sur les énumérations : ce projet
 * garde les noms lisibles au niveau de la présentation, le frontend ayant les
 * siens et {@code TicketService} les siens, en ASCII pour la police du PDF.
 */
@Service
public class ExportComptableService {

    private static final char SEPARATEUR = ';';
    /** Lue par Excel pour reconnaître l'UTF-8. Les autres tableurs l'ignorent. */
    private static final String BOM = "﻿";

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter HEURE = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter JOUR_FICHIER = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final List<String> COLONNES = List.of(
            "Numéro", "Date", "Heure", "Statut", "Mode de paiement",
            "Client", "Téléphone", "Vendeur", "Montant encaissé",
            "Montant annulé", "Marge", "Motif d'annulation", "Annulé par");

    private final AchatRepository achatRepository;

    public ExportComptableService(AchatRepository achatRepository) {
        this.achatRepository = achatRepository;
    }

    /**
     * Toutes les ventes de la période, une ligne par vente.
     *
     * <p>Les ventes annulées y figurent, avec leur statut et leur motif : une
     * comptabilité doit voir ce qui a été annulé, pas seulement ce qui reste.
     * Leur montant va dans sa propre colonne, et leur marge reste vide.
     *
     * <p>Deux colonnes de montant plutôt qu'une, et c'est le point important :
     * additionner « Montant encaissé » donne le chiffre d'affaires, sans avoir
     * à filtrer sur le statut au préalable. Avec une colonne unique, une somme
     * naïve gonflait la recette du montant des ventes annulées. Les totaux
     * obtenus sont ceux du tableau de bord, qui écarte les annulations de son
     * chiffre d'affaires comme de sa marge.
     */
    @Transactional(readOnly = true)
    public FichierExport ventes(LocalDate du, LocalDate au) {
        PlageDeDates plage = PlageDeDates.de(du, au);
        List<Achat> achats = achatRepository
                .findByDateAchatBetween(plage.debut(), plage.fin(),
                        Pageable.unpaged(Sort.by("dateAchat")))
                .getContent();

        StringBuilder csv = new StringBuilder(BOM);
        ligne(csv, COLONNES);
        for (Achat achat : achats) {
            ligne(csv, List.of(
                    achat.getNumero(),
                    achat.getDateAchat().format(DATE),
                    achat.getDateAchat().format(HEURE),
                    libelle(achat.getStatut()),
                    libelle(achat.getModePaiement()),
                    texte(achat.getNomClient()),
                    texte(achat.getTelephoneClient()),
                    nom(achat.getVendeur()),
                    montant(achat.estAnnule() ? null : achat.getMontantTotal()),
                    montant(achat.estAnnule() ? achat.getMontantTotal() : null),
                    montant(achat.estAnnule() ? null : marge(achat)),
                    libelle(achat.getMotifAnnulation()),
                    nom(achat.getAnnulePar())));
        }

        return new FichierExport(nomFichier(du, au),
                csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Marge de la vente : prix de vente moins coût de revient, ligne par ligne.
     *
     * <p>Renvoie {@code null} si une seule ligne ignore son coût d'achat. La
     * colonne reste alors vide, plutôt que d'afficher une marge surévaluée que
     * personne ne saurait reconnaître comme fausse. Le cas existe : la colonne
     * a été ajoutée après les premières ventes.
     */
    private BigDecimal marge(Achat achat) {
        BigDecimal total = BigDecimal.ZERO;
        for (LigneAchat ligne : achat.getLignes()) {
            if (ligne.getPrixAchatUnitaire() == null) {
                return null;
            }
            BigDecimal cout = ligne.getPrixAchatUnitaire()
                    .multiply(BigDecimal.valueOf(ligne.getQuantite()));
            total = total.add(ligne.getMontantLigne().subtract(cout));
        }
        return total;
    }

    private String nomFichier(LocalDate du, LocalDate au) {
        String debut = du != null ? du.format(JOUR_FICHIER) : "debut";
        String fin = au != null ? au.format(JOUR_FICHIER) : "ce-jour";
        return "ventes-%s_%s.csv".formatted(debut, fin);
    }

    private void ligne(StringBuilder csv, List<String> valeurs) {
        for (int i = 0; i < valeurs.size(); i++) {
            if (i > 0) {
                csv.append(SEPARATEUR);
            }
            csv.append(echapper(valeurs.get(i)));
        }
        // Fin de ligne CRLF : c'est ce que la norme du CSV prévoit, et ce
        // qu'attendent les tableurs sous Windows.
        csv.append("\r\n");
    }

    /**
     * Protège une valeur qui contiendrait un séparateur, un guillemet ou un
     * retour à la ligne. Un nom de client comme « Kone; Awa » décalerait sinon
     * toutes les colonnes suivantes.
     */
    private String echapper(String valeur) {
        if (valeur.indexOf(SEPARATEUR) < 0 && valeur.indexOf('"') < 0
                && valeur.indexOf('\n') < 0 && valeur.indexOf('\r') < 0) {
            return valeur;
        }
        return '"' + valeur.replace("\"", "\"\"") + '"';
    }

    private String montant(BigDecimal valeur) {
        return valeur == null ? "" : valeur.toPlainString().replace('.', ',');
    }

    private String texte(String valeur) {
        return valeur == null ? "" : valeur;
    }

    private String nom(com.boutique.backend.model.Utilisateur utilisateur) {
        return utilisateur == null ? ""
                : utilisateur.getPrenom() + " " + utilisateur.getNom();
    }

    private String libelle(StatutAchat statut) {
        return switch (statut) {
            case PAYE -> "Payée";
            case ANNULE -> "Annulée";
        };
    }

    private String libelle(ModePaiement mode) {
        if (mode == null) {
            return "";
        }
        return switch (mode) {
            case ESPECES -> "Espèces";
            case ORANGE_MONEY -> "Orange Money";
            case MOOV_MONEY -> "Moov Money";
            case CARTE -> "Carte";
        };
    }

    private String libelle(MotifAnnulation motif) {
        if (motif == null) {
            return "";
        }
        return switch (motif) {
            case ERREUR_SAISIE -> "Erreur de saisie";
            case RETOUR_CLIENT -> "Retour client";
            case PRODUIT_DEFECTUEUX -> "Produit défectueux";
            case AUTRE -> "Autre";
        };
    }
}
