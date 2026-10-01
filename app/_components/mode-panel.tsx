"use client";
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { useI18n } from "@/app/lib/i18n";
import { levelName, type MessageKey } from "@/app/lib/i18n-core";
import { formatClock } from "@/app/lib/format-time";
import { useSettings } from "@/app/lib/settings";
import { loadSoloSave, saveProgress, type SoloLevel, type SoloSave } from "@/app/lib/solo-save";
import { ConfirmDialog } from "./confirm-dialog";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { useOffline } from "@/app/lib/pwa";
import { soloDifficulties } from "@/lib/difficulties";
import { variantIds, variantInfo } from "@/lib/variants";
import { soloXpFor } from "@/lib/cosmetics";
import { PrivateLobby } from "./private-lobby";
import { RoomGame } from "./room-game";
import { SoloGame } from "./solo-game";
import { NearChallenges } from "./near-challenges";
import { TimedChallenge } from "./timed-challenge";

export function ModePanel({
  mode,
  notify,
  account,
  cosmetics,
  openAuth,
}: {
  mode: string;
  notify: (s: string) => void;
  account: Account;
  cosmetics: Cosmetics;
  openAuth: () => void;
}) {
  const [chosen, setChosen] = useState<SoloLevel | null>(null),
    [resuming, setResuming] = useState<SoloSave | undefined>(),
    [saved, setSaved] = useState<SoloSave | null>(null),
    [replacing, setReplacing] = useState<SoloLevel | null>(null);
  const practice = useOffline();
  const { settings } = useSettings();
  const { t } = useI18n();
  const pick = (d: SoloLevel) => {
    setChosen(d);
    notify(t("solo.loaded", { level: levelName(t, d) }));
  };
  const userId = account.user?.id ?? null;
  // Look for a game to resume each time the difficulty picker shows up.
  useEffect(() => {
    if (mode !== "solo" || chosen || account.loading) return;
    setSaved(loadSoloSave(practice ? null : userId));
  }, [mode, chosen, account.loading, userId, practice]);
  if (mode === "solo")
    return chosen ? (
      <div>
        <div className="solo-bar">
          <button
            onClick={() => {
              setChosen(null);
              setResuming(undefined);
            }}
          >
            {t("solo.change")}
          </button>
          <b>{levelName(t, chosen)}</b>
          <span>{t(practice ? "solo.practice" : "solo.valid")}</span>
        </div>
        <SoloGame
          key={chosen}
          difficulty={chosen}
          account={account}
          cosmetics={cosmetics}
          openAuth={openAuth}
          resume={resuming}
          practice={practice}
        />
      </div>
    ) : (
      <div className="solo-picker">
        {!practice && <NearChallenges account={account} cosmetics={cosmetics} />}
        <div className="panel">
          <div className="panel-head">
            <span className="eyebrow">{t("solo.trainingEyebrow")}</span>
            <h2>{t("solo.pickTitle")}</h2>
            <p className="panel-copy">{t("solo.pickCopy")}</p>
          </div>
          {saved && (
            <button
              className="resume-game"
              onClick={() => {
                setResuming(saved);
                setChosen(saved.difficulty);
              }}
            >
              <History />
              <span>
                <b>{t("solo.resume")}</b>
                <small>
                  {t("solo.resumeInfo", {
                    level: levelName(t, saved.difficulty),
                    time: formatClock(saved.board.seconds),
                    percent: saveProgress(saved),
                  })}
                </small>
              </span>
            </button>
          )}
          <div className="difficulty-grid">
            {soloDifficulties.map((d, i) => (
              <button
                // A new grid replaces the saved one: ask first.
                onClick={() => (saved && settings.confirmNewGrid ? setReplacing(d) : pick(d))}
                key={d}
              >
                <span>{["🌱", "●", "◆", "▲", "⬢", "♛"][i]}</span>
                <b>{levelName(t, d)}</b>
                <small>{t(`levelHint.${d}` as MessageKey)}</small>
                <span className="difficulty-xp">
                  {practice ? t("solo.practice") : `+${soloXpFor(d)} XP`}
                </span>
              </button>
            ))}
          </div>
          {!practice && (
            <>
              <div className="panel-head variant-head">
                <span className="eyebrow">{t("solo.variantsEyebrow")}</span>
                <h3>{t("solo.variantsTitle")}</h3>
              </div>
              <div className="difficulty-grid variant-grid">
                {variantIds.map((id) => (
                  <button
                    key={id}
                    onClick={() =>
                      saved && settings.confirmNewGrid
                        ? setReplacing(variantInfo[id].label)
                        : pick(variantInfo[id].label)
                    }
                  >
                    <span>{{ mini: "▦", diagonal: "╳", killer: "Σ" }[id]}</span>
                    <b>{levelName(t, variantInfo[id].label)}</b>
                    <small>{t(`variant.${id}` as MessageKey)}</small>
                    <span className="difficulty-xp">+{variantInfo[id].xp} XP</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {replacing && saved && (
            <ConfirmDialog
              title={t("solo.replaceTitle")}
              message={t("solo.replaceMessage", {
                current: levelName(t, saved.difficulty),
                next: levelName(t, replacing),
              })}
              confirmLabel={t("solo.replaceConfirm")}
              cancelLabel={t("solo.replaceCancel")}
              onCancel={() => setReplacing(null)}
              onConfirm={() => {
                setReplacing(null);
                pick(replacing);
              }}
            />
          )}
        </div>
      </div>
    );
  if (mode === "daily")
    return <TimedChallenge kind="daily" openAuth={openAuth} cosmetics={cosmetics} />;
  if (mode === "hebdo")
    return <TimedChallenge kind="weekly" openAuth={openAuth} cosmetics={cosmetics} />;
  return (
    <PrivateLobby
      account={account}
      notify={notify}
      openAuth={openAuth}
      onRace={(room, players) => (
        <RoomGame room={room} players={players} account={account} notify={notify} />
      )}
    />
  );
}
