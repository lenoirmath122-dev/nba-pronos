import { PublicNav } from "@/components/nav/PublicNav";

// Nav RÉDUITE (0.2.9 §3, T6a §3.1) : Classement · Bracket · Se connecter.
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PublicNav />
      {children}
    </>
  );
}
