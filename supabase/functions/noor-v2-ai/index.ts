/* NOOR v2 AI for the NEW institution_id / institution_memberships database.
 * Gemini keys must be configured in Supabase Edge Function Secrets, never public JavaScript.
 * Only authenticated, active institution members may generate school-scoped content.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json; charset=utf-8"};
const send=(code:number,data:unknown)=>new Response(JSON.stringify(data),{status:code,headers:cors});
const safe=(x:unknown,n=160)=>String(x??"").trim().slice(0,n);
const allowedPaperRoles=new Set(["principal","school_admin","university_admin","academic_admin","teacher","faculty"]);
const throttle=new Map<string,{count:number,until:number}>();
function limit(id:string){
 const now=Date.now(),entry=throttle.get(id);
 if(!entry||entry.until<now){throttle.set(id,{count:1,until:now+60000});return true}
 if(entry.count>=8)return false;
 entry.count++;return true;
}
async function askGemini(prompt:string,structured=false):Promise<string>{
 const api=Deno.env.get("GEMINI_API_KEY");
 if(!api)throw Error("Gemini is not configured yet. Add GEMINI_API_KEY to the new NOOR project's Edge Function Secrets.");
 const model=Deno.env.get("GEMINI_MODEL")||"gemini-3.5-flash-lite";
 const ctrl=new AbortController(),stop=setTimeout(()=>ctrl.abort(),25000);
 try{
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
   method:"POST",
   headers:{"Content-Type":"application/json","x-goog-api-key":api},
   body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:structured?.45:.6,maxOutputTokens:structured?4100:1100,...(structured?{responseMimeType:"application/json"}:{})}}),
   signal:ctrl.signal
  });
  if(!response.ok){console.error("Gemini request failed",response.status);throw Error(response.status===429?"AI is currently busy; retry soon.":"AI provider returned an error ("+response.status+").")}
  const data=await response.json();
  const responseText=(data?.candidates?.[0]?.content?.parts||[]).map((part:{text?:string})=>part.text||"").join("").trim();
  if(!responseText)throw Error("The AI response was empty.");
  return responseText;
 }finally{clearTimeout(stop)}
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return send(405,{error:"POST required."});
 const bearer=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
 if(!bearer)return send(401,{error:"Please sign in to NOOR first."});
 const url=Deno.env.get("SUPABASE_URL");
 let pub=Deno.env.get("SUPABASE_ANON_KEY")||"";
 if(!pub){try{pub=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||""}catch{}}
 if(!url||!pub)return send(503,{error:"School backend public configuration not available."});
 const db=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:"Bearer "+bearer}}});
 const verified=await db.auth.getUser(bearer);
 if(verified.error||!verified.data.user)return send(401,{error:"Your NOOR session has expired."});
 const uid=verified.data.user.id;
 let body:Record<string,unknown>={};
 try{body=await req.json()}catch{return send(400,{error:"Invalid JSON body."})}
 const action=safe(body.action||"chat_assist",35);
 if(action==="status")return send(200,{service:"noor-v2-ai",backend:"new-institution",configured:!!Deno.env.get("GEMINI_API_KEY")});
 const memberships=await db.from("institution_memberships").select("institution_id,role,status").eq("user_id",uid).eq("status","active").limit(20);
 if(memberships.error)return send(503,{error:"Institution permissions could not be checked."});
 const requested=safe(body.institution_id||body.school_id,60);
 const chosen=(memberships.data||[]).find((m:{institution_id:string})=>!requested||m.institution_id===requested);
 if(!chosen)return send(403,{error:"Your account does not have an active institution membership."});
 const inst=await db.from("institutions").select("id,name,status").eq("id",chosen.institution_id).maybeSingle();
 if(inst.error||inst.data?.status!=="active")return send(403,{error:"This institution is not active or could not be verified."});
 if(!limit(uid))return send(429,{error:"Too many AI requests. Try again shortly."});
 try{
  if(action==="chat_assist"){
   const message=safe(body.message,3000);
   if(!message)return send(400,{error:"Enter a question first."});
   const result=await askGemini("You are the NOOR school and university academic assistant. Institution: "+safe(inst.data.name,120)+". User's official role: "+chosen.role+". Answer clearly, kindly and accurately in the language of the user's question. Never invent attendance, marks, class details or data access. Never disclose identifiable student information.\nUser question:\n"+message);
   return send(200,{response:result});
  }
  if(action==="paper"){
   if(!allowedPaperRoles.has(chosen.role))return send(403,{error:"Only authorised teachers and academic leaders can draft assessment papers."});
   const topic=safe(body.topic||body.rough_text,1500);
   if(!topic)return send(400,{error:"Enter a topic or description for the paper."});
   const subject=safe(body.subject_name||"General",100),language=safe(body.language||"English",60),difficulty=safe(body.difficulty||"balanced",28);
   const count=Math.min(20,Math.max(1,Math.floor(Number(body.question_count)||10))),points=Math.min(20,Math.max(1,Math.floor(Number(body.marks_per_question)||2)));
   const result=await askGemini("Create an editable draft for a teacher to review before publication. School subject: "+subject+". Topic: "+topic+". Language: "+language+". Difficulty: "+difficulty+". Exactly "+count+" questions, "+points+" marks per question. Output valid JSON only: {\"title\":\"Assessment\",\"instructions\":\"Teacher review needed\",\"questions\":[{\"number\":1,\"text\":\"Question\",\"marks\":"+points+"}],\"answer_key\":[{\"number\":1,\"answer\":\"Teacher-reviewed answer\"}]} . Do not include personal data.",true);
   const parsed=JSON.parse(result.replace(/^\x60\x60\x60(?:json)?\s*|\x60\x60\x60$/g,"").trim());
   if(!Array.isArray(parsed.questions)||!parsed.questions.length)throw Error("Model returned no valid questions.");
   return send(200,{output:parsed});
  }
  if(action==="insights"){
   if(!allowedPaperRoles.has(chosen.role))return send(403,{error:"Insights are for authorised school staff."});
   const metrics=JSON.stringify(body.attendance_data||{}).slice(0,1800);
   const response=await askGemini("Interpret these aggregate attendance numbers cautiously, without pretending you accessed student records. Mention data gaps and give three supportive recommendations.\n"+metrics);
   return send(200,{response});
  }
  return send(400,{error:"Unknown AI action."});
 }catch(err){console.error("NOOR v2 AI",String(err));return send(503,{error:err instanceof Error?err.message:"AI generation failed."})}
});
