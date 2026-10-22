import { getAdminDashboardData } from "@/lib/queries/admin-dashboard";
import { AdminAlert, AdminLinkList, type AdminLinkEntry } from "@/components/admin/AdminLinkList";
import styles from "@/components/admin/AdminHub.module.css";

// Rubrique « À traiter » : seules les files non vides, plus les deux alertes
// (joueur non identifié, popup bloquée). Les compteurs viennent de
// getAdminDashboardData() -- le même total alimente le badge de l'accueil.

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export default async function AdminTodoPage() {
  const data = await getAdminDashboardData();

  const queues: AdminLinkEntry[] = [
    {
      href: "/admin/validation",
      count: data.pendingValidationCount,
      label: plural(data.pendingValidationCount, "pari à valider", "paris à valider"),
    },
    {
      href: "/admin/resolution",
      count: data.pendingResolutionCount,
      label: plural(data.pendingResolutionCount, "pari à résoudre", "paris à résoudre"),
    },
    {
      href: "/admin/requests",
      count: data.pendingRequestsCount,
      label: plural(data.pendingRequestsCount, "requête en attente", "requêtes en attente"),
    },
    {
      href: "/admin/pseudo",
      count: data.pendingPseudoCount,
      label: plural(
        data.pendingPseudoCount,
        "changement de pseudo à valider",
        "changements de pseudo à valider"
      ),
    },
    {
      href: "/admin/popup",
      count: data.weeklyPopupPendingCount,
      label: plural(data.weeklyPopupPendingCount, "popup hebdo à relire", "popups hebdo à relire"),
    },
    {
      href: "/admin/bug-reports",
      count: data.openBugReportsCount,
      label: plural(data.openBugReportsCount, "signalement ouvert", "signalements ouverts"),
    },
    {
      href: "/admin/chat-reports",
      count: data.openChatReportsCount,
      label: plural(data.openChatReportsCount, "signalement de chat ouvert", "signalements de chat ouverts"),
    },
  ];
  const pending = queues.filter((queue) => (queue.count ?? 0) > 0);
  const nothing = pending.length === 0 && data.unidentifiedPlayerCount === 0 && data.weeklyPopupDoubtful === 0;

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>À traiter</h2>

      {nothing && <p className={styles.empty}>Rien à traiter, tout est à jour.</p>}

      {pending.length > 0 && <AdminLinkList entries={pending} />}

      {/* p3-14 : paris calculables dont le joueur n'a jamais été identifié --
          parmi les paris à résoudre, mis en avant parce que la résolution
          automatique peut ne jamais les trancher. */}
      {data.unidentifiedPlayerCount > 0 && (
        <AdminAlert href="/admin/resolution">
          {data.unidentifiedPlayerCount > 1
            ? `${data.unidentifiedPlayerCount} paris à résoudre visent un joueur non identifié`
            : "1 pari à résoudre vise un joueur non identifié"}
        </AdminAlert>
      )}

      {/* Popup hebdo (lot 5) : une génération bloquée n'attend pas seule. */}
      {data.weeklyPopupDoubtful > 0 && (
        <AdminAlert href="/admin/popup">
          {data.weeklyPopupDoubtful > 1
            ? `${data.weeklyPopupDoubtful} popups hebdo bloquées : à régénérer ou à rédiger`
            : "1 popup hebdo bloquée : à régénérer ou à rédiger"}
        </AdminAlert>
      )}
    </div>
  );
}
