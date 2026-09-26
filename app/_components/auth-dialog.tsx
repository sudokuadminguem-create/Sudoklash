"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { friendlyError } from "@/app/lib/auth-messages";
import { supabase } from "@/app/lib/supabase";
import type { Account } from "@/hooks/use-account";

export function AuthDialog({
  account,
  onClose,
  recovery = false,
  recoveryStatus = "checking",
  onRecovered,
}: {
  account: Account;
  onClose: () => void;
  recovery?: boolean;
  recoveryStatus?: "checking" | "ready" | "expired";
  onRecovered?: () => void;
}) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">(
    recovery ? "reset" : "signin",
  );
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
        const response = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          body: JSON.stringify({ username }),
        });
        if (!response.ok) {
          const data = (await response.json()) as { error?: string };
          throw new Error(data.error ?? "profile_unavailable");
        }
        await account.refresh();
        onClose();
        return;
      }
      if (mode === "forgot") {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/?reset=1`,
        });
        if (e) throw e;
        setInfo(
          "Si cette adresse correspond à un compte, vous recevrez un e-mail avec un lien pour choisir un nouveau mot de passe.",
        );
        return;
      }
      if (mode === "reset") {
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session.session)
          throw new Error(
            "Le lien de récupération est expiré ou invalide. Demandez un nouveau lien.",
          );
        const { error: e } = await supabase.auth.updateUser({ password });
        if (e) throw e;
        setInfo("Mot de passe modifié. Votre compte est connecté.");
        setPassword("");
        onRecovered?.();
        return;
      }
      const result =
        mode === "signup"
          ? await supabase.auth.signUp({ email: email.trim(), password })
          : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session)
        setInfo("Compte créé. Ouvrez l’e-mail de confirmation, puis connectez-vous.");
      else if (result.data.session) await account.refresh();
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
  return (
    <div className="account-backdrop" role="presentation">
      <section
        className="account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
      >
        <button className="account-close" aria-label="Fermer" onClick={onClose}>
          <X />
        </button>
        <div className="account-shield">
          <ShieldCheck />
        </div>
        <span className="eyebrow">COMPTE SUDOKU CLASH</span>
        <h2 id="account-title">
          {needsUsername
            ? "Choisissez votre pseudo"
            : mode === "forgot"
              ? "Mot de passe oublié"
              : mode === "reset"
                ? "Nouveau mot de passe"
                : mode === "signup"
                  ? "Créer un compte"
                  : "Se connecter"}
        </h2>
        {needsUsername ? (
          <>
            <p>Ce pseudo sera visible par vos amis et vos adversaires. Il doit être unique.</p>
            <label>
              Pseudo
              <input
                autoFocus
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
        ) : mode === "forgot" ? (
          <>
            <p>
              Saisissez l’adresse e-mail de votre compte. Nous vous enverrons un lien pour choisir
              un nouveau mot de passe.
            </p>
            <label>
              E-mail
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
        ) : mode === "reset" ? (
          recoveryStatus === "checking" ? (
            <p>Vérification du lien de récupération…</p>
          ) : recoveryStatus === "expired" ? (
            <>
              <p>
                Ce lien a expiré ou ne permet pas de modifier le mot de passe. Demandez un nouveau
                lien depuis votre adresse e-mail.
              </p>
              <button className="primary account-submit" onClick={() => changeMode("forgot")}>
                Demander un nouveau lien
              </button>
            </>
          ) : (
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
          )
        ) : (
          <>
            <label>
              E-mail
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
              {busy ? "Connexion…" : mode === "signup" ? "Créer mon compte" : "Se connecter"}
            </button>
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
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="form-info" role="status">
            {info}
          </p>
        )}
      </section>
    </div>
  );
}
