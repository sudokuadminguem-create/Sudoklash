import { tournamentMinimum, tournamentPrizes } from "./tournament-rules";

export const tournamentNetSQL =
  "(SELECT COALESCE(SUM(payout-fee),0) FROM tournament_entries WHERE user_id=?)";
export async function settleTournaments(db: D1Database, now = Date.now(), userId?: string) {
  const pending = await db
    .prepare(
      `SELECT t.id,t.ends_at FROM tournaments t WHERE t.settled IS NULL AND t.starts_at<=? AND
    (t.ends_at<=? OR (SELECT COUNT(*) FROM tournament_entries WHERE tournament_id=t.id)<?)
    ${userId ? "AND EXISTS(SELECT 1 FROM tournament_entries WHERE tournament_id=t.id AND user_id=?)" : ""}
    ORDER BY t.starts_at LIMIT 30`,
    )
    .bind(now, now, tournamentMinimum, ...(userId ? [userId] : []))
    .all<{ id: string; ends_at: number }>();
  for (const { id, ends_at } of pending.results) {
    const rows = (
      await db
        .prepare(
          "SELECT user_id,fee,finished_at,mistakes FROM tournament_entries WHERE tournament_id=? ORDER BY finished_at IS NULL,finished_at,mistakes,joined_at,user_id",
        )
        .bind(id)
        .all<{ user_id: string; fee: number; finished_at: number | null; mistakes: number }>()
    ).results;
    const winners = rows.filter((r) => r.finished_at !== null).slice(0, 25);
    const cancelled = rows.length < tournamentMinimum || !winners.length;
    if (!cancelled && ends_at > now) continue;
    const payouts = tournamentPrizes(
      rows.reduce((sum, r) => sum + r.fee, 0),
      cancelled ? 0 : winners.length,
    );
    // Equal times and mistakes share the prizes of their occupied paid places.
    for (let i = 0; i < winners.length && !cancelled;) {
      let j = i + 1;
      while (
        j < winners.length &&
        winners[j].finished_at === winners[i].finished_at &&
        winners[j].mistakes === winners[i].mistakes
      )
        j++;
      const sum = payouts.slice(i, j).reduce((a, b) => a + b, 0);
      for (let k = i; k < j; k++)
        payouts[k] = Math.floor(sum / (j - i)) + (k - i < sum % (j - i) ? 1 : 0);
      i = j;
    }
    const recipients = cancelled ? rows : winners;
    // Chunk the refund so no statement exceeds D1's parameter limit.
    const writes: D1PreparedStatement[] = [];
    for (let i = 0; i < recipients.length; i += 24) {
      const group = recipients.slice(i, i + 24);
      writes.push(
        db
          .prepare(
            `UPDATE tournament_entries SET payout=CASE user_id ${group.map(() => "WHEN ? THEN ?").join(" ")} END WHERE tournament_id=? AND user_id IN (${group.map(() => "?").join(",")}) AND EXISTS(SELECT 1 FROM tournaments WHERE id=? AND settled IS NULL)`,
          )
          .bind(
            ...group.flatMap((r, j) => [r.user_id, cancelled ? r.fee : payouts[i + j]]),
            id,
            ...group.map((r) => r.user_id),
            id,
          ),
      );
    }
    await db.batch([
      ...writes,
      db
        .prepare("UPDATE tournaments SET settled=? WHERE id=? AND settled IS NULL")
        .bind(cancelled ? "cancelled" : "finished", id),
    ]);
  }
}
