package com.boutique.backend.service;

import com.boutique.backend.config.BoutiqueProperties;
import com.boutique.backend.dto.TicketPdf;
import com.boutique.backend.exception.RessourceIntrouvableException;
import com.boutique.backend.model.Achat;
import com.boutique.backend.model.LigneAchat;
import com.boutique.backend.repository.AchatRepository;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Génère le ticket de caisse d'un achat au format PDF, au gabarit d'une
 * imprimante thermique 58 mm.
 */
@Service
public class TicketService {

    /** 58 mm convertis en points PostScript (72 points par pouce). */
    private static final float LARGEUR = 58f / 25.4f * 72f;
    private static final float MARGE = 6f;
    private static final float TAILLE_POLICE = 7.5f;
    private static final float INTERLIGNE = 9.5f;
    /** Nombre de caractères Courier tenant entre les marges, à cette taille. */
    private static final int COLONNES = 32;

    private static final DateTimeFormatter HORODATAGE =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final AchatRepository achatRepository;
    private final BoutiqueProperties boutique;

    public TicketService(AchatRepository achatRepository, BoutiqueProperties boutique) {
        this.achatRepository = achatRepository;
        this.boutique = boutique;
    }

    @Transactional(readOnly = true)
    public TicketPdf ticketPdf(Long achatId) {
        Achat achat = achatRepository.findWithLignesById(achatId)
                .orElseThrow(() -> RessourceIntrouvableException.de("Achat", achatId));
        return new TicketPdf("ticket-" + achat.getNumero() + ".pdf", dessiner(composer(achat)));
    }

    /** Construit les lignes de texte du ticket, dans l'ordre d'impression. */
    private java.util.List<String> composer(Achat achat) {
        java.util.List<String> lignes = new java.util.ArrayList<>();

        lignes.add(centrer(boutique.nom()));
        if (boutique.adresse() != null && !boutique.adresse().isBlank()) {
            lignes.add(centrer(boutique.adresse()));
        }
        if (boutique.telephone() != null && !boutique.telephone().isBlank()) {
            lignes.add(centrer("Tel. " + boutique.telephone()));
        }
        lignes.add(separateur('='));

        lignes.add(deuxColonnes("Ticket", achat.getNumero()));
        lignes.add(deuxColonnes("Date", achat.getDateAchat().format(HORODATAGE)));
        lignes.add(deuxColonnes("Vendeur",
                achat.getVendeur().getPrenom() + " " + achat.getVendeur().getNom()));
        if (achat.getNomClient() != null && !achat.getNomClient().isBlank()) {
            lignes.add(deuxColonnes("Client", achat.getNomClient()));
        }
        lignes.add(separateur('-'));

        for (LigneAchat ligne : achat.getLignes()) {
            lignes.add(tronquer(ligne.getNomProduit()));
            String detail = "  %d x %s".formatted(ligne.getQuantite(),
                    montant(ligne.getPrixUnitaire()));
            lignes.add(deuxColonnes(detail, montant(ligne.getMontantLigne())));
        }
        lignes.add(separateur('-'));

        lignes.add(deuxColonnes("TOTAL " + boutique.devise(), montant(achat.getMontantTotal())));
        lignes.add(separateur('='));
        lignes.add("");
        lignes.add(centrer("Merci de votre visite !"));

        return lignes;
    }

    private byte[] dessiner(java.util.List<String> lignes) {
        float hauteur = 2 * MARGE + lignes.size() * INTERLIGNE;

        try (PDDocument document = new PDDocument();
             ByteArrayOutputStream sortie = new ByteArrayOutputStream()) {

            PDPage page = new PDPage(new PDRectangle(LARGEUR, hauteur));
            document.addPage(page);

            PDType1Font police = new PDType1Font(Standard14Fonts.FontName.COURIER);
            try (PDPageContentStream contenu = new PDPageContentStream(document, page)) {
                contenu.beginText();
                contenu.setFont(police, TAILLE_POLICE);
                contenu.setLeading(INTERLIGNE);
                contenu.newLineAtOffset(MARGE, hauteur - MARGE - TAILLE_POLICE);
                for (String ligne : lignes) {
                    contenu.showText(ligne);
                    contenu.newLine();
                }
                contenu.endText();
            }

            document.save(sortie);
            return sortie.toByteArray();
        } catch (IOException exception) {
            throw new UncheckedIOException("Génération du ticket PDF impossible", exception);
        }
    }

    /** Montant sans décimales, séparateur d'espace : 18 500. */
    private String montant(BigDecimal valeur) {
        DecimalFormatSymbols symboles = new DecimalFormatSymbols(Locale.FRANCE);
        symboles.setGroupingSeparator(' ');
        return new DecimalFormat("#,##0", symboles).format(valeur);
    }

    /** Libellé à gauche, valeur alignée à droite sur {@value #COLONNES} colonnes. */
    private String deuxColonnes(String gauche, String droite) {
        int place = COLONNES - droite.length() - 1;
        String libelle = gauche.length() > place ? gauche.substring(0, Math.max(place, 0)) : gauche;
        int remplissage = COLONNES - libelle.length() - droite.length();
        return libelle + " ".repeat(Math.max(remplissage, 1)) + droite;
    }

    private String centrer(String texte) {
        String coupe = tronquer(texte);
        int marge = (COLONNES - coupe.length()) / 2;
        return " ".repeat(Math.max(marge, 0)) + coupe;
    }

    private String separateur(char caractere) {
        return String.valueOf(caractere).repeat(COLONNES);
    }

    private String tronquer(String texte) {
        return texte.length() > COLONNES ? texte.substring(0, COLONNES) : texte;
    }
}
