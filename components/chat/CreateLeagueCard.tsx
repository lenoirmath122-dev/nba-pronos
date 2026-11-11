"use client";

import { useState, useTransition } from "react";
import { ModalDialog } from "@/components/ui/ModalDialog";
import { createLeagueAction, type CreateLeagueResult } from "@/lib/actions/leagues";
import styles from "./CreateLeagueCard.module.css";

// Carte « Créer une ligue » sous la liste des canaux : ouvre une pop-up de
// création, puis propose de copier le lien d'invitation (/rejoindre/<code>)
// ou le code seul.

export function CreateLeagueCard() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [result, setResult] = useState<CreateLeagueResult | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setName("");
    setResult(null);
    setCopied(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setResult(await createLeagueAction(name));
    });
  }

  async function copy(kind: "link" | "code", code: string) {
    const text = kind === "code" ? code : `${window.location.origin}/rejoindre/${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Presse-papiers indisponible : le code reste affiché et sélectionnable.
    }
  }

  return (
    <>
      <button type="button" className={`${styles.card} glass-card`} onClick={() => setOpen(true)}>
        <span className={styles.plus} aria-hidden="true">
          +
        </span>
        Créer une ligue
      </button>
      {open && (
        <ModalDialog title="Créer une ligue" onClose={close}>
          <div className={styles.body}>
            {result?.ok ? (
              <>
                <p>Ligue « {result.name} » créée. Invite tes amis :</p>
                <p className={styles.code}>{result.code}</p>
                <button type="button" className={styles.action} onClick={() => copy("link", result.code)}>
                  {copied === "link" ? "Lien copié ✓" : "Copier le lien d'inscription"}
                </button>
                <button type="button" className={styles.action} onClick={() => copy("code", result.code)}>
                  {copied === "code" ? "Code copié ✓" : "Copier le code de la ligue"}
                </button>
                <button type="button" className={styles.secondary} onClick={close}>
                  Terminé
                </button>
              </>
            ) : (
              <form onSubmit={submit} className={styles.form}>
                <label htmlFor="new-league-name">Nom de la ligue</label>
                <input
                  id="new-league-name"
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  required
                />
                {result && !result.ok && (
                  <p role="alert" className={styles.error}>
                    {result.error}
                  </p>
                )}
                <button type="submit" className={styles.action} disabled={pending || name.trim().length === 0}>
                  {pending ? "Création…" : "Créer"}
                </button>
              </form>
            )}
          </div>
        </ModalDialog>
      )}
    </>
  );
}
