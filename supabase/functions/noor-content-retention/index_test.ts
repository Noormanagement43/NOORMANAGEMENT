import {handle} from './index.ts';
function assert(value:unknown,message='Assertion failed'):asserts value{if(!value)throw Error(message)}
const path='11111111-1111-4111-8111-111111111111/class-resource-22222222-2222-4222-8222-222222222222.jpg';
for(const scenario of ['dry-run','active','storage-error','new-reference','bad-path','lookup-error'])Deno.test('content retention '+scenario,async()=>{
 const oldFetch=globalThis.fetch,names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'],saved=names.map(x=>Deno.env.get(x));let deletes=0,finishes=0,lookups=0;const dry=scenario==='dry-run';
 try{Deno.env.set(names[0],'https://ayrryemawwplguaauxij.supabase.co');Deno.env.set(names[1],'test-only');
 globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{const url=new URL(String(input)),body=init?.body?JSON.parse(String(init.body)):{};
 if(url.pathname.endsWith('/rpc/noor_validate_worker_token'))return Response.json(true);
 if(url.pathname.endsWith('/rpc/noor_archive_expired_papers')){assert(body.p_dry_run===dry);return Response.json({papers:2});}
 if(url.pathname.endsWith('/rpc/noor_expired_note_photos')){lookups++;if(scenario==='lookup-error')return Response.json({message:'unavailable'},{status:500});return Response.json(scenario==='new-reference'&&lookups>1?[]:[{photo_path:scenario==='bad-path'?'../profile.jpg':path}]);}
 if(url.pathname.endsWith('/rpc/noor_claim_expired_note_photos'))return Response.json(scenario==='new-reference'?[]:[{photo_path:scenario==='bad-path'?'../profile.jpg':path}]);
 if(url.pathname.includes('/storage/v1/object/')){deletes++;assert(init?.method==='DELETE');assert(body.prefixes[0]===path);return scenario==='storage-error'?Response.json({message:'unavailable'},{status:503}):Response.json([{name:path}]);}
 if(url.pathname.endsWith('/rpc/noor_finish_note_photo_retention')){finishes++;assert(body.p_paths[0]===path);return Response.json(1);}
 throw Error('Unexpected request: '+url.pathname);
 };
 const res=await handle(new Request('https://example.invalid',{method:'POST',headers:{'x-noor-worker-token':'a'.repeat(64)},body:JSON.stringify({dry_run:dry})}));const result=await res.json();
 assert(res.status===(scenario==='lookup-error'?503:200));assert(deletes===(['active','storage-error'].includes(scenario)?1:0));assert(finishes===(scenario==='active'?1:0));if(scenario==='active')assert(result.photos_removed===1&&result.note_links_cleared===1);if(dry)assert(result.photos_removed===0);
 }finally{globalThis.fetch=oldFetch;names.forEach((n,i)=>saved[i]===undefined?Deno.env.delete(n):Deno.env.set(n,saved[i]!));}
});
Deno.test('retention rejects missing authorization before reading environment',async()=>{assert((await handle(new Request('https://example.invalid',{method:'POST',body:'{}'}))).status===401)});
