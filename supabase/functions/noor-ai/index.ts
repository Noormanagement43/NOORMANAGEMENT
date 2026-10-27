/* NOOR shared AI endpoint: JWT verified, school-scoped, API key held in Edge Function secrets.
 * GEMINI_API_KEY and optional GEMINI_MODEL are never sent to browsers.
 * Deploy only to the verified canonical school Supabase project. */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const respond = (code: number, data: unknown) => new Response(JSON.stringify(data), {status:code,headers});
const clamp = (value:unknown, size=200) => String(value??"").trim().slice(0,size);
const getModel = () => Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";

async function askGemini(prompt: string, json=false, images: Array<{inline_data:{mime_type:string;data:string}}> = []):Promise<string>{
 const key=Deno.env.get("GEMINI_API_KEY");
 if(!key)throw new Error("AI is not yet configured. Add GEMINI_API_KEY to Supabase Edge Function secrets.");
 const model=getModel();
 const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent";
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch(url,{
   method:"POST",
   headers:{"Content-Type":"application/json","x-goog-api-key":key},
   body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt},...images]}],generationConfig:{
    temperature:json?0.4:0.55,maxOutputTokens:json?5500:1300,...(json?{responseMimeType:"application/json"}:{})
   }}),
   signal:controller.signal
  });
  if(!response.ok){console.error("NOOR AI upstream status",response.status);throw new Error(response.status===429?"AI capacity limit reached. Try again later.":"AI provider unavailable ("+response.status+").");}
  const payload=await response.json();
  const answer=(payload?.candidates?.[0]?.content?.parts||[]).map((p:{text?:string})=>p.text||"").join("").trim();
  if(!answer)throw new Error("The AI service returned no answer.");
  return answer;
 }finally{clearTimeout(timeout)}
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return respond(405,{error:"POST required."});
 const authorization=req.headers.get("Authorization")||"";
 const token=authorization.replace(/^Bearer\s+/i,"");
 if(!token)return respond(401,{error:"Sign in to your school account to use AI."});
 const url=Deno.env.get("SUPABASE_URL"),pub=Deno.env.get("SUPABASE_ANON_KEY")||
  (():string=>{try{return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||""}catch{return ""}})();
 if(!url||!pub)return respond(503,{error:"NOOR backend configuration is incomplete."});
 const authClient=createClient(url,pub,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
 const auth=await authClient.auth.getUser(token);
 if(auth.error||!auth.data.user)return respond(401,{error:"School login expired. Please sign in again."});
 const identity=auth.data.user.id;
 const profile=await authClient.from("profiles").select("id,school_id,role,status").eq("id",identity).maybeSingle();
 if(profile.error||!profile.data||profile.data.status!=="active"||!profile.data.school_id||!["owner","principal","manager","teacher","student"].includes(profile.data.role)){
  return respond(403,{error:"An active school profile is required for NOOR AI."});
 }
 let body:Record<string,unknown>={};
 try{if(Number(req.headers.get("content-length")||0)>7000000)return respond(413,{error:"Request too large."});body=await req.json()}catch{return respond(400,{error:"Invalid request."})}
 const action=clamp(body.action||"chat_assist",32);
 if(body.school_id&&body.school_id!==profile.data.school_id)return respond(403,{error:"Different school requested."});
 if(action==="status")return respond(200,{status:Deno.env.get("GEMINI_API_KEY")?"configured":"missing_server_key",server_only:true});
 if(!Deno.env.get("GEMINI_API_KEY"))return respond(503,{error:"NOOR AI is not configured yet. The school administrator must add GEMINI_API_KEY as a Supabase Edge Function secret."});
 try{
  if(action==="chat_assist"){
   const msg=clamp(body.message,3000);
   if(!msg)return respond(400,{error:"Enter a question first."});
   const role=profile.data.role;
   const response=await askGemini("You are NOOR, an assistant for a school. Role: "+role+". Give helpful, concise, educational, practical and safe answers. Never claim to have accessed school records unless provided in the prompt. Do not disclose private pupil data. User question:\n"+msg);
   return respond(200,{response});
  }
  if(action==="paper"){
   if(profile.data.role!=="teacher"&&profile.data.role!=="principal"&&profile.data.role!=="owner")return respond(403,{error:"Only teaching staff and school leaders may draft papers."});
   const subject=clamp(body.subject_name||"General",80),topic=clamp(body.topic||body.rough_text,1800);
   const q=Math.min(25,Math.max(1,Math.floor(Number(body.question_count)||10)));
   const marks=Math.min(20,Math.max(1,Math.floor(Number(body.marks_per_question)||2)));
   if(!topic)return respond(400,{error:"Add a topic or short description."});
   const imageParts:Array<{inline_data:{mime_type:string;data:string}}>=[];
   if(Array.isArray(body.images)){
    if(body.images.length>3)return respond(413,{error:"Use at most three compressed lesson images."});
    for(const item of body.images){
     if(typeof item!=="string")return respond(400,{error:"Invalid image."});
     const match=item.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
     if(!match||match[2].length>1500000)return respond(413,{error:"Use JPG/PNG/WebP images under 1 MB each."});
     imageParts.push({inline_data:{mime_type:match[1],data:match[2]}});
    }
   }
   const prompt="Generate a teacher-editable assessment draft. Subject: "+subject+"; Topic: "+topic+
    "; Class: "+clamp(body.class_name||"school",60)+"; Paper type: "+clamp(body.paper_type,40)+
    "; Language: "+clamp(body.language||"English",60)+"; Difficulty: "+clamp(body.difficulty||"balanced",24)+
    "; Question count: "+q+"; Marks per question: "+marks+
    ". Return ONLY valid JSON: {\"title\":\"Draft title\",\"instructions\":\"Teacher review required\",\"questions\":[{\"number\":1,\"text\":\"Question\",\"marks\":"+marks+"}],\"answer_key\":[{\"number\":1,\"answer\":\"Answer\"}]}. Never include student personal data.";
   const response=await askGemini(prompt,true,imageParts);
   const draft=JSON.parse(response.replace(/^\x60\x60\x60(?:json)?\s*|\x60\x60\x60$/g,"").trim());
   if(!Array.isArray(draft.questions)||!draft.questions.length)throw new Error("Provider did not return valid assessment questions.");
   return respond(200,{output:draft});
  }
  if(action==="insights"){
   if(!["owner","principal","manager","teacher"].includes(profile.data.role))return respond(403,{error:"Not permitted."});
   const metrics=JSON.stringify(body.attendance_data||{}).slice(0,1800);
   const response=await askGemini("Summarise these aggregate school attendance figures cautiously, without invented facts or student identifiers. Data: "+metrics+"\nGive 3 short suggestions.");
   return respond(200,{response});
  }
  if(action==="cartoon_media"||action==="media_prompt"){
   const topic=clamp(body.topic,180),style=clamp(body.style,120),grade=clamp(body.grade_level,55);
   if(!topic)return respond(400,{error:"Choose a topic."});
   const response=await askGemini("Create a short child-friendly educational storyboard prompt. Topic: "+topic+", grade: "+grade+", art style: "+style+". Return JSON with topic, visual_concept, art_style, prompt_text, educational_takeaway.",true);
   return respond(200,{output:JSON.parse(response)});
  }
  return respond(400,{error:"Unknown AI action."});
 }catch(error){
  console.error("NOOR AI error",String(error));
  return respond(503,{error:error instanceof Error?error.message:"AI generation failed."});
 }
});
