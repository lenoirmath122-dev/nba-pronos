"use client";

import { useRef, useState, useTransition } from "react";
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

async function downscale(file: File, maxSide: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas"))), "image/png"),
  );
}

export function ImageUploader({ currentUrl, fallback, shape, label, upload, remove, maxSide = 512 }: ImageUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
      const blob = await downscale(file, maxSide);
      const formData = new FormData();
      formData.set("file", new File([blob], "image.png", { type: "image/png" }));
      run(() => upload(formData));
    } catch {
      setError("Image illisible.");
    }
  }

  return (
    <div className={styles.wrap}>
      <span className={`${styles.preview} ${shape === "round" ? styles.round : styles.square}`}>
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="" className={styles.img} />
        ) : (
          fallback
        )}
      </span>
      <div className={styles.actions}>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPick} />
        <button type="button" className={styles.button} disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Envoi…" : label}
        </button>
        {remove && currentUrl && (
          <button type="button" className={styles.link} disabled={pending} onClick={() => run(remove)}>
            Retirer
          </button>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
