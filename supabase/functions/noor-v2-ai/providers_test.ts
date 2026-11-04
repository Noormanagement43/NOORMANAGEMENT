import { generate, probe, primary, config, probeBrevo, probeAll, ProviderError } from './providers.ts';
import { handle } from './index.ts';
function assert(v:unknown,m='Assertion failed'):asserts v{if(!v)throw Error(m)}
const names=['GEMINI_API_KEY','GEMINI_MODEL','OPENAI_API_KEY','OPENAI_MANAGER_MODEL','GROQ_API_KEY','GROQ_MODEL','NOOR_AI_PROVIDER','SUPABASE_URL','SUPABASE_ANON_KEY','groq','gemini','chatgpt','brevo','BREVO_API_KEY','EMAIL_FROM'];
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

Deno.test('saved lowercase secrets are accepted; conflicting copies fail closed without exposing values',()=>isolated(async()=>{
 Deno.env.set('groq','alias-groq');Deno.env.set('gemini','alias-gemini');Deno.env.set('chatgpt','alias-openai');
 assert(config('groq').secretName==='groq'&&config('gemini').secretName==='gemini'&&config('openai').secretName==='chatgpt');
 Deno.env.set('GEMINI_API_KEY','different-value');
 try{config('gemini');throw Error('Expected conflict')}catch(e){assert(e instanceof ProviderError&&e.code==='AMBIGUOUS_SECRET'&&!e.message.includes('different-value')&&!e.message.includes('alias-gemini'))}
 Deno.env.set('GEMINI_API_KEY','alias-gemini');assert(config('gemini').secretName==='GEMINI_API_KEY');
}));
Deno.test('Brevo diagnostics verify metadata only and never return account information or send email',()=>isolated(async()=>{
 Deno.env.set('brevo','fake-brevo-secret');let calls=0;
 globalThis.fetch=async(input,init)=>{calls++;assert(String(input)==='https://api.brevo.com/v3/account');assert(new Headers(init?.headers).get('api-key')==='fake-brevo-secret');assert(!init?.method||init.method==='GET');assert(!init?.body);return response({email:'account-private@example.invalid',plan:[{credits:99}]})};
 const result=await probeBrevo();const text=JSON.stringify(result);
 assert(result.secret_name==='brevo'&&result.authentication_successful===true&&result.email_delivery_tested===false&&calls===1);
 assert(!text.includes('account-private')&&!text.includes('fake-brevo-secret')&&!text.includes('credits'));
}));
Deno.test('each provider probe reports independently and never treats missing credentials as success',()=>isolated(async()=>{
 Deno.env.set('groq','fake-groq');let calls=0;
 globalThis.fetch=async(input)=>{calls++;assert(String(input).startsWith('https://api.groq.com/'));return response({error:'raw private error'},401)};
 const result=await probeAll() as Record<string,{secret_detected:boolean;authentication_successful:boolean|null;code:string}>;
 assert(result.groq.secret_detected===true&&result.groq.authentication_successful===false);
 assert(result.gemini.code==='MISSING_KEY'&&result.openai.code==='MISSING_KEY'&&result.brevo.code==='MISSING_KEY'&&calls===1);
}));

Deno.test('Groq metadata uses its model catalogue and distinguishes model absence from invalid authentication',()=>isolated(async()=>{
 Deno.env.set('groq','test-groq-key');
 globalThis.fetch=async(input,init)=>{assert(String(input)==='https://api.groq.com/openai/v1/models');assert(new Headers(init?.headers).get('Authorization')==='Bearer test-groq-key');return response({data:[{id:'openai/gpt-oss-120b'}]})};
 const available=await probe('groq');assert(available.authentication_successful===true&&available.verified===true&&available.code==='MODEL_ACCESS_VERIFIED');
 globalThis.fetch=async()=>response({data:[{id:'another-model'}]});
 const absent=await probe('groq');assert(absent.authentication_successful===true&&absent.verified===false&&absent.code==='MODEL_UNAVAILABLE');
}));
