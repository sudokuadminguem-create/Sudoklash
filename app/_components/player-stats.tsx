"use client";
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { Flame } from "lucide-react";
import { formatClock } from "@/app/lib/format-time";
import { soloDifficulties } from "@/lib/difficulties";
import { progressionFor, trendOf, type SoloResult, type Streak } from "@/lib/player-stats";

export type SoloStats = {
  byDifficulty: { difficulty: string; games: number; best: number; average: number }[];
  history: SoloResult[];
  streak: Streak;
};

const DEFAULT_WIDTH = 600;
const MARGIN = { top: 14, right: 18, bottom: 26, left: 52 };

/** Round tick values (in seconds) covering 0 to `max`, on steps a person would pick. */
export function timeTicks(max: number) {
  const steps = [15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  const step = steps.find((s) => max / s <= 4) ?? 3600;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

const dateLabel = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** Times of the latest wins of one difficulty, with the record and a hover readout. */
export function ProgressionChart({
  results,
  difficulty,
}: {
  results: SoloResult[];
  difficulty: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const titleId = useId();
  const tooFew = results.length < 2;
  // Drawn at its real size, so the text stays readable on a phone instead of shrinking.
  const plotRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const element = plotRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setMeasured(Math.round(entry.contentRect.width) || DEFAULT_WIDTH),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [asTable, tooFew]);
  const WIDTH = Math.max(280, measured);
  const HEIGHT = Math.round(Math.min(240, Math.max(180, WIDTH * 0.4)));
  const times = results.map((r) => r.elapsed_seconds);
  const ticks = timeTicks(Math.max(...times, 1));
  const yMax = ticks[ticks.length - 1];
  const inner = { w: WIDTH - MARGIN.left - MARGIN.right, h: HEIGHT - MARGIN.top - MARGIN.bottom };
  const x = (i: number) =>
    MARGIN.left + (results.length === 1 ? inner.w / 2 : (i / (results.length - 1)) * inner.w);
  const y = (seconds: number) => MARGIN.top + inner.h - (seconds / yMax) * inner.h;
  const bestIndex = times.indexOf(Math.min(...times));
  const last = results.length - 1;
  const path = results.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.elapsed_seconds)}`).join(" ");
  const trend = trendOf(results);
  const shown = hover ?? null;

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - box.left) / box.width) * WIDTH;
    const index = Math.round(((position - MARGIN.left) / inner.w) * (results.length - 1));
    setHover(Math.min(last, Math.max(0, results.length === 1 ? 0 : index)));
  };

  if (tooFew)
    return (
      <p className="stats-empty">
        Termine au moins deux grilles {difficulty} pour voir ta progression.
      </p>
    );
  return (
    <div className="progression">
      <div className="progression-head">
        <h4 id={titleId}>
          Temps de tes {results.length} dernières grilles {difficulty}
        </h4>
        <button className="stats-link" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
          {asTable ? "Voir le graphique" : "Voir le tableau"}
        </button>
      </div>
      {trend && (
        <p className="progression-trend">
          {Math.abs(trend.change) < 0.03
            ? "Tes temps récents sont stables."
            : trend.change < 0
              ? `Tu es ${Math.round(-trend.change * 100)} % plus rapide que sur tes grilles précédentes.`
              : `Tes temps récents sont ${Math.round(trend.change * 100)} % plus longs que les précédents.`}
        </p>
      )}
      {asTable ? (
        <table className="progression-table">
          <caption className="sr-only">Temps par grille {difficulty}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Temps</th>
            </tr>
          </thead>
          <tbody>
            {[...results].reverse().map((r) => (
              <tr key={r.completed_at}>
                <td>{new Date(r.completed_at).toLocaleDateString("fr-FR")}</td>
                <td>{formatClock(r.elapsed_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="progression-plot" ref={plotRef}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            role="img"
            aria-labelledby={titleId}
            aria-describedby={`${titleId}-summary`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <desc id={`${titleId}-summary`}>
              Record {formatClock(times[bestIndex])}, dernier temps {formatClock(times[last])}.
            </desc>
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  className="plot-grid"
                  x1={MARGIN.left}
                  x2={WIDTH - MARGIN.right}
                  y1={y(tick)}
                  y2={y(tick)}
                />
                <text className="plot-tick" x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end">
                  {formatClock(tick)}
                </text>
              </g>
            ))}
            <text className="plot-tick" x={MARGIN.left} y={HEIGHT - 6}>
              {dateLabel(results[0].completed_at)}
            </text>
            <text className="plot-tick" x={WIDTH - MARGIN.right} y={HEIGHT - 6} textAnchor="end">
              {dateLabel(results[last].completed_at)}
            </text>
            <path className="plot-line" d={path} />
            {shown !== null && (
              <line
                className="plot-cross"
                x1={x(shown)}
                x2={x(shown)}
                y1={MARGIN.top}
                y2={MARGIN.top + inner.h}
              />
            )}
            {/* The record and the latest time: the two points worth a mark and a label. */}
            <circle className="plot-dot" cx={x(bestIndex)} cy={y(times[bestIndex])} r={4.5} />
            <text
              className="plot-label"
              x={x(bestIndex)}
              y={y(times[bestIndex]) - 10}
              textAnchor={
                x(bestIndex) < WIDTH * 0.25
                  ? "start"
                  : x(bestIndex) > WIDTH * 0.75
                    ? "end"
                    : "middle"
              }
            >
              Record {formatClock(times[bestIndex])}
            </text>
            {bestIndex !== last && (
              <circle className="plot-dot" cx={x(last)} cy={y(times[last])} r={4.5} />
            )}
            {shown !== null && shown !== bestIndex && shown !== last && (
              <circle className="plot-dot" cx={x(shown)} cy={y(times[shown])} r={4.5} />
            )}
          </svg>
          {shown !== null && (
            <div
              className="plot-tooltip"
              role="status"
              style={{ left: `${(x(shown) / WIDTH) * 100}%` }}
            >
              <b>{formatClock(times[shown])}</b>
              <span>{new Date(results[shown].completed_at).toLocaleDateString("fr-FR")}</span>
              {shown === bestIndex && <span>Ton record</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Streak tiles, the table by difficulty and the progression curve of the account page. */
export function PlayerStats({ stats }: { stats: SoloStats }) {
  const played = useMemo(
    () => soloDifficulties.filter((d) => stats.byDifficulty.some((row) => row.difficulty === d)),
    [stats.byDifficulty],
  );
  const mostPlayed = useMemo(
    () =>
      [...stats.byDifficulty].sort((a, b) => b.games - a.games)[0]?.difficulty ??
      soloDifficulties[0],
    [stats.byDifficulty],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const difficulty = chosen ?? mostPlayed;
  const results = useMemo(
    () => progressionFor(stats.history, difficulty),
    [stats.history, difficulty],
  );
  const { streak } = stats;

  return (
    <section className="panel player-stats" aria-labelledby="player-stats-title">
      <h3 id="player-stats-title">Statistiques</h3>
      <div className="streak-row">
        <div className="streak-tile">
          <span>Série en cours</span>
          <b>
            <Flame aria-hidden="true" className={streak.current ? "lit" : ""} />
            {streak.current} jour{streak.current > 1 ? "s" : ""}
          </b>
          <small>
            {streak.current === 0
              ? "Termine une grille aujourd’hui pour lancer une série."
              : streak.playedToday
                ? "Prolongée aujourd’hui."
                : "Joue aujourd’hui pour la prolonger."}
          </small>
        </div>
        <div className="streak-tile">
          <span>Meilleure série</span>
          <b>
            {streak.best} jour{streak.best > 1 ? "s" : ""}
          </b>
          <small>Grilles solo, défis du jour et défis hebdo.</small>
        </div>
      </div>

      {played.length > 0 ? (
        <>
          <table className="difficulty-table">
            <caption>Par difficulté</caption>
            <thead>
              <tr>
                <th scope="col">Difficulté</th>
                <th scope="col">Grilles</th>
                <th scope="col">Meilleur</th>
                <th scope="col">Moyen</th>
              </tr>
            </thead>
            <tbody>
              {played.map((name) => {
                const row = stats.byDifficulty.find((r) => r.difficulty === name)!;
                return (
                  <tr key={name}>
                    <th scope="row">{name}</th>
                    <td>{row.games}</td>
                    <td>{formatClock(row.best)}</td>
                    <td>{formatClock(row.average)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="stats-filter" role="radiogroup" aria-label="Difficulté du graphique">
            {played.map((name) => (
              <button
                key={name}
                role="radio"
                aria-checked={name === difficulty}
                className={name === difficulty ? "active" : ""}
                onClick={() => setChosen(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <ProgressionChart results={results} difficulty={difficulty} />
        </>
      ) : (
        <p className="stats-empty">Termine une grille solo pour voir tes statistiques.</p>
      )}
    </section>
  );
}
