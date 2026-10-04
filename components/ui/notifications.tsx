"use client";

import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { consommerMessageDiffere } from "@/lib/messages-differes";
import { notifier } from "@/lib/notifier";

/**
 * Hôte des notifications, monté une seule fois dans le layout racine : les
 * toasts survivent ainsi aux navigations entre pages.
 *
 * Il affiche aussi, au montage, le message laissé par la page précédente —
 * typiquement « session plus valide », émis juste avant un rechargement complet.
 */
export function Notifications() {
  useEffect(() => {
    const message = consommerMessageDiffere();
    if (!message) return;
    if (message.ton === "succes") notifier.succes(message.texte);
    else notifier.erreur(message.texte);
  }, []);

  return (
    <Toaster
      position="top-right"
      gutter={10}
      toastOptions={{
        // Les couleurs de la librairie ignorent les jetons de la charte :
        // on les remplace par ceux de `globals.css`.
        style: {
          background: "var(--color-surface)",
          color: "var(--color-ink)",
          border: "1px solid var(--color-line)",
          borderRadius: "0.625rem",
          boxShadow: "0 8px 24px rgba(11, 11, 11, 0.12)",
          fontSize: "13px",
          maxWidth: "22rem",
        },
        success: {
          iconTheme: {
            primary: "var(--color-brand-500)",
            secondary: "var(--color-surface)",
          },
        },
        error: {
          iconTheme: {
            primary: "var(--color-critical)",
            secondary: "var(--color-surface)",
          },
        },
      }}
    />
  );
}
