import { ImageResponse } from "next/og";
import { getGuestMatch } from "@/lib/guest/query";
import { dayTimeLabel } from "@/lib/publicHome/labels";

// Image d'aperçu 1200x630 du match (partage Instagram, WhatsApp, X). Texte
// seul, police par défaut : rien à charger, donc rapide et sans panne réseau.
export const alt = "Pronostic du match sur Panier Ballon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 300;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getGuestMatch(id);
  const home = detail?.match.home;
  const away = detail?.match.away;
  const when = detail ? dayTimeLabel(detail.match.scheduledAt, detail.nowMs) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "#0b1220",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, color: "#ff7a1a", fontWeight: 700 }}>PANIER BALLON</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800 }}>
            {home ? `${home.name} – ${away?.name}` : "Pronostics NBA"}
          </div>
          {when ? <div style={{ display: "flex", fontSize: 40, color: "#cbd5e1" }}>{when}</div> : null}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#cbd5e1" }}>Pronostique gratuitement, sans argent réel.</div>
      </div>
    ),
    size,
  );
}
