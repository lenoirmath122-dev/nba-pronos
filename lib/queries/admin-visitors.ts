import { getServerClient } from "@/lib/supabase/server";

// Visiteurs uniques (mesure interne, table funnel_events, événement 'visit') :
// un visiteur = un navigateur (cookie pb_vid, 1 an). Un même joueur sur son
// téléphone et son ordinateur compte deux fois ; les admins ne comptent pas.
// Lecture en session admin via la RLS (fonction security invoker), jamais service_role.

export type VisitorCounts = {
  today: number;
  last7Days: number;
  last30Days: number;
  /** Première visite mesurée : avant cette date, les chiffres sont incomplets. */
  firstVisitAt: string | null;
};

type Row = { today: number; last_7_days: number; last_30_days: number; first_visit_at: string | null };

/** null si la lecture échoue (migration pas encore appliquée, par exemple). */
export async function getVisitorCounts(): Promise<VisitorCounts | null> {
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc("funnel_visitor_counts").maybeSingle<Row>();
  if (error || !data) return null;
  return {
    today: data.today,
    last7Days: data.last_7_days,
    last30Days: data.last_30_days,
    firstVisitAt: data.first_visit_at,
  };
}
