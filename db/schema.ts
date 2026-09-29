import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const weeklyAttempts = sqliteTable(
  "weekly_attempts",
  {
    userId: text("user_id").notNull(),
    weekId: text("week_id").notNull(),
    startedAt: integer("started_at").notNull(),
    completedAt: integer("completed_at"),
    elapsedSeconds: integer("elapsed_seconds"),
    mistakes: integer("mistakes").notNull().default(0),
    lastMistakeId: text("last_mistake_id"),
    puzzle: text("puzzle"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.weekId] }),
    index("idx_weekly_attempts_leaderboard").on(
      table.weekId,
      table.completedAt,
      table.elapsedSeconds,
    ),
  ],
);

export const dailyAttempts = sqliteTable(
  "daily_attempts",
  {
    userId: text("user_id").notNull(),
    dayId: text("day_id").notNull(),
    startedAt: integer("started_at").notNull(),
    completedAt: integer("completed_at"),
    elapsedSeconds: integer("elapsed_seconds"),
    mistakes: integer("mistakes").notNull().default(0),
    lastMistakeId: text("last_mistake_id"),
    puzzle: text("puzzle").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.dayId] }),
    index("idx_daily_attempts_leaderboard").on(
      table.dayId,
      table.completedAt,
      table.elapsedSeconds,
    ),
  ],
);

export const challengeSettings = sqliteTable("challenge_settings", {
  challengeType: text("challenge_type").primaryKey(),
  title: text("title").notNull(),
  puzzle: text("puzzle").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const playerProfiles = sqliteTable("player_profiles", {
  userId: text("user_id").primaryKey(),
  username: text("username").notNull().unique(),
  usernameKey: text("username_key").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const playerCosmetics = sqliteTable("player_cosmetics", {
  userId: text("user_id").primaryKey(),
  avatarId: text("avatar_id").notNull().default("nova"),
  frameId: text("frame_id").notNull().default("starter"),
  themeId: text("theme_id").notNull().default("ocean"),
  profileCardId: text("profile_card_id").notNull().default("origin"),
  profileTitleId: text("profile_title_id").notNull().default("none"),
});

export const playerAvatarImages = sqliteTable("player_avatar_images", {
  userId: text("user_id").primaryKey(),
  imageData: text("image_data").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const cosmeticPurchases = sqliteTable(
  "cosmetic_purchases",
  {
    userId: text("user_id").notNull(),
    itemId: text("item_id").notNull(),
    price: integer("price").notNull(),
    purchasedAt: integer("purchased_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.itemId] })],
);

export const achievementUnlocks = sqliteTable(
  "achievement_unlocks",
  {
    userId: text("user_id").notNull(),
    achievementId: text("achievement_id").notNull(),
    unlockedAt: integer("unlocked_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.achievementId] })],
);

export const soloResults = sqliteTable(
  "solo_results",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    difficulty: text("difficulty").notNull(),
    elapsedSeconds: integer("elapsed_seconds").notNull(),
    completedAt: integer("completed_at").notNull(),
  },
  (table) => [index("idx_solo_results_user").on(table.userId, table.completedAt)],
);

export const friendships = sqliteTable(
  "friendships",
  {
    id: text("id").primaryKey(),
    pairKey: text("pair_key").notNull().unique(),
    requesterId: text("requester_id").notNull(),
    addresseeId: text("addressee_id").notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_friendships_requester").on(table.requesterId),
    index("idx_friendships_addressee").on(table.addresseeId),
  ],
);

export const rankedQueue = sqliteTable(
  "ranked_queue",
  {
    userId: text("user_id").primaryKey(),
    queuedAt: integer("queued_at").notNull(),
    heartbeatAt: integer("heartbeat_at").notNull(),
    matchId: text("match_id"),
    difficulty: text("difficulty").notNull().default("Intermédiaire"),
  },
  (table) => [index("idx_ranked_queue_waiting").on(table.matchId, table.queuedAt)],
);

export const rankedRatings = sqliteTable(
  "ranked_ratings",
  {
    userId: text("user_id").primaryKey(),
    points: integer("points").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [index("idx_ranked_ratings_points").on(table.points, table.userId)],
);

export const rankedMatches = sqliteTable(
  "ranked_matches",
  {
    id: text("id").primaryKey(),
    player1Id: text("player1_id").notNull(),
    player2Id: text("player2_id").notNull(),
    puzzle: text("puzzle").notNull(),
    solution: text("solution").notNull(),
    startedAt: integer("started_at").notNull(),
    status: text("status").notNull().default("playing"),
    winnerId: text("winner_id"),
    player1Progress: integer("player1_progress").notNull().default(0),
    player2Progress: integer("player2_progress").notNull().default(0),
    // Cells each player has had confirmed by the server: 81 characters of 0/1, "" at the start.
    player1Solved: text("player1_solved").notNull().default(""),
    player2Solved: text("player2_solved").notNull().default(""),
    player1Mistakes: integer("player1_mistakes").notNull().default(0),
    player2Mistakes: integer("player2_mistakes").notNull().default(0),
    player1LastMistakeId: text("player1_last_mistake_id"),
    player2LastMistakeId: text("player2_last_mistake_id"),
    finishedAt: integer("finished_at"),
    difficulty: text("difficulty").notNull().default("Intermédiaire"),
    ratedAt: integer("rated_at"),
    ratingToken: text("rating_token"),
    player1PointsBefore: integer("player1_points_before"),
    player2PointsBefore: integer("player2_points_before"),
    player1PointsChange: integer("player1_points_change"),
    player2PointsChange: integer("player2_points_change"),
    finishReason: text("finish_reason"),
    // Last request from each player during the match, to detect abandons.
    player1SeenAt: integer("player1_seen_at"),
    player2SeenAt: integer("player2_seen_at"),
  },
  (table) => [
    index("idx_ranked_matches_player1").on(table.player1Id, table.startedAt),
    index("idx_ranked_matches_player2").on(table.player2Id, table.startedAt),
  ],
);

// Solo games handed out by the server: it keeps the solution and measures the time.
export const soloGames = sqliteTable(
  "solo_games",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    difficulty: text("difficulty").notNull(),
    puzzle: text("puzzle").notNull(),
    solution: text("solution").notNull(),
    startedAt: integer("started_at").notNull(),
    mistakes: integer("mistakes").notNull().default(0),
    lastMistakeId: text("last_mistake_id"),
    hintsUsed: integer("hints_used").notNull().default(0),
    completedAt: integer("completed_at"),
  },
  (table) => [index("idx_solo_games_user").on(table.userId, table.completedAt)],
);
