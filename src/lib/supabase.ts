import { createClient } from "@supabase/supabase-js";

/**
 * サーバーサイド専用クライアント。
 * service_role キーを使うため RLS をバイパスし、全行にアクセスできる。
 * このファイルをクライアントコンポーネントから import してはいけない。
 */
export function getServerSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
