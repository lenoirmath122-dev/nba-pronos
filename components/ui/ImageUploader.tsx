"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { ImageActionResult } from "@/lib/actions/images";
import styles from "./ImageUploader.module.css";

// Choix d'une image (PNG/JPEG/WebP) : réduite dans le navigateur (canvas) avant
// l'envoi, pour rester sous la limite de corps des server actions ; le serveur
// la revalide et la recompresse de toute façon (lib/images/processImage.ts).
type ImageUploaderProps = {
  /** Image actuelle (null : aperçu de repli). */
  currentUrl: string | null;
  /** Aperçu quand il n'y a pas d'image (initiales, pastille...). */
  fallback: React.ReactNode;
  shape: "round" | "square";
  label: string;
  upload: (formData: FormData) => Promise<ImageActionResult>;
  remove?: () => Promise<ImageActionResult>;
  /** Côté maximal de l'image envoyée. */
  maxSide?: number;
};

const VIEW = 280; // côté (px) de la zone de recadrage affichée
const MAX_ZOOM = 4;

type Crop = { zoom: number; x: number; y: number }; // x,y : décalage du centre de l'image (px de la zone)

// Garde l'image couvrant toute la zone : pas de bord vide.
function clampCrop(crop: Crop, w: number, h: number): Crop {
  const base = VIEW / Math.min(w, h);
  const maxX = Math.max(0, (w * base * crop.zoom - VIEW) / 2);
  const maxY = Math.max(0, (h * base * crop.zoom - VIEW) / 2);
  return {
    zoom: crop.zoom,
    x: Math.min(maxX, Math.max(-maxX, crop.x)),
    y: Math.min(maxY, Math.max(-maxY, crop.y)),
  };
}

// Rend la zone visible en image carrée de côté `size` (déjà réduite : sous la limite des server actions).
async function renderCrop(
  bitmap: ImageBitmap,
  crop: Crop,
  size: number,
): Promise<Blob> {
  const base = VIEW / Math.min(bitmap.width, bitmap.height);
  const k = (size / VIEW) * base * crop.zoom;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const dw = bitmap.width * k;
  const dh = bitmap.height * k;
  canvas
    .getContext("2d")!
    .drawImage(
      bitmap,
      size / 2 + (crop.x * size) / VIEW - dw / 2,
      size / 2 + (crop.y * size) / VIEW - dh / 2,
      dw,
      dh,
    );
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas"))),
      "image/png",
    ),
  );
}

export function ImageUploader({
  currentUrl,
  fallback,
  shape,
  label,
  upload,
  remove,
  maxSide = 512,
}: ImageUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{
    bitmap: ImageBitmap;
    src: string;
  } | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(
    null,
  );

  function run(task: () => Promise<ImageActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setError("Format accepté : PNG, JPEG ou WebP.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      setCrop({ zoom: 1, x: 0, y: 0 });
      // data: URL (et non blob:) : la CSP n'autorise que 'self', data: et https: pour les images.
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setEditing({ bitmap, src });
    } catch {
      setError("Image illisible.");
    }
  }

  function closeEditor() {
    editing?.bitmap.close();
    setEditing(null);
  }

  async function confirmCrop() {
    if (!editing) return;
    try {
      const blob = await renderCrop(editing.bitmap, crop, maxSide);
      const formData = new FormData();
      formData.set(
        "file",
        new File([blob], "image.png", { type: "image/png" }),
      );
      closeEditor();
      run(() => upload(formData));
    } catch {
      closeEditor();
      setError("Image illisible.");
    }
  }

  function setZoom(zoom: number) {
    if (!editing) return;
    setCrop((c) =>
      clampCrop({ ...c, zoom }, editing.bitmap.width, editing.bitmap.height),
    );
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: crop.x, y: crop.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !editing) return;
    setCrop((c) =>
      clampCrop(
        { ...c, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py },
        editing.bitmap.width,
        editing.bitmap.height,
      ),
    );
  }

  return (
    <div className={styles.wrap}>
      <span
        className={`${styles.preview} ${shape === "round" ? styles.round : styles.square}`}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className={styles.img} />
        ) : (
          fallback
        )}
      </span>
      <div className={styles.actions}>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={onPick}
        />
        <button
          type="button"
          className={styles.button}
          disabled={pending}
          onClick={() => inputRef.current?.click()}
        >
          {pending ? "Envoi…" : label}
        </button>
        {remove && currentUrl && (
          <button
            type="button"
            className={styles.link}
            disabled={pending}
            onClick={() => run(remove)}
          >
            Retirer
          </button>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
      {editing &&
        createPortal(
          <div
            className={styles.overlay}
            role="dialog"
            aria-modal="true"
            aria-label="Recadrer l'image"
          >
            <div className={styles.dialog}>
              <div
                className={`${styles.stage} ${shape === "round" ? styles.round : styles.square}`}
                style={{ width: VIEW, height: VIEW }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onWheel={(e) =>
                  setZoom(
                    Math.min(MAX_ZOOM, Math.max(1, crop.zoom - e.deltaY / 500)),
                  )
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editing.src}
                  alt=""
                  draggable={false}
                  className={styles.cropImg}
                  style={{
                    width:
                      editing.bitmap.width *
                      (VIEW /
                        Math.min(editing.bitmap.width, editing.bitmap.height)) *
                      crop.zoom,
                    height:
                      editing.bitmap.height *
                      (VIEW /
                        Math.min(editing.bitmap.width, editing.bitmap.height)) *
                      crop.zoom,
                    transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`,
                  }}
                />
              </div>
              <label className={styles.zoom}>
                <span>Zoom</span>
                <input
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={crop.zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </label>
              <p className={styles.hint}>
                Glisse l&apos;image pour la recentrer.
              </p>
              <div className={styles.dialogActions}>
                <button
                  type="button"
                  className={styles.link}
                  onClick={closeEditor}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={confirmCrop}
                >
                  Valider
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
