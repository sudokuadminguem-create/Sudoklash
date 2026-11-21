"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { pendingInvitationKey } from "@/app/lib/invite-link";
import { authHeaders } from "@/app/lib/auth-headers";
import { friendlyError } from "@/app/lib/auth-messages";
import { supabase } from "@/app/lib/supabase";
import type { Account } from "@/hooks/use-account";

type Mode = "signin" | "signup" | "forgot" | "reset";

const titles: Record<Mode, string> = {
  signin: "Se connecter",
  signup: "Créer un compte",
  forgot: "Mot de passe oublié",
  reset: "Nouveau mot de passe",
};

/** Saves the username a new player chose; the server answers why it refuses one. */
async function saveUsername(username: string) {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "profile_unavailable");
  }
}

async function sendResetLink(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/?reset=1`,
  });
  if (error) throw error;
}

async function saveNewPassword(password: string) {
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session.session)
    throw new Error("Le lien de récupération est expiré ou invalide. Demandez un nouveau lien.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Signs in or up and returns the session, if e-mail confirmation is not pending. */
async function signInOrUp(
  signup: boolean,
  email: string,
  password: string,
  signupInvitation?: string,
) {
  const credentials = { email: email.trim(), password };
  const result = signup
    ? await supabase.auth.signUp({
        ...credentials,
        ...(signupInvitation ? { options: { data: { sudoklash_invite: signupInvitation } } } : {}),
      })
    : await supabase.auth.signInWithPassword(credentials);
  if (result.error) throw result.error;
  return result.data.session;
}

function initialMode(recovery: boolean, startSignup: boolean): Mode {
  if (recovery) return "reset";
  return startSignup ? "signup" : "signin";
}

export function AuthDialog({
  account,
  onClose,
  onAuthenticated,
  startSignup = false,
  signupInvitation,
  onSignupComplete,
  recovery = false,
  recoveryStatus = "checking",
  onRecovered,
}: Readonly<{
  account: Account;
  onClose: () => void;
  onAuthenticated?: () => void;
  startSignup?: boolean;
  signupInvitation?: string;
  onSignupComplete?: () => void;
  recovery?: boolean;
  recoveryStatus?: "checking" | "ready" | "expired";
  onRecovered?: () => void;
}>) {
  const [mode, setMode] = useState<Mode>(() => initialMode(recovery, startSignup));
  const usernameInput = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [username, setUsername] = useState("");
  const [visible, setVisible] = useState(false),
    [error, setError] = useState(""),
    [info, setInfo] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (recovery) setMode("reset");
  }, [recovery]);
  const needsUsername = !!account.user && !account.profile?.username && mode !== "reset";
  useEffect(() => {
    if (needsUsername) usernameInput.current?.focus();
  }, [needsUsername]);
  const changeMode = (next: typeof mode) => {
    setMode(next);
    setError("");
    setInfo("");
    setPassword("");
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (needsUsername) {
        await saveUsername(username);
        await account.refresh();
        (onAuthenticated ?? onClose)();
      } else if (mode === "forgot") {
        await sendResetLink(email);
        setInfo(
          "Si cette adresse correspond à un compte, vous recevrez un e-mail avec un lien pour choisir un nouveau mot de passe.",
        );
      } else if (mode === "reset") {
        await saveNewPassword(password);
        setInfo("Mot de passe modifié. Votre compte est connecté.");
        setPassword("");
        onRecovered?.();
      } else {
        const session = await signInOrUp(mode === "signup", email, password, signupInvitation);
        if (mode === "signin" && session) onAuthenticated?.();
        if (mode === "signup") {
          try {
            sessionStorage.removeItem(pendingInvitationKey);
          } catch {}
          onSignupComplete?.();
          if (!session)
            setInfo("Compte créé. Ouvrez l’e-mail de confirmation, puis connectez-vous.");
        }
      }
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : "Connexion impossible"));
    } finally {
      setBusy(false);
    }
  };
  const passwordField = (
    <label>
      Mot de passe
      <div className="password-field">
        <input
          type={visible ? "text" : "password"}
          autoComplete={mode === "signup" || mode === "reset" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
        />
        <button
          type="button"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      </div>
    </label>
  );
  const submitLabel = mode === "signup" ? "Créer mon compte" : "Se connecter";
  const resetContent = () => {
    if (recoveryStatus === "checking") return <p>Vérification du lien de récupération…</p>;
    if (recoveryStatus === "expired")
      return (
        <>
          <p>
            Ce lien a expiré ou ne permet pas de modifier le mot de passe. Demandez un nouveau lien
            depuis votre adresse e-mail.
          </p>
          <button className="primary account-submit" onClick={() => changeMode("forgot")}>
            Demander un nouveau lien
          </button>
        </>
      );
    return (
      <>
        <p>Choisissez un nouveau mot de passe d’au moins 8 caractères pour votre compte.</p>
        {passwordField}
        <button
          className="primary account-submit"
          disabled={busy || password.length < 8}
          onClick={submit}
        >
          {busy ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </button>
      </>
    );
  };
  const content = () => {
    if (needsUsername)
      return (
        <>
          <p>Ce pseudo sera visible par vos amis et vos adversaires. Il doit être unique.</p>
          <label>
            <span>Pseudo</span>
            <input
              ref={usernameInput}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ex. LogikRush"
              maxLength={20}
            />
          </label>
          <button
            className="primary account-submit"
            disabled={busy || username.length < 3}
            onClick={submit}
          >
            {busy ? "Enregistrement…" : "Valider mon pseudo"}
          </button>
        </>
      );
    if (mode === "forgot")
      return (
        <>
          <p>
            Saisissez l’adresse e-mail de votre compte. Nous vous enverrons un lien pour choisir un
            nouveau mot de passe.
          </p>
          <label>
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.fr"
            />
          </label>
          <button
            className="primary account-submit"
            disabled={busy || !email.includes("@")}
            onClick={submit}
          >
            {busy ? "Envoi…" : "Envoyer le lien"}
          </button>
          <button className="auth-switch" onClick={() => changeMode("signin")}>
            Retour à la connexion
          </button>
        </>
      );
    if (mode === "reset") return resetContent();
    return (
      <>
        <label>
          <span>E-mail</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
          />
        </label>
        {passwordField}
        <button
          className="primary account-submit"
          disabled={busy || !email.includes("@") || password.length < 8}
          onClick={submit}
        >
          {busy ? "Connexion…" : submitLabel}
        </button>
        {mode === "signin" && (
          <small>
            Tu resteras connecté sur cet appareil. Pour quitter : Options → Déconnexion.
          </small>
        )}
        {mode === "signin" && (
          <button className="auth-switch" onClick={() => changeMode("forgot")}>
            Mot de passe oublié ?
          </button>
        )}
        <button
          className="auth-switch"
          onClick={() => changeMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup" ? "J’ai déjà un compte" : "Créer un compte gratuitement"}
        </button>
      </>
    );
  };
  return (
    <div className="account-backdrop">
      <dialog open className="account-dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="account-close" aria-label="Fermer" onClick={onClose}>
          <X />
        </button>
        <div className="account-shield">
          <ShieldCheck />
        </div>
        <span className="eyebrow">COMPTE Sudoklash</span>
        <h2 id="account-title">{needsUsername ? "Choisissez votre pseudo" : titles[mode]}</h2>
        {mode === "signup" && !needsUsername && (
          <div className="signup-benefits">
            {signupInvitation && <p>Tu as été invité à jouer à Sudoklash !</p>}
            <b>Ce que ton compte gratuit débloque</b>
            <ul>
              <li>Les grilles du jour et de la semaine, avec leurs classements.</li>
              <li>Les duels entre amis et les parties classées.</li>
              <li>Ton profil et ta progression : XP, défis et récompenses.</li>
            </ul>
          </div>
        )}
        {content()}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="form-info">
            <output>{info}</output>
          </p>
        )}
      </dialog>
    </div>
  );
}
