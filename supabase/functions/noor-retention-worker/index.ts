import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const PROJECT='https://ayrryemawwplguaauxij.supabase.co';
type FileJob={id:string;bucket:string;path:string};
export async function handle(req:Request):Promise<Response>{
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 const token=req.headers.get('x-noor-worker-token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return reply(401,{error:'Unauthorized'});
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(Deno.env.get('SUPABASE_URL')!==PROJECT||!key)return reply(503,{error:'Worker unavailable'});
 const db=createClient(PROJECT,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const valid=await db.rpc('noor_validate_retention_worker',{p_token:token});if(valid.error||valid.data!==true)return reply(401,{error:'Unauthorized'});
 let removed=0,failed=0;const summaries=[];
 for(let batch=0;batch<3;batch++){
  const sweep=await db.rpc('noor_retention_prepare');if(sweep.error)return reply(503,{error:'Retention preparation failed'});summaries.push(sweep.data);
  const claimed=await db.rpc('noor_retention_claim');if(claimed.error)return reply(503,{error:'Retention claim failed'});
  const files=(claimed.data||[]) as FileJob[];if(!files.length)break;
  // SQL claims permit only the dedicated daily-work photo prefix, never profile or school-logo buckets.
  if(files.some(f=>f.bucket!=='noor-learning-files'||! /^[0-9a-f-]{36}\/daily-homework-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(f.path)))return reply(503,{error:'Invalid retention batch'});
  const deleted=await db.storage.from('noor-learning-files').remove(files.map(f=>f.path));
  const ack=await db.rpc('noor_retention_ack',{p_ids:files.map(f=>f.id),p_success:!deleted.error});if(ack.error)return reply(503,{error:'Retention acknowledgement failed'});
  if(deleted.error){failed+=files.length;break;}removed+=files.length;
 }
 return reply(200,{photos_removed:removed,photos_retried:failed,sweeps:summaries});
}
if(import.meta.main)Deno.serve(handle);
