---
description: Audit de sécurité complet et structuré d'une application web (frontend + backend)
argument-hint: "[chemin ou périmètre optionnel, ex: backend/ ou api/]"
allowed-tools: Read, Grep, Glob, Bash(git log:*), Bash(git diff:*)
---

Tu es un auditeur de sécurité applicative senior. Effectue un audit complet et structuré du code présent dans le périmètre suivant : $ARGUMENTS (si vide, analyse tout le dépôt).

Ne modifie AUCUN fichier de code. Cette commande est en lecture seule : analyse, identifie, documente. Ne propose des correctifs que sous forme de recommandations dans le rapport, sans les appliquer.

## Méthodologie

Analyse le code selon les 9 axes suivants, en t'appuyant sur l'OWASP Top 10 :

1. **Authentification & sessions**
   - Stockage des mots de passe (hash, salage, algorithme utilisé)
   - Gestion des tokens (JWT, expiration, révocation, stockage côté client)
   - Configuration des cookies (HttpOnly, Secure, SameSite)

2. **Contrôle d'accès**
   - Vérifications d'autorisation sur chaque route/endpoint sensible
   - Risques d'IDOR (accès à des ressources d'autrui via un ID prévisible)
   - Séparation des rôles (admin vs utilisateur standard)

3. **Injections**
   - Requêtes SQL/NoSQL construites par concaténation de chaînes
   - Absence de requêtes préparées / ORM mal utilisé
   - Injections de commandes système (exec, eval, etc.)
   - XSS (échappement des sorties HTML, usage de dangerouslySetInnerHTML ou équivalent)

4. **Gestion des secrets**
   - Clés API, mots de passe ou tokens en dur dans le code
   - Fichiers .env commités dans le dépôt
   - Secrets visibles dans les logs ou messages d'erreur

5. **Dépendances**
   - Liste les fichiers de dépendances présents (package.json, requirements.txt, etc.)
   - Signale les versions manifestement obsolètes ou non maintenues
   - Recommande de lancer un scan dédié (npm audit, pip-audit, etc.)

6. **Configuration serveur & réseau**
   - Headers de sécurité HTTP (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
   - Configuration CORS trop permissive (wildcard avec credentials)
   - Utilisation de TLS / redirections HTTP vers HTTPS

7. **Validation des entrées**
   - Validation côté serveur (pas seulement côté client)
   - Limites de taille, typage strict, listes blanches plutôt que noires

8. **Logs & gestion des erreurs**
   - Fuite d'informations sensibles dans les messages d'erreur renvoyés au client
   - Traces de stack exposées en production
   - Données personnelles ou secrets dans les logs

9. **Stockage des données**
   - Chiffrement des données sensibles au repos
   - Données personnelles (RGPD) stockées en clair

## Format du rapport de sortie

Produis un rapport structuré en Markdown avec :

- Un résumé exécutif (nombre de findings par niveau de sévérité : Critique / Élevé / Moyen / Faible)
- Pour chaque finding : titre, sévérité, fichier(s) et ligne(s) concernés, description du risque, recommandation de correction
- Une section finale "Prochaines étapes" priorisée

Sauvegarde ce rapport dans un fichier `security-audit-report.md` à la racine du périmètre analysé.
