import { generate, probe, primary, ProviderError } from './providers.ts';
import { handle } from './index.ts';
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m)}
const names=['GEMINI_API_KEY','GEMINI_MODEL','OPENAI_API_KEY','OPENAI_MANAGER_MODEL','GROQ_API_KEY','NOOR_AI_PROVIDER','SUPABASE_URL','SUPABASE_ANON_KEY'];
async function isolated(run:()=>Promise<void>){const env=names.map(n=>Deno.env.get(n));const old=globalThis.fetch;try{names.forEach(n=>Deno.env.delete(n));await run()}finally{globalThis.fetch=old;names.forEach((n,i)=>env[i]===undefined?Deno.env.delete(n):Deno.env.set(n,env[i]!))}}
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
Deno.test('provider routing is explicit, metadata probe sends no prompt, keys never enter URL',()=>isolated(async()=>{
 Deno.env.set('GEMINI_API_KEY','test-secret-value');
 assert(primary()==='gemini');let calls=0;
 globalThis.fetch=async(input,init)=>{calls++;const url=String(input);assert(url.startsWith('https://generativelanguage.googleapis.com/'));assert(!url.includes('test-secret-value'));assert(new Headers(init?.headers).get('x-goog-api-key')==='test-secret-value');assert(!init?.body);return response({name:'models/test'})};
 const p=await probe('gemini');assert(p.verified===true&&p.generation_tested===false&&calls===1);
 Deno.env.set('NOOR_AI_PROVIDER','untrusted-url');let denied=false;try{primary()}catch{denied=true}assert(denied);
}));
Deno.test('Gemini and OpenAI adapters parse official output shapes without fallback or raw error leaks',()=>isolated(async()=>{
 Deno.env.set('GEMINI_API_KEY','test-gemini');Deno.env.set('OPENAI_API_KEY','test-openai');Deno.env.set('OPENAI_MANAGER_MODEL','account-selected-model');let calls=0;
 globalThis.fetch=async(input,init)=>{calls++;const url=String(input),body=JSON.parse(String(init?.body));
  if(url.includes('googleapis.com'))return response({candidates:[{content:{parts:[{thought:true,text:'private reasoning'},{text:'Academic answer'}]}}]});
  assert(url==='https://api.openai.com/v1/responses'&&body.store===false&&body.model==='account-selected-model');
  return response({output:[{type:'reasoning',content:[]},{type:'message',content:[{type:'output_text',text:'Proposed plan'}]}]});
 };
 assert(await generate('gemini','lesson')==='Academic answer');assert(await generate('openai','plan')==='Proposed plan');assert(calls===2);
 globalThis.fetch=async()=>response({error:'secret/raw upstream body'},429);
 try{await generate('gemini','lesson');throw Error('Expected rate denial')}catch(e){assert(e instanceof ProviderError&&e.code==='PROVIDER_RATE_LIMIT'&&!e.message.includes('raw upstream'))}
}));
Deno.test('HTTP AI route denies other tenants, student managers and exhausted budgets before provider call',()=>isolated(async()=>{
 Deno.env.set('SUPABASE_URL','https://ayrryemawwplguaauxij.supabase.co');Deno.env.set('SUPABASE_ANON_KEY','public-test');Deno.env.set('GEMINI_API_KEY','test-only');
 let role='principal',member=true,budget=true,providerCalls=0;
 const institution='42000000-0000-4000-8000-000000000001';
 globalThis.fetch=async(input)=>{const url=String(input);
  if(url.includes('/auth/v1/user'))return response({id:'41000000-0000-4000-8000-000000000001',email:'test@example.invalid',aud:'authenticated',role:'authenticated'});
  if(url.includes('/institution_memberships?')){assert(url.includes('institution_id=eq.'+institution)&&url.includes('status=eq.active'));return response(member?[{role,status:'active'}]:[])}
  if(url.includes('/institutions?'))return response([{name:'Test School',status:'active'}]);
  if(url.includes('/rpc/noor_take_ai_budget'))return response(budget);
  if(url.includes('googleapis.com')){providerCalls++;return response({candidates:[{content:{parts:[{text:'Verified mock response'}]}}]})}
  throw Error('Unexpected outbound call '+url);
 };
 const request=(action:string)=>new Request('https://example.invalid/noor-v2-ai',{method:'POST',headers:{authorization:'Bearer test.user.token','content-type':'application/json'},body:JSON.stringify({action,institution_id:institution,message:'Plan a lesson'})});
 member=false;assert((await handle(request('chat_assist'))).status===403);
 member=true;role='student';assert((await handle(request('manager_plan'))).status===403);
 role='teacher';budget=false;assert((await handle(request('chat_assist'))).status===429&&providerCalls===0);
 budget=true;const answer=await handle(request('chat_assist'));assert(answer.status===200&&(await answer.json()).response==='Verified mock response'&&Number(providerCalls)===1);
}));
Deno.test('missing keys and unsupported image adapters fail before network access',()=>isolated(async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Network forbidden')};
 try{await generate('gemini','test');throw Error('Expected missing-key error')}catch(e){assert(e instanceof ProviderError&&e.code==='MISSING_KEY')}
 Deno.env.set('GROQ_API_KEY','test-only');
 try{await generate('groq','image',false,['data:image/png;base64,AAAA']);throw Error('Expected unsupported image error')}catch(e){assert(e instanceof ProviderError&&e.code==='IMAGE_PROVIDER_UNSUPPORTED')}
 assert(calls===0);
}));
