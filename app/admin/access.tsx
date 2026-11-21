"use client";

import { type ReactNode, useEffect, useState } from "react";
import { ChevronLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { AuthDialog } from "@/app/_components/auth-dialog";
import { authHeaders } from "@/app/lib/auth-headers";
import { supabase } from "@/app/lib/supabase";
import { useAccount } from "@/hooks/use-account";
import AdminPanel from "./panel";
import "../sudoku-grid.css";

export default function AdminAccess() {
  const account = useAccount();
  const [admin, setAdmin] = useState<{ isAdmin: boolean; displayName: string | null } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (account.loading) return;
    let active = true;
    setAdmin(null);
    authHeaders()
      .then((headers) => fetch("/api/me", { cache: "no-store", headers }))
      .then(
        (response) => response.json() as Promise<{ isAdmin: boolean; displayName: string | null }>,
      )
      .then((value) => {
        if (active) setAdmin(value);
      })
      .catch(() => {
        if (active) setAdmin({ isAdmin: false, displayName: null });
      });
    return () => {
      active = false;
    };
  }, [account.loading, account.user?.id]);

  if (admin?.isAdmin) return <AdminPanel displayName={admin.displayName ?? "Administrateur"} />;
  let status: ReactNode;
  if (account.loading || !admin) status = <p>Vérification de votre compte…</p>;
  else if (account.user)
    status = (
      <>
        <p>
          Ce compte ne dispose pas des droits d’administration. Connectez-vous avec le compte
          Sudoklash du propriétaire et confirmez son adresse e-mail.
        </p>
        <button className="admin-access-button" onClick={() => void supabase.auth.signOut()}>
          Changer de compte
        </button>
      </>
    );
  else
    status = (
      <>
        <p>Connectez-vous avec le compte Sudoklash du propriétaire pour accéder au panneau.</p>
        <button className="admin-access-button" onClick={() => setAuthOpen(true)}>
          Se connecter
        </button>
      </>
    );
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a href="/">
          <ChevronLeft />
          Retour au jeu
        </a>
        <div>
          <LockKeyhole />
          <span>Sudoklash</span>
          <b>Administration privée</b>
        </div>
      </header>
      <section className="admin-content">
        <div className="admin-intro">
          <span className="admin-pill">
            <ShieldCheck />
            Accès propriétaire uniquement
          </span>
          <h1>Administration</h1>
          {status}
        </div>
      </section>
      {authOpen && <AuthDialog account={account} onClose={() => setAuthOpen(false)} />}
    </main>
  );
}
