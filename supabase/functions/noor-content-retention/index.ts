/* Internal daily maintenance. Delete only expired note photos, archive paper content, preserve marks. */
import {createClient} from 'npm:@supabase/supabase-js@2.57.0';
const project='https://ayrryemawwplguaauxij.supabase.co';
export async function handle(req:Request):Promise<Response>{
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 const token=req.headers.get('x-noor-worker-token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return reply(401,{error:'Unauthorized'});
 if(Deno.env.get('SUPABASE_URL')!==project||!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))return reply(503,{error:'Maintenance unavailable'});
 const db=createClient(project,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const authorized=await db.rpc('noor_validate_worker_token',{p_token:token});
 if(authorized.error||authorized.data!==true)return reply(401,{error:'Unauthorized'});
 let dryRun=true;
 try{const body=await req.json();if(typeof body.dry_run!=='boolean')return reply(400,{error:'Choose dry_run explicitly'});dryRun=body.dry_run;}catch{return reply(400,{error:'Invalid request'});}
 const papers=await db.rpc('noor_archive_expired_papers',{p_limit:100,p_dry_run:dryRun});
 const photos=await db.rpc('noor_expired_note_photos',{p_limit:100});
 if(papers.error||photos.error)return reply(503,{error:'Maintenance queries unavailable'});
 let removed=0,failed=0,detached=0;
 if(!dryRun){
  const latest=await db.rpc('noor_claim_expired_note_photos',{p_limit:100});
  if(latest.error)return reply(503,{error:'Photo eligibility unavailable'});
  const current=new Set((latest.data||[]).map((x:{photo_path:string})=>x.photo_path));
  const paths:string[]=[];
  for(const row of photos.data||[]){const path=String(row.photo_path||'');if(/^[0-9a-f-]{36}\/class-resource-[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)&&current.has(path))paths.push(path);else failed++;}
  if(paths.length){
   const deletion=await db.storage.from('noor-learning-files').remove(paths);
   if(deletion.error)failed+=paths.length;
   else {const updated=await db.rpc('noor_finish_note_photo_retention',{p_paths:paths});if(updated.error)failed+=paths.length;else{removed=paths.length;detached=Number(updated.data||0);}}
  }
 }
 return reply(200,{dry_run:dryRun,papers:papers.data?.papers||0,eligible_photos:photos.data?.length||0,photos_removed:removed,note_links_cleared:detached,failures:failed});
}
if(import.meta.main)Deno.serve(handle);
