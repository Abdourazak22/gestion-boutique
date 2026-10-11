package com.boutique.backend.dto;

/** Fichier rendu par un export : nom proposé au téléchargement et contenu. */
public record FichierExport(String nomFichier, byte[] contenu) {
}
