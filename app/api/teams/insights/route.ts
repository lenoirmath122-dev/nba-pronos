import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/supabase/server";
import { getTeamInsights } from "@/lib/queries/teamInsights";

// Détail des équipes de l'aide aux débutants (popup « Détail des équipes »).
// Session obligatoire. Pas de rate limit en v1 : stats NBA publiques, lecture
// seule, résultat en cache (étiquette team-insights, 1 h max).
export const runtime = "nodejs";

const querySchema = z.object({
  ids: z
    .string()
    .transform((s) => s.split(",").map((x) => x.trim()))
    .pipe(z.array(z.string().uuid()).min(1).max(2)),
});

export async function GET(request: Request): Promise<Response> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const parsed = querySchema.safeParse({ ids: new URL(request.url).searchParams.get("ids") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: "Paramètre ids invalide." }, { status: 400 });

  try {
    return NextResponse.json(await getTeamInsights(parsed.data.ids));
  } catch {
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
