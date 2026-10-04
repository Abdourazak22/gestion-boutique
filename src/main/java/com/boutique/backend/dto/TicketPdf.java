package com.boutique.backend.dto;

/** Ticket de caisse rendu : nom de fichier proposé et contenu PDF. */
public record TicketPdf(String nomFichier, byte[] contenu) {
}
