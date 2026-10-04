import { FournisseurSession } from "@/components/auth/session";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { NavMobile } from "@/components/nav-mobile";

export default function AppLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    // Le fournisseur enveloppe toute la section : la barre latérale et la
    // barre haute affichent l'utilisateur connecté, et rien ne s'affiche
    // avant que le jeton ait été validé par `GET /api/auth/moi`.
    <FournisseurSession>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {/* pb-20 réserve la hauteur de la barre d'onglets mobile */}
          <main className="min-w-0 flex-1 px-4 pt-5 pb-20 sm:px-6 sm:pt-6 lg:pb-6">
            {children}
          </main>
        </div>
        <NavMobile />
      </div>
    </FournisseurSession>
  );
}
