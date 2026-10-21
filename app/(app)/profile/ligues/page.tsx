import { getMyLeagues } from "@/lib/queries/leagues";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { LeaguesSection } from "@/components/profile/LeaguesSection";

export default async function LeaguesPage({
  searchParams,
}: {
  searchParams: Promise<{ leagueError?: string; leagueJoined?: string; newLeagueName?: string; newLeagueCode?: string }>;
}) {
  const sp = await searchParams;
  const leagues = await getMyLeagues();
  return (
    <SubPageShell title="Ligues">
      <LeaguesSection
        leagues={leagues}
        error={sp.leagueError}
        joinedName={sp.leagueJoined}
        newLeagueName={sp.newLeagueName}
        newLeagueCode={sp.newLeagueCode}
      />
    </SubPageShell>
  );
}
