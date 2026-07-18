# NBA Pronos — SPEC TECHNIQUE T2 — AUTH V0.1

> **Nature** : fichier thématique T2 du découpage acté dans `SPEC_TECHNIQUE_V0.1.md`
> (§4). Couvre l'authentification Supabase : inscription + code compétition,
> pont `auth.users → public.users`, bootstrap admin, rôles/statuts/sessions.
> Ne contient **aucune policy RLS** (→ T3), **aucun écran** (→ T6).
>
> **Dépend de** : T1 (modèle de données, validé). Réutilise des décisions closes :
> C4 (câblage Supabase Auth), 0.2.1 (rôles/statuts/visibilité), arbitrages C
> (`is_admin()` lit `users.role`) et D (`users.id = auth.users.id`), A4 (bootstrap).
>
> **Statut** : **VALIDÉ** avec l'utilisateur le 18/07/2026. Les 6 points ouverts
> (§10) sont actés, dont le choix structurant du pont `auth → users` : **École A
> (trigger `handle_new_user`)**. Prochaine étape : la migration #2, montrée en
> entier avant tout `db push`.
>
> **⚠ Remontée vers T1** : T2 révèle un manque du modèle de données (le code
> compétition n'a pas de colonne). Traité au §5. C'est la seule chose qui touche
> T1 ; elle est signalée, pas décidée en douce.

---

## 0. Résumé du chantier T2

```text
1. Le point qui remonte au modèle : competitions.join_code manquant (C4)  → §5
2. Pont auth.users → public.users : 2 écoles, à trancher                  → §3
3. Flux d'inscription C4 (pseudo+email+password+code, code vérifié serveur) → §4
4. Bootstrap du 1er admin (A4, seed manuel unique)                        → §6
5. Rôles / statuts / sessions (JWT, promotion sans re-login, DISABLED)    → §7
6. Config Supabase Auth (confirmation email, reset password)              → §8
```

Rien à coder tant que T2 n'est pas validé. La migration #2 (et son contenu
exact) **dépend du choix du §3**.

---

## 1. Décisions closes réutilisées (non rouvrables)

| Sujet | Décision | Source |
|---|---|---|
| Identité technique | email = identifiant de connexion Supabase Auth, **privé**, jamais affiché | C4 / D5 |
| Identité publique | pseudo, partout ailleurs | C4 / 0.2.1 §4 |
| Code compétition | **maintenu** ; vérifié **serveur** contre la compétition ACTIVE **avant** création du compte | C4 |
| Inscription | libre (self-service, sans validation admin préalable) → compte **ACTIVE immédiat** | 0.2.1 §1 / C4 |
| Statuts | `ACTIVE` / `DISABLED` ; `PENDING` écarté | 0.2.1 §1 / B1 |
| Rôles | `PLAYER` / `ADMIN` uniquement ; visiteur = non connecté (hors base) | 0.2.1 §2 |
| Admin | = joueur + droits admin (participe ET administre) | 0.2.1 §5 |
| Détection admin | `is_admin()` SECURITY DEFINER STABLE lit `users.role`, **jamais un claim JWT** | arbitrage C |
| PK profil | `public.users.id = auth.users.id` | arbitrage D |
| Bootstrap admin | seed manuel **unique** en migration SQL, **après** inscription du 1er compte | A4 |

> **Réconciliation d'un faux conflit** : 0.2.1 §1 dit « inscription libre » et
> §7 laissait ouvert « faut-il un code compétition malgré l'inscription libre ? ».
> C4 a **tranché : oui, code maintenu**. « Libre » signifie donc *self-service et
> ACTIVE immédiat, sans approbation admin* — mais **porté par un code**. Aucune
> contradiction : C4 est la résolution du point ouvert de 0.2.1 §7.

---

## 2. Modèle d'identité : deux tables, un seul id

```text
auth.users (géré par Supabase Auth)        public.users (T1)
  id            ─────────────────────────►  id  (PK = auth.users.id, D)
  email         (privé, login)              pseudo (public)
  encrypted_pw                              avatar_url, favorite_team_id, bio
  raw_user_meta_data (pseudo au signup)     role, status, theme_preference
  ...                                       created_at, updated_at
```

Conséquences :
- L'**email vit uniquement dans `auth.users`** (D5) — `public.users` n'en a pas.
- Les policies (T3) s'écrivent en `user_id = auth.uid()` **sans jointure**, car
  les deux ids sont égaux (D).
- Le **rôle et le statut vivent dans `public.users`**, pas dans le JWT (arbitrage
  C) → une promotion/désactivation est effective **sans re-login** (§7).

---

## 3. Le pont `auth.users → public.users` — DÉCISION À PRENDRE

Question : quand et comment naît la ligne `public.users` correspondant à un
nouvel `auth.users` ? Dans **les deux écoles**, la vérification du code
compétition et la création de l'`auth.users` se font **avant** dans une server
action (§4) — ce qui diffère, c'est **qui matérialise le profil**.

### École A — Trigger DB `handle_new_user`

Une fonction `SECURITY DEFINER` déclenchée `after insert on auth.users` insère
automatiquement la ligne `public.users` (en lisant le pseudo dans
`raw_user_meta_data`, transmis via `options.data` au `signUp`).

```sql
-- (contenu de la migration #2 SI École A retenue)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, pseudo)
  values (new.id, new.raw_user_meta_data->>'pseudo');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

```text
+ Atomique : pas d'auth.users sans profil (aucun orphelin possible).
+ Fonctionne quelle que soit l'origine de l'auth.users (API, dashboard).
+ P2 respecté : la server action de signup n'utilise PAS service_role ; le
  trigger est DB-side (SECURITY DEFINER), pas un client service_role.
- Le pseudo transite par raw_user_meta_data (couplage à la forme des métadonnées).
- Le trigger tourne HORS session, en definer : il contourne la RLS pour son
  insert (voulu ici), mais toute erreur y est OPAQUE côté utilisateur.
- Le code compétition NE PEUT PAS être vérifié dans le trigger (il se déclenche
  une fois l'auth.users déjà créé — trop tard pour refuser). Donc la vérif reste
  AVANT le signUp de toute façon (§4).
```

### École B — Création explicite dans la server action

Pas de trigger. La server action d'inscription enchaîne tout : vérif code →
`signUp` → **insert explicite** de `public.users` avec l'id retourné, en session
utilisateur (le `signUp` ouvre déjà une session), donc via une policy
`insert where id = auth.uid()` (T3) — **pas** service_role.

```text
+ Tout est explicite et lisible dans une seule server action (code, auth, profil).
+ Erreurs faciles à remonter à l'utilisateur (message clair par étape).
+ Aucun couplage aux métadonnées, aucun trigger definer à raisonner en T3.
- NON atomique : si signUp réussit puis l'insert profil échoue → auth.users
  ORPHELIN (compte sans profil). Nécessite une logique de nettoyage/rattrapage.
- Impose une policy « self-insert » sur users (id = auth.uid()) que T3 devra
  écrire avec soin (fenêtre étroite entre création de session et insert).
```

### Recommandation

**École A (trigger) — RETENUE (18/07/2026).** Motif : l'atomicité supprime la
classe de bugs « orphelins » qui est pénible à rattraper, et elle **évite le
point délicat** « qui a le droit d'insérer le profil sous RLS » (le trigger
definer s'en charge, la server action de signup reste sans service_role → P2
propre). Bonus : une collision de pseudo (backstop `unique`) fait échouer le
trigger dans la **même transaction** que la création de l'`auth.users`, donc
**annule** cette création — pas d'orphelin même en cas de course. Le prix (pseudo
via métadonnées, erreurs opaques atténuées par la pré-vérif du §4) est faible.
C'est le pattern Supabase éprouvé.

Le contenu de la migration #2 découle de ce choix.

---

## 4. Flux d'inscription (les 3 temps de C4)

Identique dans les deux écoles jusqu'à la création de l'auth.users.

```text
Entrée (server action « signUp ») : pseudo, email, password, code_competition.

Temps 1 — Validations serveur AVANT toute création :
  a. Le code correspond-il à la compétition ACTIVE ? (vérif serveur, §5)
     → non : rejet « code invalide », rien n'est créé.
  b. Le pseudo est-il libre ? (users.pseudo est unique, T1)
     → pris : rejet « pseudo indisponible ».
  Note : s'il n'existe AUCUNE compétition ACTIVE (état « en creux » connu),
  l'inscription est refusée proprement (rien à rejoindre). Wording de l'écran en T6.

Temps 2 — Création de l'auth.users :
  supabase.auth.signUp({ email, password, options: { data: { pseudo } } })
  (le pseudo en metadata sert l'École A ; inoffensif pour l'École B.)

Temps 3 — Matérialisation du profil public.users :
  École A : le trigger l'insère automatiquement (pseudo depuis metadata).
  École B : la server action l'insère explicitement (id = auth user, pseudo,
            status ACTIVE, role PLAYER par défauts de T1).

Sortie : compte ACTIVE immédiat + session ouverte (C4). Redirection app.
```

Points de sécurité du flux :
- La vérif du code est **une action serveur**, pas une validation de formulaire
  (C4) : le client ne voit jamais le code des compétitions (§5).
- L'ordre « vérifier AVANT créer » garantit qu'aucun `auth.users` n'est créé pour
  un code invalide.

---

## 5. Addition au modèle de données : `competitions.join_code` (actée)

**C'est la remontée de T2 vers T1.** T1 n'a pas de colonne de code compétition
(le proto l'avait supprimée, inutile sans vraie inscription). C4 en a besoin.

Proposition (portée par la **migration #2**, référencée depuis T1) :

```sql
-- Ajout à la table competitions (T1). Base neuve = competitions vide, donc
-- NOT NULL sans default ne viole aucune ligne existante (acté).
alter table competitions add column join_code text not null;
```

Vérification **sans exposer le code** (la RLS filtre des lignes, pas des colonnes
— même piège que l'email en D5) : une fonction `SECURITY DEFINER` qui répond
oui/non sans jamais rendre `join_code` lisible par l'anon.

```sql
create function public.verify_join_code(p_code text)
returns uuid                              -- id de la compétition active si OK, sinon NULL
language sql security definer stable set search_path = public
as $$
  select id from competitions
  where status = 'ACTIVE'
    and lower(trim(join_code)) = lower(trim(p_code))   -- comparaison insensible casse+trim (acté)
  limit 1;
$$;
```

Décisions de conception actées (§10) :
- **Portée** : le code est **par compétition** (l'admin le fixe à la création,
  écran A7). Seul le code de la compétition ACTIVE est vérifié.
- **Unicité** : non nécessaire (une seule compétition ACTIVE à la fois) — pas
  d'index unique.
- **Comparaison** : insensible à la casse + trim, pour l'UX.
- Où l'admin saisit le code : écran `admin/competitions/new` (T6), hors T2.

---

## 6. Bootstrap du 1er admin (A4)

Pas de « premier inscrit = admin » caché, pas de variable d'env avec un email.

```text
Séquence :
1. L'app est déployée (T2 en place), AUCUN admin n'existe encore.
2. Le tout premier compte s'inscrit NORMALEMENT via l'app (§4) → PLAYER, ACTIVE.
3. Une migration de seed UNIQUE le promeut ADMIN, une fois, à la main.
```

```sql
-- migration de seed (séparée, exécutée une seule fois APRÈS la 1re inscription).
-- Cible le compte par son pseudo (connu, choisi à l'inscription) — acté.
update public.users set role = 'ADMIN'
where pseudo = 'REMPLACER_PAR_LE_PSEUDO_DU_1ER_COMPTE';
```

> Cette migration ne peut pas être écrite « à blanc » avant que le 1er compte
> existe (il faut son pseudo). Elle est donc produite/adaptée au moment du
> déploiement réel, pas maintenant. C'est un point d'attention de séquencement,
> pas une décision ouverte.

---

## 7. Rôles, statuts, sessions

### 7.1 Session et JWT
```text
- Supabase émet un JWT dont `sub` = auth.uid() = public.users.id (D).
- Le JWT NE PORTE NI le rôle NI le statut (arbitrage C).
- Les composants serveur lisent la session (clé anon + JWT) ; service_role
  reste réservé synchro/heartbeat/seed (P2).
```

### 7.2 Rôle (PLAYER / ADMIN)
```text
- Vit dans public.users.role. Défaut PLAYER (T1).
- Lu par is_admin() SECURITY DEFINER STABLE (défini en T3, pas ici) → une
  promotion en base est effective SANS re-login (pas de claim JWT à rafraîchir).
- Admin = joueur + droits : il a une ligne users comme tout le monde, participe
  et apparaît au classement (0.2.1 §5).
```

### 7.3 Statut (ACTIVE / DISABLED)
```text
- Vit dans public.users.status. Défaut ACTIVE (T1).
- DISABLED = ne peut plus PARTICIPER (écrire pronos/paris/bracket). L'auth.users
  reste valide (session possible) ; c'est la RLS + les gardes applicatives (T3)
  qui bloquent l'écriture. Le détail des policies est en T3.
- Passage ACTIVE⇄DISABLED = action admin journalisée (audit_logs, 0.2.1 §5).
```

> Frontière avec T3 : *comment* DISABLED et is_admin() bloquent/autorisent est du
> ressort des policies (T3). T2 fixe *où* vivent rôle et statut et *pourquoi* ils
> ne sont pas dans le JWT.

---

## 8. Configuration Supabase Auth (actée)

```text
- Confirmation d'email : DÉSACTIVÉE (acté). C4 impose un accès ACTIVE IMMÉDIAT ;
  une confirmation par email l'en empêcherait. L'email étant ici un identifiant
  technique privé (pas un canal de communication), la non-vérification est
  acceptable pour une app privée entre amis.
  Contrepartie : un email erroné passe à l'inscription mais casserait un futur
  reset password — garde applicative de format d'email au signup (non bloquante).
- Reset password : flux Supabase standard par email (fonctionne tant que l'email
  est valide). Écrans en T6.
- Providers : email + mot de passe UNIQUEMENT (pas d'OAuth Google/etc. en V1).
- Le code compétition n'est PAS une fonctionnalité Supabase Auth : c'est notre
  garde serveur (§5), en amont du signUp.
```

> Rappel : « Confirm email » se désactive dans le **dashboard Supabase**
> (Authentication → Sign In / Providers), pas en SQL. À basculer avant la
> première inscription réelle.

---

## 9. Ce que T2 ne dit pas

```text
- Les policies RLS (self-insert, lecture users par les visiteurs, blocage
  DISABLED, is_admin())            → T3.
- Les écrans (formulaire d'inscription, connexion, reset, wording)  → T6.
- Le garde-fou anti-perte de saisie (C2)                            → T6.
```

---

## 10. Décisions actées à la validation de T2 (18/07/2026)

```text
1. [MODÈLE] competitions.join_code ajouté (§5), porté par la migration #2, +
   fonction verify_join_code() SECURITY DEFINER (ne l'expose jamais). Base neuve
   → NOT NULL sans default. ACTÉ.

2. [PONT] École A retenue : trigger handle_new_user (§3). Atomique, P2 propre,
   pas d'orphelin. Fixe le contenu de la migration #2. ACTÉ.

3. [CONFIG] Confirmation d'email Supabase DÉSACTIVÉE (§8), pour l'accès immédiat
   de C4. ACTÉ (bascule dashboard).

4. join_code par compétition, sans unicité, comparaison insensible casse+trim
   (§5). ACTÉ.

5. Bootstrap admin ciblé par PSEUDO (§6). Le seed réel sera écrit au déploiement,
   une fois le 1er pseudo connu. ACTÉ.

6. Inscription refusée s'il n'y a aucune compétition ACTIVE (§4 temps 1). ACTÉ.
```

**T2 est VALIDÉ et figé.** Prochaine étape : la **migration #2** (join_code +
verify_join_code + trigger handle_new_user), montrée en entier avant tout
`db push`. Puis **T3 (RLS)** — le chantier sensible, avant tout écran (maître §6).
