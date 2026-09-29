import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[a-f0-9-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  if (!env.DB) return new Response(null, { status: 503 });
  const row = await env.DB.prepare(
    "SELECT i.image_data FROM player_avatar_images i JOIN player_cosmetics c ON c.user_id=i.user_id WHERE i.user_id=? AND c.avatar_id='custom'",
  )
    .bind(id)
    .first<{ image_data: string }>();
  const match = row?.image_data.match(
    /^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/,
  );
  if (!match) return new Response(null, { status: 404 });
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "Content-Type": `image/${match[1]}`,
      "Cache-Control": "public, max-age=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
