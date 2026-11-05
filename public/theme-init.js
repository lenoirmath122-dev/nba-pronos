// Applique le thème mémorisé (cookie pb-theme = "THEME.FOND") avant le premier
// rendu, pour que les pages servies depuis le cache n'affichent pas le thème
// par défaut une fraction de seconde. Même règles que themeAttributes()
// (lib/theme/cookie.ts) -- test lib/theme/cookie.test.ts.
(function () {
  try {
    var m = document.cookie.match(/(?:^|;\s*)pb-theme=(LIGHT|DARK|PHOTO)\.(MURAL|HOOP|HK)(?:;|$)/);
    if (!m) return;
    var h = document.documentElement;
    if (m[1] === "LIGHT") {
      h.setAttribute("data-theme", "light");
    } else if (m[1] === "PHOTO") {
      h.setAttribute("data-theme", "photo");
      if (m[2] !== "MURAL") h.setAttribute("data-bg", m[2].toLowerCase());
    }
  } catch {
    // Cookie illisible : on garde le thème par défaut.
  }
})();
