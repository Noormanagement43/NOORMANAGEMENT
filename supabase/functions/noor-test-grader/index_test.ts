import {handle} from './index.ts';
function assert(value:unknown,message='Assertion failed'):asserts value{if(!value)throw Error(message);}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const names=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','GEMINI_API_KEY','gemini'];
async function isolated(run:()=>Promise<void>){const before=names.map(n=>Deno.env.get(n)),fetch=globalThis.fetch;try{names.forEach(n=>Deno.env.delete(n));Deno.env.set('SUPABASE_URL','https://ayrryemawwplguaauxij.supabase.co');Deno.env.set('SUPABASE_ANON_KEY','test-public');Deno.env.set('SUPABASE_SERVICE_ROLE_KEY','test-service');Deno.env.set('GEMINI_API_KEY','test-only');await run();}finally{globalThis.fetch=fetch;names.forEach((n,i)=>before[i]===undefined?Deno.env.delete(n):Deno.env.set(n,before[i]!));}}
const request=()=>new Request('https://example.invalid',{method:'POST',headers:{authorization:'Bearer test.user.token','content-type':'application/json'},body:JSON.stringify({attempt_id:'43000000-0000-4000-8000-000000000001'})});
Deno.test('Automatic checker authenticates student, reads only claimed private context and commits bounded marks once',()=>isolated(async()=>{
 let finishes=0;globalThis.fetch=async(input,init)=>{const url=String(input),body=JSON.parse(String(init?.body||'{}'));
  if(url.includes('/auth/v1/user'))return json({id:'student-user'});
  if(url.includes('/rpc/noor_claim_test_job')){assert(body.p_actor==='student-user');return json({attempt_id:'attempt',subject:'English',questions:[{type:'mcq',marks:1},{type:'short',response_mode:'one_word',prompt:'Opposite of hot?',marks:3}],answers:['0','cold'],answer_key:[{answer:'0'},{answer:'cold'}]});}
  if(url.includes('googleapis.com')){assert(body.generationConfig.responseJsonSchema.properties.scores.required[0]==='2');return json({candidates:[{content:{parts:[{text:'{"scores":{"2":{"marks":3,"reason":"Correct opposite. Well done!"}}}'}]}}]});}
  if(url.includes('/rpc/noor_finish_auto_test')){finishes++;assert(body.p_attempt==='attempt'&&body.p_scores[1].marks===3);return json('result');}
  throw Error('Unexpected outbound call '+url);
 };const response=await handle(request()),data=await response.json();assert(response.status===200&&finishes===1&&data.results[0].status==='completed');assert(!JSON.stringify(data).includes('answer_key')&&!JSON.stringify(data).includes('cold'));
}));
Deno.test('Invalid automatic scores are queued for retry and never saved as final marks',()=>isolated(async()=>{
 let retries=0;globalThis.fetch=async(input)=>{const url=String(input);
  if(url.includes('/auth/v1/user'))return json({id:'student-user'});
  if(url.includes('/rpc/noor_claim_test_job'))return json({attempt_id:'attempt',subject:'English',questions:[{type:'short',marks:2}],answers:['wrong'],answer_key:[{answer:'correct'}]});
  if(url.includes('googleapis.com'))return json({candidates:[{content:{parts:[{text:'{"scores":{"1":{"marks":9,"reason":"Invalid"}}}'}]}}]});
  if(url.includes('/rpc/noor_retry_test_job')){retries++;return json(null);}
  if(url.includes('/rpc/noor_finish_auto_test'))throw Error('Invalid result was finalized');
  throw Error('Unexpected outbound call');
 };const r=await handle(request()),data=await r.json();assert(r.status===200&&retries===1&&data.results[0].status==='queued');
}));
Deno.test('Missing sessions and invalid worker credentials cannot start checking',()=>isolated(async()=>{
 let claims=0;globalThis.fetch=async input=>{const url=String(input);if(url.includes('/rpc/noor_claim_test_job'))claims++;if(url.includes('/rpc/noor_validate_worker_token'))return json(false);return json({});};
 assert((await handle(new Request('https://example.invalid',{method:'POST'}))).status===401);
 assert((await handle(new Request('https://example.invalid',{method:'POST',headers:{'x-noor-worker-token':'a'.repeat(64)}}))).status===401);assert(claims===0);
}));
