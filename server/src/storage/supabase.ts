import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
  }
  return supabaseClient;
}

/**
 * 1 soatlik imzolangan yuklash havolasi yaratish (Signed Upload URL)
 */
export async function createSignedUploadUrl(path: string): Promise<{ signedUrl: string; token: string }> {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(env.STORAGE_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(`Imzolangan yuklash havolasini yaratishda xatolik: ${error?.message || 'Noma’lum xato'}`);
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
  };
}

/**
 * 1 soatlik imzolangan o'qish/ko'rish havolasi yaratish (Signed Download URL)
 */
export async function createSignedDownloadUrl(path: string): Promise<string> {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(env.STORAGE_BUCKET).createSignedUrl(path, 3600); // 1 soat (3600 soniya)

  if (error || !data?.signedUrl) {
    throw new Error(`Imzolangan ko‘rish havolasini yaratishda xatolik: ${error?.message || 'Noma’lum xato'}`);
  }

  return data.signedUrl;
}
