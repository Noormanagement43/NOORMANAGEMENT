import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
serve(async (req) => {
  return new Response(JSON.stringify({ status: 'ready' }), { headers: { 'Content-Type': 'application/json' } });
});
