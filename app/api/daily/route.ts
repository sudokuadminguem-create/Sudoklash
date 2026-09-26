import { dailyChallenge, timedChallengeRoute } from "@/lib/timed-challenge";

export const dynamic = "force-dynamic";

const route = timedChallengeRoute(dailyChallenge);
export const GET = route.GET;
export const POST = route.POST;
