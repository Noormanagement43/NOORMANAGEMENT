import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const src=read('noor-calendar-import.js');
test('Scanned-PDF local OCR renders image-only pages and requires principal-reviewed dates',async()=>{
 const messages=[],calls=[];
 const mockPage={
  async getTextContent(){return {items:[]}},
  getViewport(){return {width:700,height:900}},
  render(){calls.push('render');return {promise:Promise.resolve()}},
  cleanup(){}
 };
 const win={
  PDF_MOCK:{GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>mockPage})})},
  Tesseract:{async createWorker(){calls.push('createWorker');return {
   async recognize(){calls.push('recognize');return {data:{text:'November 2026\n18 Wed School Holiday - Diwali'}}},
   async terminate(){calls.push('terminate')}
  }}}
 };
 const code=src.replace("await import(url+'pdf.min.mjs')",'await Promise.resolve(window.PDF_MOCK)')
  .replace('window.NOOR_CALENDAR_IMPORT=Object.freeze({open,parseLines,parseIcs,lineDate});',
   'window.NOOR_CALENDAR_IMPORT=Object.freeze({open,parseLines,parseIcs,lineDate,parsePdf});');
 const context={window:win,Uint8Array,ArrayBuffer,Date,Intl,Number,Map,Set,Error,Promise,
  document:{createElement:()=>({width:0,height:0,getContext:()=>({})})}};
 vm.runInNewContext(code,context);
 const file={size:10000,arrayBuffer:async()=>new ArrayBuffer(5)};
 const rows=await win.NOOR_CALENDAR_IMPORT.parsePdf(file,msg=>messages.push(msg),'eng');
 assert.equal(rows.length,1);
 assert.equal(rows[0].date,'2026-11-18');
 assert.equal(rows[0].kind,'holiday');
 assert.equal(rows[0].ocr,true);
 assert.deepEqual(calls,['createWorker','render','recognize','terminate']);
 assert.ok(messages.some(x=>/OCR page/.test(x)));
});
test('OCR language and memory safety, as well as explicit school confirmation',()=>{
 assert.match(src,/createWorker\(language==='eng'\?'eng':\['eng',language\]/);
 assert.match(src,/needsOcr\.length>12/);
 assert.match(src,/viewport\.width\*viewport\.height>12000000/);
 assert.match(src,/Approve & Import/);
 assert.match(src,/noor_calendar_day_overrides/);
});
test('OAuth server stores only AES-GCM ciphertext, claims state once, checks membership',()=>{
 const api=read('supabase/functions/noor-google-oauth/index.ts');
 assert.match(api,/AES-GCM/);
 assert.match(api,/noor_claim_google_oauth_state/);
 assert.match(api,/institution_memberships/);
 assert.match(api,/allowedRoles/);
 assert.match(api,/access_type:'offline'/);
 assert.match(api,/code_challenge_method:'S256'/);
 assert.match(api,/outbound_enabled:false/);
 assert.match(api,/calendar\.readonly/);
 assert.doesNotMatch(api,/console\.log\(/);
 const migration=read('supabase/migrations/20261118153000_secure_google_calendar_oauth.sql');
 assert.match(migration,/noor_google_oauth_credentials/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all on public\.noor_google_oauth_credentials from anon, authenticated, public/);
 assert.match(migration,/grant execute on function public\.noor_claim_google_oauth_state\(text\) to service_role/);
});
test('Private Google connection uses the same NOOR calendar and preserves public fallback',()=>{
 const c=read('noor-school-calendar.js');
 assert.match(c,/noor-google-oauth/);
 assert.match(c,/noor-public-google-calendar/);
 assert.match(c,/nscGoogleOAuth/);
 assert.match(c,/nscGooglePrivateSelect/);
 assert.match(c,/nscGooglePublish/);
 assert.match(c,/st\.googleEvents/);
 assert.match(c,/schoolDayStatus/);
 assert.match(c,/action:'publish'/);
 assert.match(c,/action:'deletePublished'/);
});
