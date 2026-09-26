const authMessages: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  user_already_exists: "Ce compte existe déjà.",
  username_unavailable: "Ce pseudo est déjà pris.",
  invalid_username: "Utilisez 3 à 20 lettres, chiffres ou underscores.",
  profile_unavailable: "Le profil est temporairement indisponible. Réessayez dans un instant.",
};
/** Turns Supabase and API error codes into messages for players. */
export const friendlyError = (message: string) =>
  Object.entries(authMessages).find(([key]) => message.includes(key))?.[1] ?? message;
