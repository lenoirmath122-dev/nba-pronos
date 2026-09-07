import Link from "next/link";
import { StatusScreen } from "@/components/ui/StatusScreen";
import styles from "@/components/ui/StatusScreen.module.css";

export default function NotFound() {
  return (
    <StatusScreen title="Page introuvable" message="Cette page n'existe pas ou a été déplacée.">
      <Link href="/home" className={styles.action}>
        Retour à l&apos;accueil
      </Link>
    </StatusScreen>
  );
}
