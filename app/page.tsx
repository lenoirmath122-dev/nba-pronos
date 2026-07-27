import { redirect } from "next/navigation";

// Route racine jamais câblée depuis la création du projet (scaffold
// create-next-app laissé tel quel) : redirige vers /login, qui renvoie
// lui-même vers /home si une session est déjà active (proxy.ts).
export default function Home() {
  redirect("/login");
}
