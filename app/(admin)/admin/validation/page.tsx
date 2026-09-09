import Link from "next/link";
import { getPendingValidationBets, getAutoValidatedBets } from "@/lib/queries/admin-validation";
import { ValidationBetCard } from "@/components/admin/ValidationBetCard";
import { AutoValidatedBetCard } from "@/components/admin/AutoValidatedBetCard";
import styles from "./page.module.css";

// File de validation admin (SPEC_ECRAN_ADMIN_VALIDATION_V0_1, VALIDÉ) —
// deuxième écran du lot Admin. Composant serveur, aucun "use client" (les
// <select> des cartes fonctionnent nativement, sans JS).
//
// 2e section ajoutée le 21/08/2026 (Phase 5 Data NBA) : les paris
// auto-validés par l'IA ne passent plus par la file ci-dessus (voir
// update_bet_structuration) -- listés séparément, seule action possible :
// corriger la difficulté après coup.
//
// p1-22 (feuille de route Phase 1) : 2 files sur ce même écran, donc 2
// paramètres de page indépendants (pv/pav) -- paginer l'une ne doit pas
// affecter la position de l'autre.

type SearchParams = { validationError?: string; betId?: string; pv?: string; pav?: string };

export default async function AdminValidationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const pvPage = Math.max(1, Number(sp.pv) || 1);
  const pavPage = Math.max(1, Number(sp.pav) || 1);
  const [{ bets, hasMore }, { bets: autoValidatedBets, hasMore: autoHasMore }] = await Promise.all([
    getPendingValidationBets(pvPage),
    getAutoValidatedBets(pavPage),
  ]);

  const pvLink = (targetPage: number) => {
    const params = new URLSearchParams();
    if (targetPage > 1) params.set("pv", String(targetPage));
    if (pavPage > 1) params.set("pav", String(pavPage));
    const qs = params.toString();
    return qs ? `/admin/validation?${qs}` : "/admin/validation";
  };
  const pavLink = (targetPage: number) => {
    const params = new URLSearchParams();
    if (pvPage > 1) params.set("pv", String(pvPage));
    if (targetPage > 1) params.set("pav", String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/validation?${qs}` : "/admin/validation";
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Validation des paris</h1>

      {bets.length === 0 ? (
        <p className={styles.empty}>Rien à valider pour le moment.</p>
      ) : (
        <>
          <ul className={styles.list}>
            {bets.map((bet) => (
              <ValidationBetCard
                key={bet.betId}
                bet={bet}
                error={sp.betId === bet.betId ? sp.validationError : undefined}
              />
            ))}
          </ul>

          {(pvPage > 1 || hasMore) && (
            <nav className={styles.pagination} aria-label="Pagination de la file de validation">
              {pvPage > 1 ? (
                <Link href={pvLink(pvPage - 1)} className={styles.pageLink}>
                  ← Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className={styles.pageNum}>Page {pvPage}</span>
              {hasMore ? (
                <Link href={pvLink(pvPage + 1)} className={styles.pageLink}>
                  Suivant →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}

      {autoValidatedBets.length > 0 && (
        <>
          <h2 className={styles.title}>Auto-validés par l&apos;IA</h2>
          <ul className={styles.list}>
            {autoValidatedBets.map((bet) => (
              <AutoValidatedBetCard
                key={bet.betId}
                bet={bet}
                error={sp.betId === bet.betId ? sp.validationError : undefined}
              />
            ))}
          </ul>

          {(pavPage > 1 || autoHasMore) && (
            <nav className={styles.pagination} aria-label="Pagination des paris auto-validés">
              {pavPage > 1 ? (
                <Link href={pavLink(pavPage - 1)} className={styles.pageLink}>
                  ← Précédent
                </Link>
              ) : (
                <span />
              )}
              <span className={styles.pageNum}>Page {pavPage}</span>
              {autoHasMore ? (
                <Link href={pavLink(pavPage + 1)} className={styles.pageLink}>
                  Suivant →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
