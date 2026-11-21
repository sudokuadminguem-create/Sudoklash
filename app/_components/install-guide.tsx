"use client";
import { useId, type Ref } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/app/lib/i18n";
import type { InstallPlatform } from "@/app/lib/pwa";

export function InstallGuide({
  dialog,
  platform,
}: {
  dialog: Ref<HTMLDialogElement>;
  platform: InstallPlatform;
}) {
  const { t } = useI18n();
  const title = useId();
  return (
    <dialog ref={dialog} className="install-guide" aria-labelledby={title}>
      <form method="dialog">
        <button type="submit" className="install-guide-close" aria-label={t("install.close")}>
          <X aria-hidden="true" />
        </button>
      </form>
      <h2 id={title}>{t("install.label")}</h2>
      <ol>
        <li>{t(`install.${platform}.1`)}</li>
        <li>{t(`install.${platform}.2`)}</li>
        {platform === "ios" && <li>{t("install.ios.3")}</li>}
      </ol>
    </dialog>
  );
}
