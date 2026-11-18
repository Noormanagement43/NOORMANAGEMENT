import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const originAllowed='https://noormanagement43.github.io';
const jsonHeaders:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
type CalEvent={date:string,title:string,source:'google'};
const normalizeDate=(raw:string)=>{const m=raw.match(/^(\d{4})(\d{2})(\d{2})/);if(!m)return null;const v=m[1]+'-'+m[2]+'-'+m[3];const dt=new Date(v+'T12:00:00Z');return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===v?v:null;};
const unescapeIcs=(s:string)=>s.replace(/\\n/gi,' ').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').trim();
export function publicEvents(ics:string,year:number):CalEvent[]{
 const lines=ics.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);
 const output:CalEvent[]=[],unique=new Set<string>();let item:Record<string,string>|null=null;
 function append(day:string|null,title:string){
  if(!day||!title||Number(day.slice(0,4))!==year)return;
  const key=day+'|'+title.toLowerCase();if(unique.has(key))return;unique.add(key);
  output.push({date:day,title:title.slice(0,180),source:'google'});
 }
 for(const line of lines){
  if(line==='BEGIN:VEVENT'){item={};continue;}
  if(line==='END:VEVENT'){
   if(item&&item.STATUS!=='CANCELLED'){
    const date=normalizeDate(item.DTSTART||''),title=unescapeIcs(item.SUMMARY||'');
    append(date,title);
    const rrule=item.RRULE||'';
    if(date&&Number(date.slice(0,4))!==year&&rrule.includes('FREQ=YEARLY')&&!/BYDAY=|BYSETPOS=|COUNT=|UNTIL=/.test(rrule)){
     const month=Number((rrule.match(/BYMONTH=(\d{1,2})/)||[])[1]||date.slice(5,7)),day=Number((rrule.match(/BYMONTHDAY=(\d{1,2})/)||[])[1]||date.slice(8,10));
     append(normalizeDate(String(year)+String(month).padStart(2,'0')+String(day).padStart(2,'0')),title);
    }
   }item=null;continue;
  }
  if(!item)continue;
  const at=line.indexOf(':');if(at<0)continue;
  const key=line.slice(0,at).split(';')[0].toUpperCase();
  if(['DTSTART','SUMMARY','RRULE','STATUS'].includes(key))item[key]=line.slice(at+1);
 }
 return output.slice(0,600);
}
export async function handle(req:Request){
 const origin=req.headers.get('origin'),headers={...jsonHeaders};
 if(origin&&origin!==originAllowed)return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers});
 if(origin)headers['Access-Control-Allow-Origin']=origin;
 const send=(status:number,data:unknown)=>new Response(status===204?null:JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return send(204,null);
 if(req.method!=='POST')return send(405,{error:'POST required'});
 let body:any;
 try{const raw=await req.text();if(raw.length>500)throw Error('Too large');body=JSON.parse(raw);}catch{return send(400,{error:'Invalid request'});}
 const id=String(body.institution_id||''),year=Number(body.year);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isInteger(year)||year<2020||year>2040)return send(400,{error:'Invalid school or year'});
 const token=req.headers.get('authorization');
 if(!token?.startsWith('Bearer '))return send(401,{error:'Sign in required'});
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!anon)return send(503,{error:'Calendar connection not configured'});
 const db=createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await db.auth.getUser(token.slice(7));
 if(auth.error||!auth.data.user)return send(401,{error:'Invalid session'});
 const [membership,source]=await Promise.all([
  db.from('institution_memberships').select('id').eq('institution_id',id).eq('user_id',auth.data.user.id).eq('status','active').limit(1),
  db.from('noor_calendar_google_sources').select('calendar_id').eq('institution_id',id).maybeSingle()
 ]);
 if(membership.error||!membership.data?.length)return send(403,{error:'This calendar is not accessible'});
 if(source.error)return send(503,{error:'Google Calendar settings could not be read'});
 const calendarId=source.data?.calendar_id;
 if(!calendarId)return send(200,{events:[],connected:false});
 if(!/^[A-Za-z0-9._@%#-]{4,180}$/.test(calendarId))return send(400,{error:'Invalid Google Calendar ID'});
 const endpoint='https://calendar.google.com/calendar/ical/'+encodeURIComponent(calendarId)+'/public/basic.ics';
 try{
  const response=await fetch(endpoint,{method:'GET',redirect:'error',signal:AbortSignal.timeout(7500),headers:{Accept:'text/calendar'}});
  if(!response.ok)return send(422,{error:'The Google calendar is not publicly readable. Check its sharing settings.'});
  if(Number(response.headers.get('content-length')||0)>1600000)return send(413,{error:'Google Calendar is too large'});
  const raw=await response.text();
  if(raw.length>1600000||!raw.includes('BEGIN:VCALENDAR'))return send(422,{error:'Google Calendar feed is not valid'});
  return send(200,{connected:true,events:publicEvents(raw,year)});
 }catch{return send(503,{error:'Google Calendar could not be refreshed. Existing school events remain available.'});}
}
if(import.meta.main)Deno.serve(handle);
