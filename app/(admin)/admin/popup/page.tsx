import Link from "next/link";
import { getAdminWeeklyPopupPage } from "@/lib/queries/admin-weekly-popup";
import { WeeklyPopupCard } from "@/components/weeklyPopup/WeeklyPopupCard";
import { WeeklyPopupEditor } from "@/components/admin/WeeklyPopupEditor";
import { WeeklyPopupMissingControls, WeeklyPopupTrial } from "@/components/admin/WeeklyPopupControls";
import { isEditable, isPublishable, isRegenerable, isRetractable, isSkippable } from "@/lib/weeklyPopup/edit";
import { doubtReason } from "@/lib/weeklyPopup/notify";
import type { WeeklyPopupStatus, WeeklyPopupWarning } from "@/lib/weeklyPopup/types";
import styles from "./page.module.css";

// Une génération (« Régénérer », « Générer ») est attendue dans la requête de
// cette page : elle partage la durée maximale de la route (Fluid Compute
// actif, 300 s). Littéral exigé par Next ; gardé égal à ROUTE_MAX_DURATION_S
// par `lib/weeklyPopup/maxDuration.test.ts`.
export const maxDuration = 300;

// Popup hebdomadaire (lot 5, PR 4, plan §5.1) : relecture, retouche, publication.
// Composant serveur ; les feuilles « use client » sont l'éditeur et les gestes
// d'une semaine sans brouillon. Tout texte de joueur est rendu en nœuds React.

const STATUS_LABEL: Record<WeeklyPopupStatus, string> = {
  GENERATING: "Génération en cours",
  READY: "Prêt à relire",
  DOUBTFUL: "Bloqué",
  PUBLISHED: "Publié",
  SKIPPED: "Écarté",
  RETRACTED: "Retiré",
};

const BLOC_LABEL: Record<string, string> = {
  top: "Top",
  flop: "Flop",
  refuse: "La zone Maïno",
  champion: "Champion",
};

const frenchDate = (dateKey: string) => `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;

function describeWarning(w: WeeklyPopupWarning): string {
  return `${w.code}${w.bloc ? ` (${w.bloc})` : ""}${w.detail ? ` : ${w.detail}` : ""}`;
}

export default async function AdminPopupPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const sp = await searchParams;
  const data = await getAdminWeeklyPopupPage(sp.semaine);
  const { competition, popup } = data;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Popup hebdo</h1>

      {!competition ? (
        <p className={styles.empty}>Aucune compétition en cours.</p>
      ) : (
        <>
          <p className={styles.meta}>
            {competition.name} · semaine close le {frenchDate(data.weekEnd)}
            {data.weekEnd !== data.currentWeekEnd && (
              <>
                {" "}
                (<Link href="/admin/popup">revenir à la dernière semaine</Link>)
              </>
            )}
          </p>
          <p className={data.spendUsd >= data.capUsd || !Number.isFinite(data.spendUsd) ? styles.spendHigh : styles.meta}>
            Dépense IA du jour (popup) :{" "}
            {Number.isFinite(data.spendUsd)
              ? `${data.spendUsd.toFixed(2)} $ / ${data.capUsd} $`
              : "lecture impossible (plafond fermé)"}
          </p>

          {competition.weeklyPopup === null && (
            <p className={styles.notice}>Indisponible : la migration 20261013090000 n&apos;est pas encore poussée.</p>
          )}
          {competition.weeklyPopup === false && (
            <p className={styles.notice}>
              La popup n&apos;est pas activée sur la compétition : aucun brouillon n&apos;est généré tout seul. Interrupteur
              dans <Link href="/admin/competitions">Compétitions</Link>.
            </p>
          )}

          {popup === null ? (
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Aucune popup pour cette semaine</h2>
              {data.weekFrozen ? (
                <>
                  <p className={styles.meta}>
                    La semaine est figée mais aucun brouillon n&apos;existe : génère-le, ou écarte la popup pour pouvoir
                    envoyer le récap sans elle.
                  </p>
                  <WeeklyPopupMissingControls weekEnd={data.weekEnd} popupEnabled={competition.weeklyPopup === true} />
                </>
              ) : (
                <p className={styles.meta}>La semaine n&apos;est pas figée : fige-la d&apos;abord dans Compétitions.</p>
              )}
            </section>
          ) : (
            <>
              <section className={styles.card}>
                <div className={styles.statusRow}>
                  <span className={`${styles.badge} ${styles[`badge${popup.row.status}`]}`}>
                    {STATUS_LABEL[popup.row.status]}
                  </span>
                  {popup.row.kind === "FALLBACK" && <span className={styles.badgeKind}>Texte de repli</span>}
                  {popup.row.status === "PUBLISHED" && (
                    <span className={styles.meta}>
                      vu par {popup.views} joueur{popup.views > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {popup.row.status === "DOUBTFUL" && (
                  <p className={styles.alert}>
                    Génération bloquée : {doubtReason(popup.row.doubt_code)}
                    {popup.row.doubt_detail ? ` — ${popup.row.doubt_detail}` : ""}. Régénère, ou rédige le texte à la
                    main.
                  </p>
                )}
                {popup.row.status === "GENERATING" && (
                  <p className={styles.meta}>
                    {popup.generationStale
                      ? "La génération semble abandonnée (plus de 10 min) : tu peux la relancer."
                      : "Une génération est en cours : recharge la page dans un instant."}
                  </p>
                )}
                <p className={styles.meta}>
                  Tentatives : {popup.attemptCount} · coût cumulé {popup.attemptsCostUsd.toFixed(3)} $ · génération n°
                  {popup.row.generation_count}
                  {popup.row.prompt_version ? ` · ${popup.row.prompt_version}` : ""}
                </p>
              </section>

              {popup.blocking.length > 0 && (
                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>Bloque la publication</h2>
                  <ul className={styles.list}>
                    {popup.blocking.map((w, index) => (
                      <li key={`${w.code}-${index}`} className={styles.alertItem}>
                        {describeWarning(w)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {popup.warnings.length > 0 && (
                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>Avertissements</h2>
                  <ul className={styles.list}>
                    {popup.warnings.map((w, index) => (
                      <li key={`${w.code}-${index}`} className={styles.meta}>
                        {describeWarning(w)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {popup.preview && popup.preview.titre !== "" && (
                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>Aperçu joueur</h2>
                  <p className={styles.previewTitle}>{popup.preview.titre}</p>
                  <WeeklyPopupCard popup={popup.preview} />
                </section>
              )}

              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>Texte</h2>
                <WeeklyPopupEditor
                  key={`${popup.row.id}:${popup.row.updated_at}:${popup.row.status}`}
                  popupId={popup.row.id}
                  fields={popup.editor}
                  repli={popup.row.content?.repli ?? null}
                  canEdit={isEditable(popup.row.status)}
                  canPublish={isPublishable(popup.row.status) && popup.row.content !== null}
                  canSkip={isSkippable(popup.row.status)}
                  canRetract={isRetractable(popup.row.status)}
                  canRegenerate={
                    isRegenerable(popup.row.status) &&
                    (popup.row.status !== "GENERATING" || popup.generationStale)
                  }
                  blockedByChecks={popup.blocking.length > 0}
                />
              </section>

              {popup.candidates.length > 0 && (
                <section className={styles.card}>
                  <h2 className={styles.sectionTitle}>Candidats ({popup.candidates.length})</h2>
                  <ul className={styles.candidates}>
                    {popup.candidates.map((c) => (
                      <li key={c.shortId} className={c.verdict === "bloque" ? styles.candidateBlocked : styles.candidate}>
                        <p className={styles.candidateHead}>
                          <strong>{c.shortId}</strong> · {BLOC_LABEL[c.bloc] ?? c.bloc} · {c.pseudo}
                          {c.cited ? " · cité" : ""}
                          {c.citeRecemment ? " · cité récemment" : ""}
                        </p>
                        <p className={styles.candidateText}>{c.texte}</p>
                        <p className={styles.meta}>
                          {c.match ? `${c.match} · ` : ""}
                          {c.chancePct !== null ? `${c.chancePct} % · ` : ""}
                          {c.sens && c.seuil !== null ? `${c.sens} ${c.seuil} · ` : ""}
                          {c.verdict === "bloque" ? `bloqué (${c.categorie ?? "doute"})` : c.verdict === "ok" ? "ok" : "sans verdict"}
                          {c.raison ? ` · ${c.raison}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {popup.row.raw_output && (
                <details className={styles.card}>
                  <summary className={styles.sectionTitle}>Sortie brute (invalide)</summary>
                  <pre className={styles.raw}>{popup.row.raw_output}</pre>
                </details>
              )}
            </>
          )}

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Essai</h2>
            <p className={styles.meta}>
              Exécute tout le pipeline sur la dernière semaine close sans rien enregistrer. Appel payant : un clic, un
              coût.
            </p>
            <WeeklyPopupTrial weekEnd={data.currentWeekEnd} />
          </section>

          {data.history.length > 0 && (
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Semaines précédentes</h2>
              <ul className={styles.list}>
                {data.history.map((item) => (
                  <li key={item.id}>
                    <Link href={`/admin/popup?semaine=${item.weekEnd}`}>
                      Semaine du {frenchDate(item.weekEnd)}
                    </Link>{" "}
                    <span className={styles.meta}>
                      — {STATUS_LABEL[item.status]}
                      {item.kind === "FALLBACK" ? " (repli)" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
