import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('../supabase/migrations/',import.meta.url);
const history=JSON.parse(fs.readFileSync(new URL('../supabase/migration-history.json',import.meta.url),'utf8'));
test('active migration chain matches recorded destination history without legacy duplicates',()=>{
 const files=fs.readdirSync(root).filter(x=>x.endsWith('.sql')),versions=new Set();
 for(const file of files){assert.match(file,/^\d{14}_[a-z0-9_]+\.sql$/);const v=file.slice(0,14);assert.ok(!versions.has(v),'Duplicate version '+v);versions.add(v);}
 for(const entry of history.migrations){
  assert.ok(files.includes(entry.file),'Missing applied migration '+entry.file);
  const sha=crypto.createHash('sha256').update(fs.readFileSync(new URL(entry.file,root))).digest('hex');
  assert.equal(sha,entry.sha256,'Applied migration changed: '+entry.file);
 }
 assert.equal(history.project_ref,'ayrryemawwplguaauxij');
});
