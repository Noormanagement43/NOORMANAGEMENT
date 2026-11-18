import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const PROJECT='https://ayrryemawwplguaauxij.supabase.co';
const CALLBACK=PROJECT+'/functions/v1/noor-google-oauth';
const SITE='https://noormanagement43.github.io';
const APP=SITE+'/NOORMANAGEMENT/';
const allowedRoles=['principal','school_admin','university_admin','academic_admin'];
const validUuid=(s:string)=>/^[0-9a-f-]{36}$/i.test(s);
const rnd=(n:number)=>crypto.getRandomValues(new Uint8Array(n));
const b64url=(x:Uint8Array)=>btoa(String.fromCharCode(...x)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const sha=async(x:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x))),v=>v.toString(16).padStart(2,'0')).join('');
const baseHeaders:Record<string,string>={
 'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
 'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'};
function cfg(){
 const id=Deno.env.get('NOOR_GOOGLE_CLIENT_ID')||'',secret=Deno.env.get('NOOR_GOOGLE_CLIENT_SECRET')||'',
       key=Deno.env.get('NOOR_GOOGLE_TOKEN_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 try{if(!id||!secret||!service||Uint8Array.from(atob(key),c=>c.charCodeAt(0)).length!==32)return null;}catch{return null;}
 return {id,secret,key,service};
}
function callbackPage(ok:boolean){
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width"><title>NOOR Google Calendar</title></head><body style="font:16px system-ui;max-width:540px;margin:14vh auto;padding:25px;color:#54243b"><h2>'
 +(ok?'Google Calendar connection authorized':'Google Calendar connection failed')+'</h2><p>'
 +(ok?'Return to NOOR to select which school Google calendar should appear.':'Retry Google connection from your NOOR School Calendar.')+'</p><p><a href="'+APP+'">Return to NOOR</a></p><script>try{window.opener?.postMessage({type:"noor-google-oauth",connected:'+String(ok)+'},"'+SITE+'");window.close()}catch(e){}</script></body></html>';
 return new Response(html,{status:ok?200:400,headers:{
  'Content-Type':'text/html;charset=UTF-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"default-src 'none';style-src 'unsafe-inline';script-src 'unsafe-inline';base-uri 'none';frame-ancestors 'none'"}});
}
async function keyObject(key:string){
 return await crypto.subtle.importKey('raw',Uint8Array.from(atob(key),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt','decrypt']);
}
async function encrypt(token:string,key:string){
 const iv=rnd(12),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await keyObject(key),new TextEncoder().encode(token));
 return {token_ciphertext:btoa(String.fromCharCode(...new Uint8Array(cipher))),token_iv:btoa(String.fromCharCode(...iv))};
}
async function decrypt(row:any,key:string){
 const iv=Uint8Array.from(atob(row.token_iv),c=>c.charCodeAt(0));
 const cipher=Uint8Array.from(atob(row.token_ciphertext),c=>c.charCodeAt(0));
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},await keyObject(key),cipher);
 return new TextDecoder().decode(plain);
}
async function getToken(data:Record<string,string>,conf:any){
 const form=new URLSearchParams({...data,client_id:conf.id,client_secret:conf.secret});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('Google authorization failed');
 return await r.json();
}
async function google(access:string,path:string,method='GET',payload?:unknown){
 const r=await fetch('https://www.googleapis.com/calendar/v3/'+path,{method,
  headers:{Authorization:'Bearer '+access,'Accept':'application/json',...(payload?{'Content-Type':'application/json'}:{})},
  body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(9500)});
 const data=r.status===204?null:await r.json().catch(()=>null);
 return {ok:r.ok,status:r.status,data};
}
export async function handle(req:Request):Promise<Response>{
 const origin=req.headers.get('origin'),headers={...baseHeaders};
 const send=(code:number,payload:unknown)=>new Response(JSON.stringify(payload),{status:code,headers});
 if(origin&&origin!==SITE)return send(403,{error:'Origin is not permitted'});
 if(origin)headers['Access-Control-Allow-Origin']=origin;
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 const conf=cfg();
 if(req.method==='GET'){
  if(!conf)return callbackPage(false);
  const u=new URL(req.url),code=u.searchParams.get('code')||'',state=u.searchParams.get('state')||'';
  if(!code||!state||code.length>4000||state.length>200)return callbackPage(false);
  const admin=createClient(PROJECT,conf.service,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
   const claimed=await admin.rpc('noor_claim_google_oauth_state',{p_hash:await sha(state)});
   const record=claimed.data?.[0];
   if(claimed.error||!record)return callbackPage(false);
   const member=await admin.from('institution_memberships').select('role').eq('institution_id',record.institution_id).eq('user_id',record.actor_id).eq('status','active').maybeSingle();
   if(member.error||!allowedRoles.includes(member.data?.role))return callbackPage(false);
   const token=await getToken({grant_type:'authorization_code',code,redirect_uri:CALLBACK,code_verifier:record.verifier},conf);
   if(!token.refresh_token)return callbackPage(false);
   const sealed=await encrypt(token.refresh_token,conf.key);
   const r=await admin.from('noor_google_oauth_credentials').upsert({
    institution_id:record.institution_id,...sealed,calendar_id:'primary',connected_by:record.actor_id,
    outbound_enabled:false,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()
   },{onConflict:'institution_id'});
   return callbackPage(!r.error);
  }catch{return callbackPage(false);}
 }
 if(req.method!=='POST')return send(405,{error:'POST required'});
 let body:any;
 try{const text=await req.text();if(text.length>1200)throw Error();body=JSON.parse(text);}catch{return send(400,{error:'Invalid request'});}
 const school=String(body.institution_id||''),action=String(body.action||'');
 if(!validUuid(school))return send(400,{error:'School ID required'});
 const jwt=req.headers.get('authorization');
 if(!jwt?.startsWith('Bearer '))return send(401,{error:'Sign in required'});
 if(!conf)return send(503,{error:'School Google OAuth requires administrator Google Cloud credentials. It is not yet configured.'});
 const admin=createClient(PROJECT,conf.service,{auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await admin.auth.getUser(jwt.slice(7));
 if(auth.error||!auth.data.user)return send(401,{error:'Session invalid'});
 const actor=auth.data.user.id;
 const member=await admin.from('institution_memberships').select('role').eq('institution_id',school).eq('user_id',actor).eq('status','active').maybeSingle();
 if(member.error||!member.data)return send(403,{error:'No access to this school'});
 const leader=allowedRoles.includes(member.data.role);
 if(['start','calendars','select','outbound','publish','deletePublished','disconnect'].includes(action)&&!leader)return send(403,{error:'Only school management may change Google connection'});
 const recordResponse=await admin.from('noor_google_oauth_credentials').select('*').eq('institution_id',school).maybeSingle();
 if(recordResponse.error)return send(503,{error:'Google Calendar settings unavailable'});
 const record=recordResponse.data;
 if(action==='status')return send(200,{configured:true,connected:!!record,calendar_id:record?.calendar_id||null,outbound_enabled:record?.outbound_enabled||false});
 if(action==='start'){
  const state=b64url(rnd(32)),verifier=b64url(rnd(64));
  const challenge=b64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const saved=await admin.from('noor_google_oauth_states').insert({
   state_hash:await sha(state),institution_id:school,actor_id:actor,verifier,expires_at:new Date(Date.now()+600000).toISOString()
  });
  if(saved.error)return send(503,{error:'Could not begin Google consent'});
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const params:Record<string,string>={client_id:conf.id,redirect_uri:CALLBACK,response_type:'code',
   scope:'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
   access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'};
  Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
  return send(200,{url:url.toString()});
 }
 if(action==='disconnect'){
  const deleted=await admin.from('noor_google_oauth_credentials').delete().eq('institution_id',school);
  if(deleted.error)return send(503,{error:'Disconnect failed'});
  await admin.from('noor_google_event_links').delete().eq('institution_id',school);
  return send(200,{connected:false});
 }
 if(!record)return send(200,{connected:false,events:[],calendars:[]});
 let access='';
 try{
  const refresh=await decrypt(record,conf.key);
  const tokens=await getToken({grant_type:'refresh_token',refresh_token:refresh},conf);
  access=tokens.access_token;
  if(!access)throw Error();
 }catch{return send(401,{error:'Google token expired. Reconnect school calendar.'});}
 if(action==='calendars'){
  const result=await google(access,'users/me/calendarList?minAccessRole=reader&maxResults=250');
  if(!result.ok)return send(502,{error:'Could not list Google calendars'});
  return send(200,{connected:true,calendar_id:record.calendar_id,calendars:(result.data?.items||[]).map((r:any)=>({
   id:String(r.id||''),summary:String(r.summary||'').slice(0,160),accessRole:r.accessRole,primary:!!r.primary
  }))});
 }
 if(action==='select'){
  const id=String(body.calendar_id||'');
  if(!id||id.length>400)return send(400,{error:'Invalid calendar'});
  const checked=await google(access,'users/me/calendarList/'+encodeURIComponent(id));
  if(!checked.ok)return send(403,{error:'Selected Google calendar is not accessible'});
  if(id!==record.calendar_id){
   const linked=await admin.from('noor_google_event_links').select('noor_event_id').eq('institution_id',school).limit(1);
   if(linked.error)return send(503,{error:'Calendar sync links could not be checked'});
   if(linked.data?.length)return send(409,{error:'Delete or migrate previously published school events before switching Google calendars.'});
  }
  const saved=await admin.from('noor_google_oauth_credentials').update({calendar_id:id,outbound_enabled:false,updated_at:new Date().toISOString()}).eq('institution_id',school);
  if(saved.error)return send(503,{error:'Calendar selection failed'});
  if(id!==record.calendar_id)await admin.from('noor_google_event_links').delete().eq('institution_id',school);
  return send(200,{connected:true,calendar_id:id});
 }
 if(action==='outbound'){
  const enabled=body.enabled===true;
  if(enabled){
   const r=await google(access,'users/me/calendarList/'+encodeURIComponent(record.calendar_id));
   if(!r.ok||!['owner','writer'].includes(r.data?.accessRole))return send(403,{error:'Select a writable school calendar first'});
  }
  const saved=await admin.from('noor_google_oauth_credentials').update({outbound_enabled:enabled,updated_at:new Date().toISOString()}).eq('institution_id',school);
  return saved.error?send(503,{error:'Could not update sync settings'}):send(200,{outbound_enabled:enabled});
 }
 if(action==='events'){
  const year=Number(body.year);
  if(!Number.isInteger(year)||year<2020||year>2040)return send(400,{error:'Invalid year'});
  const p='calendars/'+encodeURIComponent(record.calendar_id)+'/events?singleEvents=true&orderBy=startTime&maxResults=2500&timeMin='+encodeURIComponent(year+'-01-01T00:00:00Z')+'&timeMax='+encodeURIComponent(year+1+'-01-01T00:00:00Z');
  const events:any[]=[];let pageToken='',pages=0;
  do{
   const r=await google(access,p+(pageToken?'&pageToken='+encodeURIComponent(pageToken):''));
   if(!r.ok)return send(502,{error:'Google events unavailable'});
   for(const item of r.data?.items||[]){
    const date=String(item.start?.date||item.start?.dateTime||'').slice(0,10);
    if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&item.summary&&item.status!=='cancelled')events.push({date,title:String(item.summary).slice(0,180),source:'google'});
   }
   pageToken=String(r.data?.nextPageToken||'');pages++;
  }while(pageToken&&pages<5&&events.length<3000);
  return send(200,{connected:true,events:events.slice(0,3000)});
 }
 if(action==='publish'||action==='deletePublished'){
  if(action==='publish'&&!record.outbound_enabled)return send(200,{skipped:true});
  const eid=String(body.event_id||'');
  if(!validUuid(eid))return send(400,{error:'Invalid event'});
  const event=await admin.from('noor_calendar_events').select('id,title,academic_group_id,starts_at,ends_at').eq('institution_id',school).eq('id',eid).maybeSingle();
  if(event.error||!event.data)return send(404,{error:'School event not found'});
  if(event.data.academic_group_id!==null)return send(403,{error:'Class-specific events are not published to external calendars'});
  const path='calendars/'+encodeURIComponent(record.calendar_id)+'/events',gid='noor'+eid.replace(/-/g,'').toLowerCase();
  if(action==='deletePublished'){
   const link=await admin.from('noor_google_event_links').select('google_event_id').eq('institution_id',school).eq('noor_event_id',eid).maybeSingle();
   if(!link.data)return send(200,{deleted:false});
   const removed=await google(access,path+'/'+encodeURIComponent(link.data.google_event_id),'DELETE');
   if(!removed.ok&&removed.status!==404)return send(502,{error:'Google event deletion failed; NOOR event retained'});
   await admin.from('noor_google_event_links').delete().eq('institution_id',school).eq('noor_event_id',eid);
   return send(200,{deleted:true});
  }
  const start=new Date(event.data.starts_at),last=new Date(event.data.ends_at||event.data.starts_at);
  if(!Number.isFinite(start.getTime()))return send(400,{error:'Invalid event time'});
  const end=last>start?last:new Date(start.getTime()+3600000);
  const payload={id:gid,summary:String(event.data.title||'').slice(0,180),description:'NOOR School Calendar',
   start:{dateTime:start.toISOString()},end:{dateTime:end.toISOString()}};
  const sent=await google(access,path,'POST',payload);
  if(!sent.ok&&sent.status!==409)return send(502,{error:'Google could not save the event'});
  const linked=await admin.from('noor_google_event_links').upsert({institution_id:school,noor_event_id:eid,google_event_id:gid},{onConflict:'institution_id,noor_event_id'});
  if(linked.error)return send(503,{error:'Published but sync history save failed'});
  return send(200,{published:true});
 }
 return send(400,{error:'Unsupported Google action'});
}
if(import.meta.main)Deno.serve(handle);
