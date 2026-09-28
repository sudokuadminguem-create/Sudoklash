import type { AchievementProgress } from "./achievement-frames";
import { progressFor } from "./cosmetics";

type SoloRow = { difficulty: string; elapsed_seconds: number; completed_at: number; mistakes:number|null; hints_used:number|null };
type PeriodRow = { id: string; mistakes: number; elapsed_seconds:number|null; completed_at:number };
type MatchRow = {
  player1_id: string;
  player2_id: string;
  winner_id: string | null;
  player1_progress: number;
  player2_progress: number;
  started_at: number;
  difficulty:string;
  player1_mistakes:number;
  player2_mistakes:number;
  player1_points_before:number|null;
  player2_points_before:number|null;
  player1_points_change:number|null;
  player2_points_change:number|null;
};
function streak(ids: string[], step: number) {
  const sorted = [...new Set(ids.map((id) => Date.parse(id)).filter(Number.isFinite))].sort(
    (a, b) => a - b,
  );
  let best = 0,
    current = 0,
    last = 0;
  for (const day of sorted) {
    current = day - last === step ? current + 1 : 1;
    best = Math.max(best, current);
    last = day;
  }
  return best;
}
export async function achievementProgress(
  db: D1Database,
  userId: string,
  points: number,
): Promise<AchievementProgress> {
  const [solos, dailies, weeklies, matches, friends] = await Promise.all([
    db
      .prepare(
        "SELECT r.difficulty,r.elapsed_seconds,r.completed_at,g.mistakes,g.hints_used FROM solo_results r LEFT JOIN solo_games g ON g.id=r.id AND g.user_id=r.user_id WHERE r.user_id=? ORDER BY r.completed_at",
      )
      .bind(userId)
      .all<SoloRow>(),
    db
      .prepare(
        "SELECT day_id AS id,mistakes,elapsed_seconds,completed_at FROM daily_attempts WHERE user_id=? AND completed_at IS NOT NULL",
      )
      .bind(userId)
      .all<PeriodRow>(),
    db
      .prepare(
        "SELECT week_id AS id,mistakes,elapsed_seconds,completed_at FROM weekly_attempts WHERE user_id=? AND completed_at IS NOT NULL",
      )
      .bind(userId)
      .all<PeriodRow>(),
    db
      .prepare(
        "SELECT player1_id,player2_id,winner_id,player1_progress,player2_progress,started_at,difficulty,player1_mistakes,player2_mistakes,player1_points_before,player2_points_before,player1_points_change,player2_points_change FROM ranked_matches WHERE (player1_id=? OR player2_id=?) AND status='finished' ORDER BY started_at",
      )
      .bind(userId, userId)
      .all<MatchRow>(),
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM friendships WHERE status='accepted' AND (requester_id=? OR addressee_id=?)",
      )
      .bind(userId, userId)
      .first<{ n: number }>(),
  ]);
  const solo = solos.results,
    daily = dailies.results,
    weekly = weeklies.results,
    ranked = matches.results;
  const wins = ranked.filter((row) => row.winner_id === userId);
  const parisDay = (timestamp:number)=>{
    const parts=new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(timestamp));
    const part=(type:string)=>parts.find(p=>p.type===type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const parisClock = (timestamp:number)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(timestamp));
  const soloDates=solo.map(r=>parisDay(r.completed_at));
  const cleanSolo=solo.filter(r=>r.mistakes===0);
  const noHintSolo=solo.filter(r=>r.hints_used===0);
  const perfectSolo=solo.filter(r=>r.mistakes===0&&r.hints_used===0);
  const dailyClean=daily.filter(r=>r.mistakes===0);
  const weeklyIds=new Set(weekly.map(r=>r.id));
  const weekFor=(date:string)=>{const d=new Date(date+"T00:00:00Z"),weekday=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-weekday);return d.toISOString().slice(0,10)};
  const daysByWeek=new Map<string,Set<string>>();
  for(const row of daily){const week=weekFor(row.id);if(!daysByWeek.has(week))daysByWeek.set(week,new Set());daysByWeek.get(week)!.add(row.id)}
  const soloPerDay=new Map<string,number>();
  for(const date of soloDates)soloPerDay.set(date,(soloPerDay.get(date)??0)+1);
  const ownMistakes=(r:MatchRow)=>r.player1_id===userId?r.player1_mistakes:r.player2_mistakes;
  const myProgress=(r:MatchRow)=>r.player1_id===userId?r.player1_progress:r.player2_progress;
  const theirProgress=(r:MatchRow)=>r.player1_id===userId?r.player2_progress:r.player1_progress;
  const peakPoints=Math.max(points,...ranked.map(r=>{const first=r.player1_id===userId;return (first?r.player1_points_before:r.player2_points_before)??0}),...ranked.map(r=>{const first=r.player1_id===userId;return ((first?r.player1_points_before:r.player2_points_before)??0)+((first?r.player1_points_change:r.player2_points_change)??0)}));
  let winStreak = 0,
    bestWinStreak = 0;
  for (const match of ranked) {
    winStreak = match.winner_id === userId ? winStreak + 1 : 0;
    bestWinStreak = Math.max(bestWinStreak, winStreak);
  }
  const opponents = new Set(
    ranked.map((row) => (row.player1_id === userId ? row.player2_id : row.player1_id)),
  );
  const wide = wins.filter(row=>myProgress(row)-theirProgress(row)>=10).length;
  const close = wins.filter(row=>myProgress(row)-theirProgress(row)===1).length;
  const xp = progressFor({
    solo: solo.length,
    daily: daily.length,
    weekly: weekly.length,
    wins: wins.length,
    losses: ranked.length - wins.length,
  });
  return {
    solo: solo.length,
    beginner: solo.filter((r) => r.difficulty === "Débutant").length,
    easy: solo.filter((r) => r.difficulty === "Facile").length,
    medium: solo.filter((r) => r.difficulty === "Intermédiaire").length,
    hard: solo.filter((r) => r.difficulty === "Difficile").length,
    expert: solo.filter((r) => r.difficulty === "Expert").length,
    master: solo.filter((r) => r.difficulty === "Maître").length,
    fast5: solo.filter((r) => r.elapsed_seconds < 300).length,
    fast10: solo.filter((r) => r.elapsed_seconds < 600).length,
    fast20: solo.filter((r) => r.elapsed_seconds < 1200).length,
    daily: daily.length,
    weekly: weekly.length,
    dailyClean: dailyClean.length,
    weeklyClean: weekly.filter((r) => r.mistakes === 0).length,
    dailyStreak: streak(
      daily.map((r) => r.id),
      86400000,
    ),
    weeklyStreak: streak(
      weekly.map((r) => r.id),
      7 * 86400000,
    ),
    ranked: ranked.length,
    wins: wins.length,
    rankedStreak: bestWinStreak,
    friends: friends?.n ?? 0,
    opponents: opponents.size,
    points:peakPoints,
    level: xp.level,
    xp: xp.xp,
    frames: 0,
    soloDays: new Set(soloDates).size,
    dailyDays: daily.length,
    weeklyTop: 0,
    soloBest: solo.length ? Math.min(...solo.map((r) => r.elapsed_seconds)) : 0,
    rankedClose: close,
    rankedWide: wide,
    soloClean:cleanSolo.length,
    soloNoHint:noHintSolo.length,
    soloPerfect:perfectSolo.length,
    masterClean:cleanSolo.filter(r=>r.difficulty==="Maître").length,
    expertClean:cleanSolo.filter(r=>r.difficulty==="Expert").length,
    soloMaxDay:Math.max(0,...soloPerDay.values()),
    soloAt909:solo.filter(r=>parisClock(r.completed_at)==="09:09").length,
    soloTime909:solo.filter(r=>r.elapsed_seconds===549).length,
    soloAt2359:solo.filter(r=>parisClock(r.completed_at)==="23:59").length,
    soloAt0000:solo.filter(r=>parisClock(r.completed_at)==="00:00").length,
    doubleChallengeDays:weekly.filter(r=>daily.some(d=>d.id===parisDay(r.completed_at))).length,
    perfectWeeks:weekly.filter(r=>weeklyIds.has(r.id)&&(daysByWeek.get(r.id)?.size??0)===7).length,
    soloStreak:streak(soloDates,86400000),
    allDifficulties:Math.min(...["Débutant","Facile","Intermédiaire","Difficile","Expert","Maître"].map(d=>solo.filter(r=>r.difficulty===d).length)),
    dailyFast10:daily.filter(r=>(r.elapsed_seconds??Infinity)<600).length,
    weeklyFast30:weekly.filter(r=>(r.elapsed_seconds??Infinity)<1800).length,
    dailyCleanStreak:streak(dailyClean.map(r=>r.id),86400000),
    rankedCleanWins:wins.filter(r=>ownMistakes(r)===0).length,
    rankedEasyWins:wins.filter(r=>r.difficulty==="Facile").length,
    rankedMediumWins:wins.filter(r=>r.difficulty==="Intermédiaire").length,
    rankedHardWins:wins.filter(r=>r.difficulty==="Difficile").length,
    rankedExpertWins:wins.filter(r=>r.difficulty==="Expert").length,
    rankedMasterWins:wins.filter(r=>r.difficulty==="Maître").length,
    epicFrames:0,
    otherFrames:0,
  };
}
