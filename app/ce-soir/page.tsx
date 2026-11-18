import { redirect } from "next/navigation";
import { getGuestMatchList } from "@/lib/guest/query";

// Lien court pour la bio et les stories Instagram : mène au prochain match (ou
// à celui en cours). Sans match à venir : liste des matchs. Les paramètres
// (src, utm_*) sont conservés pour la mesure.
export const revalidate = 60;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TonightPage({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first && (key === "src" || key === "focus" || key.startsWith("utm_"))) qs.set(key, first);
  }
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  const { upcoming } = await getGuestMatchList();
  redirect(upcoming[0] ? `/match/${upcoming[0].id}${suffix}` : `/matchs${suffix}`);
}
