/* NEW NOOR only. This is a PUBLIC publishable key, not a secret.
   Provider keys (Gemini/Brevo) must remain in Edge Function Secrets.
   All entry points use the same destination project; no alternate database fallback. */
window.NOOR_V2_CONFIG=Object.freeze({
 SUPABASE_URL:"https://ayrryemawwplguaauxij.supabase.co",
 SUPABASE_PUBLISHABLE_KEY:"sb_publishable_2e16MAulIE1locqlRov9iQ_VWtCjwOG",
 PROFILE_BUCKET:"noor-profile-photos"
});