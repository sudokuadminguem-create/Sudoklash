# Account deletion activation

Set `SUPABASE_SERVICE_ROLE_KEY` as a **secret server environment variable** on the deployed Site (and on any standalone server). Obtain the key from the Supabase project API settings. Never place it in browser code, GitHub, a `NEXT_PUBLIC_` variable or a chat message.

The Privacy settings display connection details from the verified Supabase account. Account deletion remains disabled until the server key and D1 binding are configured. The API never accepts a target account ID from the browser: it deletes only the account identified by the verified bearer token, after explicit `SUPPRIMER` confirmation.

Deletion removes the Supabase identity and then personal game records, photographs, cosmetics, progression and friendships. Shared game results retain anonymous participant IDs so another player's history remains usable; open shared games are cancelled. If the identity deletion succeeds but D1 cleanup fails, the route reports `cleanup_required` and logs the account ID for administrative cleanup. The administrator must finish that cleanup before treating the deletion as complete.
