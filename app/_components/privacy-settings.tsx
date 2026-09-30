"use client";
import { useEffect, useRef, useState } from "react";
import type { Account } from "@/hooks/use-account";
import { authHeaders } from "@/app/lib/auth-headers";
import { supabase } from "@/app/lib/supabase";
import { useI18n } from "@/app/lib/i18n";
import "../privacy.css";

type Connection = {
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  providers: string[];
  deletionAvailable: boolean;
};
const words = {
  fr: {
    title: "Connexion du compte",
    guest: "Connecte-toi pour consulter les informations de ton compte.",
    login: "Se connecter",
    email: "Adresse e-mail",
    method: "Méthode de connexion",
    created: "Compte créé le",
    last: "Dernière connexion",
    verified: "E-mail confirmé",
    yes: "Oui",
    no: "Non",
    signout: "Se déconnecter",
    loading: "Chargement…",
    error: "Impossible de charger les informations. Réessaie.",
    retry: "Réessayer",
    danger: "Supprimer mon compte",
    description:
      "La suppression est définitive : profil, photo, progression, cadres, statistiques personnelles et amis seront supprimés. Les résultats impliquant d’autres joueurs seront anonymisés.",
    unavailable:
      "La suppression automatique nécessite encore l’activation de l’accès administrateur au service de connexion.",
    confirm: "Confirmer la suppression",
    type: "Écris SUPPRIMER pour confirmer.",
    cancel: "Annuler",
    failed: "La suppression n’a pas abouti. Réessaie plus tard.",
    cleanup:
      "L’identité de connexion a été supprimée, mais le nettoyage des données doit être terminé par l’administrateur.",
    done: "Ton compte a été supprimé.",
    password: "E-mail et mot de passe",
    unknown: "Non renseigné",
  },
  en: {
    title: "Account connection",
    guest: "Sign in to view your account information.",
    login: "Sign in",
    email: "Email address",
    method: "Sign-in method",
    created: "Account created",
    last: "Last sign-in",
    verified: "Email confirmed",
    yes: "Yes",
    no: "No",
    signout: "Sign out",
    loading: "Loading…",
    error: "Could not load the information. Try again.",
    retry: "Try again",
    danger: "Delete my account",
    description:
      "Deletion is permanent: your profile, photo, progress, frames, personal statistics and friends will be removed. Results involving other players will be anonymised.",
    unavailable:
      "Automatic deletion still requires administrator access to the sign-in service to be enabled.",
    confirm: "Confirm deletion",
    type: "Type SUPPRIMER to confirm.",
    cancel: "Cancel",
    failed: "Deletion failed. Try again later.",
    cleanup:
      "Your sign-in identity was deleted, but an administrator must finish cleaning up the data.",
    done: "Your account has been deleted.",
    password: "Email and password",
    unknown: "Not provided",
  },
};

export function PrivacySettings({
  account,
  openAuth,
  notify,
}: {
  account: Account;
  openAuth: () => void;
  notify: (message: string) => void;
}) {
  const { locale } = useI18n();
  const text = words[locale];
  const [data, setData] = useState<Connection | null>(null),
    [error, setError] = useState(false),
    [reload, setReload] = useState(0),
    [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [deleteError, setDeleteError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const userId = account.user?.id;
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void authHeaders()
      .then((headers) => fetch("/api/account/privacy", { headers, cache: "no-store" }))
      .then(async (response) => {
        if (!response.ok) throw new Error("connection");
        const next = (await response.json()) as Connection;
        if (live) {
          setData(next);
          setError(false);
        }
      })
      .catch(() => {
        if (live) setError(true);
      });
    return () => {
      live = false;
    };
  }, [userId, reload]);
  if (!account.user)
    return (
      <section className="settings-group">
        <p>{text.guest}</p>
        <button className="primary" onClick={openAuth}>
          {text.login}
        </button>
      </section>
    );
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(value),
        )
      : text.unknown;
  const remove = async () => {
    setBusy(true);
    setDeleteError("");
    try {
      const response = await fetch("/api/account/privacy", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ confirmation }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error === "cleanup_required" ? text.cleanup : text.failed);
      }
      for (const key of Object.keys(localStorage))
        if (key.startsWith("sudoklash") && key.includes(account.user!.id))
          localStorage.removeItem(key);
      await supabase.auth.signOut({ scope: "local" });
      dialog.current?.close();
      notify(text.done);
      window.location.reload();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : text.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="privacy-settings">
      <section className="settings-group">
        <h3>{text.title}</h3>
        {error ? (
          <p role="alert">
            {text.error}{" "}
            <button onClick={() => setReload((value) => value + 1)}>{text.retry}</button>
          </p>
        ) : !data ? (
          <p role="status">{text.loading}</p>
        ) : (
          <dl className="privacy-connection">
            <div>
              <dt>{text.email}</dt>
              <dd>{data.email ?? text.unknown}</dd>
            </div>
            <div>
              <dt>{text.method}</dt>
              <dd>
                {data.providers
                  .map((provider) => (provider === "email" ? text.password : provider))
                  .join(", ") || text.unknown}
              </dd>
            </div>
            <div>
              <dt>{text.verified}</dt>
              <dd>{data.emailConfirmed ? text.yes : text.no}</dd>
            </div>
            <div>
              <dt>{text.created}</dt>
              <dd>{date(data.createdAt)}</dd>
            </div>
            <div>
              <dt>{text.last}</dt>
              <dd>{date(data.lastSignInAt)}</dd>
            </div>
          </dl>
        )}
        <button onClick={() => void supabase.auth.signOut()}>{text.signout}</button>
      </section>
      <section className="privacy-danger">
        <h3>{text.danger}</h3>
        <p>{text.description}</p>
        {data && !data.deletionAvailable && (
          <p className="privacy-unavailable">{text.unavailable}</p>
        )}
        <button
          className="privacy-delete"
          disabled={!data?.deletionAvailable}
          onClick={() => {
            setConfirmation("");
            setDeleteError("");
            dialog.current?.showModal();
          }}
        >
          {text.danger}
        </button>
      </section>
      <dialog
        ref={dialog}
        className="privacy-dialog"
        aria-labelledby="delete-account-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (confirmation === "SUPPRIMER" && !busy) void remove();
          }}
        >
          <h3 id="delete-account-title">{text.confirm}</h3>
          <p>{text.description}</p>
          <label htmlFor="delete-confirmation">{text.type}</label>
          <input
            id="delete-confirmation"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
          />
          {deleteError && <p role="alert">{deleteError}</p>}
          <div>
            <button type="button" disabled={busy} onClick={() => dialog.current?.close()}>
              {text.cancel}
            </button>
            <button className="privacy-delete" disabled={busy || confirmation !== "SUPPRIMER"}>
              {busy ? text.loading : text.danger}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
