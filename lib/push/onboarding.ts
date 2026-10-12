// Décision PURE du guide « notifications + raccourci écran d'accueil » affiché
// à la connexion (components/onboarding/OnboardingGuide.tsx). Les lectures du
// navigateur (navigator, Notification, matchMedia, localStorage) restent dans
// le composant ; ici seulement la règle, pour pouvoir la tester sans DOM.

export type InstallPlatform = "ios" | "android" | "desktop";

export type OnboardingInputs = {
  platform: InstallPlatform;
  /** App ouverte depuis l'icône de l'écran d'accueil (mode standalone). */
  standalone: boolean;
  pushSupported: boolean;
  permission: NotificationPermission | "unsupported";
  /** Cet appareil a déjà un abonnement push. */
  subscribedHere: boolean;
  /** Le joueur a confirmé avoir déjà installé l'app (« C'est fait »). */
  installConfirmed: boolean;
};

export type NotifStep =
  | "done"
  | "enable" // un tap sur le bouton suffit
  | "blocked" // refusé : seul un réglage du téléphone/navigateur le débloque
  | "needs-install" // iPhone dans Safari : le push n'existe qu'une fois installée
  | "unsupported";

export type InstallStep = "done" | "todo" | "na";

export type OnboardingState = {
  notif: NotifStep;
  install: InstallStep;
  /** Le guide doit s'ouvrir à la connexion. */
  show: boolean;
};

export function resolveOnboarding(inputs: OnboardingInputs): OnboardingState {
  const { platform, standalone, pushSupported, permission, subscribedHere, installConfirmed } = inputs;

  let install: InstallStep;
  if (standalone || installConfirmed) install = "done";
  else if (platform === "desktop") install = "na";
  else install = "todo";

  let notif: NotifStep;
  if (platform === "ios" && !standalone) notif = "needs-install";
  else if (!pushSupported || permission === "unsupported") notif = "unsupported";
  else if (permission === "denied") notif = "blocked";
  else if (subscribedHere) notif = "done";
  else notif = "enable";

  // « blocked » et « unsupported » ne déclenchent pas le guide à eux seuls :
  // le joueur n'y peut rien depuis ici et le relancer chaque jour serait du
  // harcèlement. Ils s'affichent quand même si le guide s'ouvre pour autre chose.
  const show = notif === "enable" || notif === "needs-install" || install === "todo";

  return { notif, install, show };
}
