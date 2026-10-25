import { supabase } from './supabaseClient';
export async function signInAndResolveDestination(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { automaticRedirectUrl: '/institution/dashboard' };
}
