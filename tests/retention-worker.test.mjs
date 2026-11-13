import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(fs.readFileSync(new URL('../supabase/functions/noor-retention-worker/index.ts',import.meta.url),'utf8').replace(/^import .*\n/,'').replace('export async function handle','async function handle').replace('if(import.meta.main)Deno.serve(handle);',''));
const path='11111111-1111-1111-1111-111111111111/daily-homework-22222222-2222-2222-2222-222222222222.jpg';
function setup({valid=true,storageError=false,unsafe=false,ackError=false}={}){
 const calls=[];let claim=0;
 const db={rpc:async(name,args)=>{calls.push({name,args});if(name==='noor_validate_retention_worker')return{data:valid};if(name==='noor_retention_claim')return{data:claim++===0?[{id:'photo',bucket:'noor-learning-files',path:unsafe?'profile/avatar.jpg':path}]:[]};if(name==='noor_retention_ack')return{error:ackError?{message:'DB down'}:null};return{data:{tests_deleted:1}};},storage:{from(bucket){return{remove:async paths=>{calls.push({name:'remove',bucket,paths});return{error:storageError?{message:'Storage down'}:null};}};}}};
 const handle=vm.runInNewContext(source+';handle',{Request,Response,Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://ayrryemawwplguaauxij.supabase.co':'server-secret'}},createClient:()=>db});
 const req=(token='a'.repeat(64),method='POST')=>new Request('https://worker.example',{method,headers:{'x-noor-worker-token':token}});
 return{handle,req,calls};
}
test('retention worker requires a valid server-only credential before touching storage',async()=>{
 const x=setup();assert.equal((await x.handle(x.req('bad'))).status,401);assert.equal(x.calls.length,0);assert.equal((await x.handle(x.req('a'.repeat(64),'GET'))).status,405);
 const denied=setup({valid:false});assert.equal((await denied.handle(denied.req())).status,401);assert.deepEqual(denied.calls.map(c=>c.name),['noor_validate_retention_worker']);
});
test('retention removes actual Storage objects before acknowledging photo references',async()=>{
 const x=setup(),r=await x.handle(x.req());assert.equal(r.status,200);assert.equal((await r.json()).photos_removed,1);const remove=x.calls.findIndex(c=>c.name==='remove'),ack=x.calls.findIndex(c=>c.name==='noor_retention_ack');assert(remove<ack);assert.equal(x.calls[remove].bucket,'noor-learning-files');assert.equal(x.calls[remove].paths[0],path);assert.equal(x.calls[ack].args.p_success,true);
});
test('storage failure keeps the image reference for retry and never reports it deleted',async()=>{
 const x=setup({storageError:true}),r=await x.handle(x.req()),body=await r.json();assert.equal(body.photos_removed,0);assert.equal(body.photos_retried,1);assert.equal(x.calls.find(c=>c.name==='noor_retention_ack').args.p_success,false);assert.equal(x.calls.filter(c=>c.name==='noor_retention_claim').length,1);
});
test('worker rejects non-homework paths and reports acknowledgement failures',async()=>{
 const x=setup({unsafe:true});assert.equal((await x.handle(x.req())).status,503);assert(!x.calls.some(c=>c.name==='remove'));
 const y=setup({ackError:true});assert.equal((await y.handle(y.req())).status,503);
});
