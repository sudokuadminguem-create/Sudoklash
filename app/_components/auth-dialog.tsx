"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Eye, EyeOff, ShieldCheck, X } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { friendlyError } from "@/app/lib/auth-messages";
import { supabase } from "@/app/lib/supabase";
import type { Account } from "@/hooks/use-account";

type Mode = "signin" | "signup" | "forgot" | "reset";
type RecoveryStatus = "checking" | "ready" | "expired";

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

async function resetPassword(password: string) {
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session.session)
    throw new Error("Le lien de récupération est expiré ou invalide. Demandez un nouveau lien.");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/** Signs in or up; true when a new account still waits for its e-mail confirmation. */
async function signInOrUp(mode: Mode, email: string, password: string) {
  const result =
    mode === "signup"
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (result.error) throw result.error;
  return mode === "signup" && !result.data.session;
}

const modeTitles: Record<Mode, string> = {
  forgot: "Mot de passe oublié",
  reset: "Nouveau mot de passe",
  signup: "Créer un compte",
  signin: "Se connecter",
};

function EmailField({ email, setEmail }: { email: string; setEmail: (value: string) => void }) {
  return (
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
  );
}

function PasswordField({
  password,
  setPassword,
  newPassword,
  visible,
  setVisible,
}: {
  password: string;
  setPassword: (value: string) => void;
  newPassword: boolean;
  visible: boolean;
  setVisible: (update: (visible: boolean) => boolean) => void;
}) {
  return (
    <label>
      Mot de passe
      <div className="password-field">
        <input
          type={visible ? "text" : "password"}
          autoComplete={newPassword ? "new-password" : "current-password"}
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
}

function SubmitButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className="primary account-submit" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

function ResetForm({
  recoveryStatus,
  busy,
  password,
  passwordField,
  submit,
  changeMode,
}: {
  recoveryStatus: RecoveryStatus;
  busy: boolean;
  password: string;
  passwordField: ReactNode;
  submit: () => void;
  changeMode: (next: Mode) => void;
}) {
  if (recoveryStatus === "checking") return <p>Vérification du lien de récupération…</p>;
  if (recoveryStatus === "expired")
    return (
      <>
        <p>
          Ce lien a expiré ou ne permet pas de modifier le mot de passe. Demandez un nouveau lien
          depuis votre adresse e-mail.
        </p>
        <SubmitButton onClick={() => changeMode("forgot")}>Demander un nouveau lien</SubmitButton>
      </>
    );
  return (
    <>
      <p>Choisissez un nouveau mot de passe d’au moins 8 caractères pour votre compte.</p>
      {passwordField}
      <SubmitButton disabled={busy || password.length < 8} onClick={submit}>
        {busy ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </SubmitButton>
    </>
  );
}

function CredentialsForm({
  mode,
  busy,
  email,
  setEmail,
  password,
  passwordField,
  submit,
  changeMode,
}: {
  mode: "signin" | "signup";
  busy: boolean;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  passwordField: ReactNode;
  submit: () => void;
  changeMode: (next: Mode) => void;
}) {
  const signup = mode === "signup";
  return (
    <>
      <EmailField email={email} setEmail={setEmail} />
      {passwordField}
      <SubmitButton disabled={busy || !email.includes("@") || password.length < 8} onClick={submit}>
        {busy ? "Connexion…" : signup ? "Créer mon compte" : "Se connecter"}
      </SubmitButton>
      {!signup && (
        <small>Tu resteras connecté sur cet appareil. Pour quitter : Options → Déconnexion.</small>
      )}
      {!signup && (
        <button className="auth-switch" onClick={() => changeMode("forgot")}>
          Mot de passe oublié ?
        </button>
      )}
      <button className="auth-switch" onClick={() => changeMode(signup ? "signin" : "signup")}>
        {signup ? "J’ai déjà un compte" : "Créer un compte gratuitement"}
      </button>
    </>
  );
}

export function AuthDialog({
  account,
  onClose,
  startSignup = false,
  recovery = false,
  recoveryStatus = "checking",
  onRecovered,
}: {
  account: Account;
  onClose: () => void;
  startSignup?: boolean;
  recovery?: boolean;
  recoveryStatus?: RecoveryStatus;
  onRecovered?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(recovery ? "reset" : startSignup ? "signup" : "signin");
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
  const changeMode = (next: Mode) => {
    setMode(next);
    setError("");
    setInfo("");
    setPassword("");
  };
  const runSubmit = async () => {
    if (needsUsername) {
      await saveUsername(username);
      await account.refresh();
      onClose();
    } else if (mode === "forgot") {
      await sendResetLink(email);
      setInfo(
        "Si cette adresse correspond à un compte, vous recevrez un e-mail avec un lien pour choisir un nouveau mot de passe.",
      );
    } else if (mode === "reset") {
      await resetPassword(password);
      setInfo("Mot de passe modifié. Votre compte est connecté.");
      setPassword("");
      onRecovered?.();
    } else if (await signInOrUp(mode, email, password)) {
      setInfo("Compte créé. Ouvrez l’e-mail de confirmation, puis connectez-vous.");
    }
  };
  const submit = async () => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await runSubmit();
    } catch (e) {
      setError(friendlyError(e instanceof Error ? e.message : "Connexion impossible"));
    } finally {
      setBusy(false);
    }
  };
  const passwordField = (
    <PasswordField
      password={password}
      setPassword={setPassword}
      newPassword={mode === "signup" || mode === "reset"}
      visible={visible}
      setVisible={setVisible}
    />
  );
  let form: ReactNode;
  if (needsUsername)
    form = (
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
        <SubmitButton disabled={busy || username.length < 3} onClick={submit}>
          {busy ? "Enregistrement…" : "Valider mon pseudo"}
        </SubmitButton>
      </>
    );
  else if (mode === "forgot")
    form = (
      <>
        <p>
          Saisissez l’adresse e-mail de votre compte. Nous vous enverrons un lien pour choisir un
          nouveau mot de passe.
        </p>
        <EmailField email={email} setEmail={setEmail} />
        <SubmitButton disabled={busy || !email.includes("@")} onClick={submit}>
          {busy ? "Envoi…" : "Envoyer le lien"}
        </SubmitButton>
        <button className="auth-switch" onClick={() => changeMode("signin")}>
          Retour à la connexion
        </button>
      </>
    );
  else if (mode === "reset")
    form = (
      <ResetForm
        recoveryStatus={recoveryStatus}
        busy={busy}
        password={password}
        passwordField={passwordField}
        submit={submit}
        changeMode={changeMode}
      />
    );
  else
    form = (
      <CredentialsForm
        mode={mode}
        busy={busy}
        email={email}
        setEmail={setEmail}
        password={password}
        passwordField={passwordField}
        submit={submit}
        changeMode={changeMode}
      />
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
        <h2 id="account-title">{needsUsername ? "Choisissez votre pseudo" : modeTitles[mode]}</h2>
        {mode === "signup" && !needsUsername && (
          <div className="signup-benefits">
            <b>Ce que ton compte gratuit débloque</b>
            <ul>
              <li>Les grilles du jour et de la semaine, avec leurs classements.</li>
              <li>Les duels entre amis et les parties classées.</li>
              <li>Ton profil et ta progression : XP, défis et récompenses.</li>
            </ul>
          </div>
        )}
        {form}
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
