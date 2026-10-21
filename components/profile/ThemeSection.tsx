import Image from "next/image";
import { updateBackgroundTheme, updateThemePreference } from "@/lib/actions/profile";
import styles from "./profileShared.module.css";

// Options du sélecteur « Thème » (06/08/2026) — Sombre/Clair/Photo, 3 choix
// mutuellement exclusifs depuis la fusion avec l'ancien fond d'écran
// indépendant (migrations 20260806100000/20260806110000).
const THEMES: { value: "DARK" | "LIGHT" | "PHOTO"; label: string }[] = [
  { value: "DARK", label: "Sombre" },
  { value: "LIGHT", label: "Clair" },
  { value: "PHOTO", label: "Photo" },
];

// Options du sous-sélecteur de photo, affiché seulement si le thème Photo
// est actif — miroir de background_theme (enum Postgres, migration
// 20260806090000). Étendre plus tard = 1 nouvel item ici + 1 valeur d'enum +
// 1 override [data-bg="..."] dans app/tokens.css + les 2 assets
// (hero-<x>.jpg, hero-<x>-thumb.jpg).
const BACKGROUND_THEMES: { value: "MURAL" | "HOOP" | "HK"; label: string; thumb: string }[] = [
  { value: "MURAL", label: "Fresque streetball", thumb: "/brand/hero-mural-thumb.jpg" },
  { value: "HOOP", label: "Panier vu du dessus", thumb: "/brand/hero-hoop-thumb.jpg" },
  { value: "HK", label: "Terrain à Hong Kong", thumb: "/brand/hero-hk-thumb.jpg" },
];

type ThemeSectionProps = {
  theme: string;
  backgroundTheme: string;
  error?: string;
};

export function ThemeSection({ theme, backgroundTheme, error }: ThemeSectionProps) {
  return (
    <section className={`${styles.section} glass-card`}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.themePicker}>
        {THEMES.map((t) => {
          const isActive = theme === t.value;
          return (
            <form key={t.value} action={updateThemePreference}>
              <input type="hidden" name="theme" value={t.value} />
              <button
                type="submit"
                className={isActive ? `${styles.themeOption} ${styles.themeOptionActive}` : styles.themeOption}
                aria-pressed={isActive}
                disabled={isActive}
              >
                {t.label}
              </button>
            </form>
          );
        })}
      </div>

      {theme === "PHOTO" && (
        <div className={styles.bgPicker}>
          {BACKGROUND_THEMES.map((bg) => {
            const isActive = backgroundTheme === bg.value;
            return (
              <form key={bg.value} action={updateBackgroundTheme}>
                <input type="hidden" name="backgroundTheme" value={bg.value} />
                <button
                  type="submit"
                  className={isActive ? `${styles.bgOption} ${styles.bgOptionActive}` : styles.bgOption}
                  aria-pressed={isActive}
                  disabled={isActive}
                >
                  <Image src={bg.thumb} alt="" width={96} height={96} unoptimized className={styles.bgThumb} />
                  <span className={styles.bgLabel}>{bg.label}</span>
                </button>
              </form>
            );
          })}
        </div>
      )}
    </section>
  );
}
