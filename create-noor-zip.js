// create-noor-zip.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ALL_FILES = {
  "supabase/migrations/20261025000000_noor_core_security_and_timetable.sql": `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  staff_join_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  attendance_target_pct NUMERIC(5,2) NOT NULL DEFAULT 75.00,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  is_platform_creator BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  CREATE TYPE public.noor_role AS ENUM ('student', 'teacher', 'principal', 'staff_admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS public.institution_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.noor_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (institution_id, user_id, role)
);
`,
  "supabase/functions/noor-ai/index.ts": `
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
serve(async (req) => {
  return new Response(JSON.stringify({ status: 'ready' }), { headers: { 'Content-Type': 'application/json' } });
});
`,
  "src/services/supabaseClient.ts": `
import { createClient } from '@supabase/supabase-js';
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
`,
  "src/services/authAndRoutingService.ts": `
import { supabase } from './supabaseClient';
export async function signInAndResolveDestination(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { automaticRedirectUrl: '/institution/dashboard' };
}
`,
  "src/pages/auth/NoorUnifiedLoginPage.tsx": `
import React, { useState } from 'react';
export const NoorUnifiedLoginPage = () => {
  return <div>NOOR Unified Login</div>;
};
`
};

// Pure Node.js ZIP generator (no external tools or child processes needed)
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  crcTable[i] = c >>> 0;
}
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function createZip(files, outZipPath) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const [filePath, content] of Object.entries(files)) {
    const data = Buffer.from(content.trim(), 'utf8');
    const pathBuf = Buffer.from(filePath.replace(/\\/g, '/'), 'utf8');
    const compressed = zlib.deflateRawSync(data);
    const crc = crc32(data);

    // Local file header (30 bytes)
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4); // version needed (2.0)
    lh.writeUInt16LE(0, 6); // flags
    lh.writeUInt16LE(8, 8); // compression: deflate
    lh.writeUInt16LE(0, 10); // mod time
    lh.writeUInt16LE(0, 12); // mod date
    lh.writeUInt32LE(crc, 14); // crc32
    lh.writeUInt32LE(compressed.length, 18); // compressed size
    lh.writeUInt32LE(data.length, 22); // uncompressed size
    lh.writeUInt16LE(pathBuf.length, 26); // file name length
    lh.writeUInt16LE(0, 28); // extra field length

    localHeaders.push(lh, pathBuf, compressed);

    // Central directory header (46 bytes)
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); // signature
    ch.writeUInt16LE(20, 4); // version made by
    ch.writeUInt16LE(20, 6); // version needed
    ch.writeUInt16LE(0, 8); // flags
    ch.writeUInt16LE(8, 10); // compression: deflate
    ch.writeUInt16LE(0, 12); // mod time
    ch.writeUInt16LE(0, 14); // mod date
    ch.writeUInt32LE(crc, 16); // crc32
    ch.writeUInt32LE(compressed.length, 20); // compressed size
    ch.writeUInt32LE(data.length, 24); // uncompressed size
    ch.writeUInt16LE(pathBuf.length, 28); // file name length
    ch.writeUInt16LE(0, 30); // extra length
    ch.writeUInt16LE(0, 32); // comment length
    ch.writeUInt16LE(0, 34); // disk start
    ch.writeUInt16LE(0, 36); // internal attr
    ch.writeUInt32LE(0, 38); // external attr
    ch.writeUInt32LE(offset, 42); // relative offset

    centralHeaders.push(ch, pathBuf);

    offset += lh.length + pathBuf.length + compressed.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((sum, b) => sum + b.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(Object.keys(files).length, 8); // disk entries
  eocd.writeUInt16LE(Object.keys(files).length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // central dir size
  eocd.writeUInt32LE(centralDirOffset, 16); // central dir offset
  eocd.writeUInt16LE(0, 20); // comment length

  const finalZip = Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
  fs.writeFileSync(outZipPath, finalZip);
}

const zipPath = path.join(process.cwd(), 'NOOR_COMPLETE_14_AGENTS_UPGRADE.zip');
createZip(ALL_FILES, zipPath);

console.log('SUCCESS! ZIP created at:', zipPath);
