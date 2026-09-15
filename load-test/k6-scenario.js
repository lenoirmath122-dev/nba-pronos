// Test de charge (option 1 révisée) de nba-pronos — mesure la capacité du
// backend Supabase (Postgres + PostgREST + GoTrue) sur un projet cloud DÉDIÉ
// au load test, pas le pipeline complet Next.js/Vercel (cold starts
// serverless etc. : voir option 2, après l'alpha). Local/Docker abandonné
// (BSOD/RAM saturée sur les deux machines, cf. mémoire projet 11/09/2026).
//
// Contourne volontairement les Server Actions Next.js (login/submitBet) —
// elles exigent un captcha Turnstile et un format d'appel propre à Next.js —
// et appelle Supabase directement, comme le ferait l'app :
//   - login      : POST /auth/v1/token?grant_type=password (GoTrue)
//   - lecture    : GET  /rest/v1/... (PostgREST), mêmes tables que
//                  lib/queries/leaderboard.ts
//   - pari       : POST /rest/v1/rpc/save_bet (même RPC que lib/actions/bets.ts,
//                  scope SERIES, brouillon — pas de soumission pour éviter
//                  l'appel IA de structureAndScoreBet, hors périmètre ici)
//
// Prérequis : load-test/users.json et load-test/fixtures.json générés par
// setup.mjs. Voir load-test/README.md pour le mode d'emploi complet.
//
// Lancement : k6 run -e ANON_KEY=sb_publishable_... load-test/k6-scenario.js
// Cible différente : k6 run -e SUPABASE_URL=... -e ANON_KEY=... load-test/k6-scenario.js

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";
import encoding from "k6/encoding";

const PROD_PROJECT_REF = "lcldekiwinggyqgbmlwc";
const SUPABASE_URL = __ENV.SUPABASE_URL ?? "https://kolbvdobcheedswsufgv.supabase.co";
const ANON_KEY = __ENV.ANON_KEY;

if (SUPABASE_URL.includes(PROD_PROJECT_REF)) {
  throw new Error(`Refus : SUPABASE_URL pointe vers le projet de PROD (${SUPABASE_URL}).`);
}
if (!ANON_KEY) {
  throw new Error("ANON_KEY manquante (clé publishable du projet load-test, dashboard Settings > API), passe -e ANON_KEY=...");
}

const users = new SharedArray("users", () => JSON.parse(open("./users.json")));
const fixtures = JSON.parse(open("./fixtures.json"));

const BET_CATEGORIES = [
  "PLAYER_PROP",
  "SCORE_TOTAL",
  "TEAM_PROP",
  "PERIOD",
  "HEAD_TO_HEAD",
  "PLAYING_TIME",
  "MULTI_PLAYER_COMBO",
  "GAME_EVENT",
  "FUN_OFF_COURT",
];

export const options = {
  scenarios: {
    ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 10 },
        { duration: "1m", target: 10 },
        { duration: "30s", target: 25 },
        { duration: "1m", target: 25 },
        { duration: "30s", target: 50 },
        { duration: "1m", target: 50 },
        { duration: "30s", target: 100 },
        { duration: "1m", target: 100 },
        { duration: "30s", target: 200 },
        { duration: "2m", target: 200 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000"],
  },
};

// Persiste pour la durée de vie du VU (goja instancie un runtime JS séparé
// par VU) : login une seule fois, réutilisé sur toutes les itérations.
let session = null; // { token, userId }
let loginAttempted = false; // un seul essai -- pas de retry en boucle (voir default())
let hasSubmittedBet = false;

function decodeUserId(jwt) {
  const payload = JSON.parse(encoding.b64decode(jwt.split(".")[1], "rawurl", "s"));
  return payload.sub;
}

function login() {
  const user = users[(__VU - 1) % users.length];
  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email: user.email, password: user.password }),
    { headers: { "Content-Type": "application/json", apikey: ANON_KEY } },
  );
  check(res, { "login OK": (r) => r.status === 200 });
  if (res.status !== 200) return null;
  const token = res.json("access_token");
  return { token, userId: decodeUserId(token) };
}

function authHeaders(token) {
  return { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// Parcours "consultation" : classement + mes paris, à l'image des requêtes
// de lib/queries/leaderboard.ts (getLeaderboard).
function readLeaderboard(session) {
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${session.token}` };
  const res = http.batch([
    ["GET", `${SUPABASE_URL}/rest/v1/user_scores?select=*&order=total_points.desc&limit=50`, null, { headers }],
    ["GET", `${SUPABASE_URL}/rest/v1/users?select=id,pseudo,avatar_url&limit=50`, null, { headers }],
    [
      "GET",
      `${SUPABASE_URL}/rest/v1/bets?select=id,status,proposed_category&user_id=eq.${session.userId}&limit=20`,
      null,
      { headers },
    ],
  ]);
  res.forEach((r) => check(r, { "lecture OK": (resp) => resp.status === 200 }));
}

// Parcours "écriture" : un pari brouillon SERIES par utilisateur (une seule
// fois par VU — save_bet refuse un 2e pari SERIES actif sur la même série).
function submitDraftBet(session) {
  const category = BET_CATEGORIES[Math.floor(Math.random() * BET_CATEGORIES.length)];
  const res = http.post(
    `${SUPABASE_URL}/rest/v1/rpc/save_bet`,
    JSON.stringify({
      p_bet_id: null,
      p_scope: "SERIES",
      p_series_id: fixtures.seriesId,
      p_match_id: null,
      p_description: "Pari de test (load test local)",
      p_category: category,
      p_difficulty: 1 + Math.floor(Math.random() * 5),
      p_submit: false,
    }),
    { headers: authHeaders(session.token) },
  );
  check(res, { "save_bet OK": (r) => r.status === 200 || r.status === 201 });
}

export default function () {
  if (!session && !loginAttempted) {
    loginAttempted = true;
    session = login();
  }
  // Échec de login : le VU n'insiste pas -- un vrai utilisateur ne spamme pas
  // le bouton toutes les secondes. Réessayer en boucle amplifiait tout 429
  // initial (effet boule de neige constaté au run du 15/09/2026 : 37%
  // d'erreurs alors que la latence, elle, restait excellente).
  if (!session) {
    sleep(2 + Math.random() * 2);
    return;
  }

  readLeaderboard(session);

  if (!hasSubmittedBet) {
    submitDraftBet(session);
    hasSubmittedBet = true;
  }

  sleep(1 + Math.random() * 2);
}
