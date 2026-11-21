export type LiveTournament =
  | {
      live: true;
      total: number;
      ranking: {
        place: number;
        name: string;
        correct: number;
        status: "playing" | "finished" | "eliminated";
      }[];
      leader: { givens: string; grid: string } | null;
    }
  | { live: false };
