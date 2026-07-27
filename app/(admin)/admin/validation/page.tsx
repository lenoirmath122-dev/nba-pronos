import { getPendingValidationBets } from "@/lib/queries/admin-validation";
import { ValidationBetCard } from "@/components/admin/ValidationBetCard";
import styles from "./page.module.css";

// File de validation admin (SPEC_ECRAN_ADMIN_VALIDATION_V0_1, VALIDÉ) —
// deuxième écran du lot Admin. Composant serveur, aucun "use client" (les
// <select> des cartes fonctionnent nativement, sans JS).

type SearchParams = { validationError?: string; betId?: string };

export default async function AdminValidationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const bets = await getPendingValidationBets();

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
    </div>
  );
}
