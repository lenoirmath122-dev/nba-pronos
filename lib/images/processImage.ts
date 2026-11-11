import sharp from "sharp";

// Traitement serveur des images envoyées (avatar, logo de ligue) : on ne fait
// jamais confiance au fichier reçu. sharp le décode (rejette tout ce qui n'est
// pas PNG/JPEG/WebP), le recadre/redimensionne et le réencode en WebP, ce qui
// retire aussi les métadonnées (EXIF, GPS).
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp"]);

export type ImageKind = "avatar" | "league-logo";

export async function processImage(file: File, kind: ImageKind): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  if (!file || file.size === 0) return { ok: false, error: "Choisis une image." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Image trop lourde (2 Mo maximum)." };

  const input = Buffer.from(await file.arrayBuffer());
  try {
    const meta = await sharp(input).metadata();
    if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) return { ok: false, error: "Format accepté : PNG, JPEG ou WebP." };

    const pipeline =
      kind === "avatar"
        ? sharp(input).rotate().resize(256, 256, { fit: "cover" })
        : sharp(input).rotate().resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
    return { ok: true, buffer: await pipeline.webp({ quality: 85 }).toBuffer() };
  } catch {
    return { ok: false, error: "Image illisible." };
  }
}
