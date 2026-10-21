import { getCompetitionHistory } from "@/lib/queries/history";
import { SubPageShell } from "@/components/ui/SubPageShell";
import { HistorySection } from "@/components/profile/HistorySection";

export default async function HistoryPage() {
  const history = await getCompetitionHistory();
  return (
    <SubPageShell title="Historique">
      <HistorySection history={history} />
    </SubPageShell>
  );
}
