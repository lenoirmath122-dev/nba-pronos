import Link from "next/link";

// Nav RÉDUITE (0.2.9 §3, T6a §3.1) : Classement · Bracket · Se connecter.
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <nav className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">NBA Pronos</span>
        <div className="flex gap-4 text-sm">
          <Link href="/leaderboard">Classement</Link>
          <Link href="/bracket">Bracket</Link>
          <Link href="/login">Se connecter</Link>
        </div>
      </nav>
      {children}
    </>
  );
}
