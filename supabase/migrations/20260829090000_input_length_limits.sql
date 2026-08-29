-- Limites de taille sur les champs texte libre encore illimités (audit
-- sécurité 29/08/2026, finding 6) : bio, description de pari, description de
-- signalement, justification de correction — même logique que
-- chat_messages.body (20260827100000_chat.sql), seul champ déjà borné.
-- Défense en profondeur : la vraie garde reste côté Server Action (retour
-- immédiat, pas d'aller-retour DB), ce CHECK couvre tout appel direct
-- (RPC forgé, script, futur écran) qui contournerait la Server Action.

alter table users
  add constraint users_bio_length check (bio is null or char_length(bio) <= 2000);

alter table bets
  add constraint bets_description_length check (char_length(description) <= 2000);

alter table correction_requests
  add constraint correction_requests_justification_length check (char_length(justification) <= 2000);

alter table bug_reports
  add constraint bug_reports_description_length check (char_length(description) <= 5000);
