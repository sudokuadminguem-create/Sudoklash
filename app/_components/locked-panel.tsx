import { LogIn } from "lucide-react";

/** Placeholder asking the visitor to sign in before using a feature. */
export function LockedPanel({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: () => void;
}) {
  return (
    <div className="panel locked-real">
      <LogIn />
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={action}>
        Se connecter ou créer un compte
      </button>
    </div>
  );
}
