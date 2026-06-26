import { supabase } from "./supabaseClient";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(path, { ...options, headers });
}
