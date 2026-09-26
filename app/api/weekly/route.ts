import { weeklyChallenge, timedChallengeRoute } from "@/lib/timed-challenge";

export const dynamic = "force-dynamic";

const route = timedChallengeRoute(weeklyChallenge);
export const GET = route.GET;
export const POST = route.POST;
