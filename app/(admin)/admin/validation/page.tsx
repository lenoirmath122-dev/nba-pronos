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

type SearchParams = { validationError?: string; betId?: string };

export default async function AdminValidationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [bets, autoValidatedBets] = await Promise.all([getPendingValidationBets(), getAutoValidatedBets()]);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Validation des paris</h1>

      {bets.length === 0 ? (
        <p className={styles.empty}>Rien à valider pour le moment.</p>
      ) : (
        <ul className={styles.list}>
          {bets.map((bet) => (
            <ValidationBetCard
              key={bet.betId}
              bet={bet}
              error={sp.betId === bet.betId ? sp.validationError : undefined}
            />
          ))}
        </ul>
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
        </>
      )}
    </div>
  );
}
