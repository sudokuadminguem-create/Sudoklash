import {createClient} from "@supabase/supabase-js";
import {authCookieStorage} from "./auth-cookie-storage";

// Public client configuration is embedded in the browser bundle at build time.
const url=process.env.NEXT_PUBLIC_SUPABASE_URL || "https://lxppazlcvjfwumtbkibn.supabase.co";
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_2MtK14MvID1XTFJTD-rwKw_qP9Af17Y";

if(!url||!key) throw new Error("Configuration Supabase manquante");

export const supabase=createClient(url,key,{
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:authCookieStorage},
});
