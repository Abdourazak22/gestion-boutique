import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Notifications } from "@/components/ui/notifications";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "BoutiquePro — Gestion de boutique",
    template: "%s · BoutiquePro",
  },
  description:
    "Logiciel de gestion d'une boutique de produits alimentaires : ventes, livraisons grossistes, stock et utilisateurs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {children}
        {/* Monté à la racine : les toasts traversent les navigations. */}
        <Notifications />
      </body>
    </html>
  );
}
