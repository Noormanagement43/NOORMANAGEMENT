/* NOOR AI — personal appearance preferences, synced to the signed-in account. */
(() => {
  "use strict";
  const THEMES = [
    {id:"simple-clean",name:"Simple & Clean",desc:"Plain white, soft teal, clear lines and minimal decoration.",primary:"#247b7b",accent:"#d9efed",canvas:"#f4f7f8",card:"#ffffff",ink:"#243b43"},
    {id:"rose-gold",name:"Original Burgundy",desc:"Deep burgundy, ivory cards and warm champagne accents.",primary:"#6B0F1A",accent:"#D6B174",canvas:"#FBF3EE",card:"#fffdfb",ink:"#34232a"},
    {id:"pastel-aurora",name:"Soft Rose",desc:"Clean white with a restrained dusty rose accent.",primary:"#88556a",accent:"#f2e4ea",canvas:"#faf7f8",card:"#ffffff",ink:"#352e37"},
    {id:"linen-pearl",name:"Warm Ivory",desc:"Warm white, sandstone details and quiet charcoal text.",primary:"#77634c",accent:"#eee6db",canvas:"#f8f7f3",card:"#ffffff",ink:"#35322e"},
    {id:"porcelain-blue",name:"Porcelain Blue",desc:"White cards, ink blue actions and soft blue highlights.",primary:"#3d638c",accent:"#e3edf7",canvas:"#f5f8fb",card:"#ffffff",ink:"#253647"},
    {id:"rose-whisper",name:"Muted Lavender",desc:"Near-white surfaces with a subtle lavender accent.",primary:"#6d6085",accent:"#eae6f1",canvas:"#f8f7fa",card:"#ffffff",ink:"#342f40"},
    {id:"ocean-blue",name:"Slate & White",desc:"Crisp white and slate with clear blue-grey controls.",primary:"#4c6578",accent:"#e4ebf0",canvas:"#f5f7f9",card:"#ffffff",ink:"#263744"},
    {id:"sage-garden",name:"Soft Sage",desc:"White cards with a calm sage green accent.",primary:"#48715d",accent:"#e4eee7",canvas:"#f6f8f5",card:"#ffffff",ink:"#2c3c32"}
  ];

 const DEFAULT={theme_key:"pastel-aurora",color_mode:"light",font_scale:"normal",reduced_motion:false};
 let prefs={...DEFAULT},mounted=null,activeSchool=null,loadToken=0,revision=0,realtime=null,queue=Promise.resolve(),saveTimer=null;
 const app=()=>window.NOOR_AI_APP||{};
 const school=()=>app().schoolId||app().school?.id||null;
 const principal=()=>app().profile?.role==="principal";
 const $=(root,selector)=>root?.querySelector(selector);
 const E=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const clean=value=>{const v=value||{};return{
  theme_key:THEMES.some(t=>t.id===v.theme_key)?v.theme_key:DEFAULT.theme_key,
  color_mode:v.color_mode==="dark"?"dark":"light",
  font_scale:["small","normal","large"].includes(v.font_scale)?v.font_scale:"normal",
  reduced_motion:v.reduced_motion===true
 };};
 const status=message=>{const el=mounted&&$(mounted,"[data-theme-status]");if(el)el.textContent=message;};
 function refreshChoice(){
  if(!mounted)return;
  mounted.querySelectorAll("[data-theme-choice]").forEach(b=>{const selected=b.dataset.themeChoice===prefs.theme_key;b.setAttribute("aria-pressed",String(selected));const label=b.querySelector(".noor-theme-selected");if(label)label.textContent=selected?"✓ School theme":"Choose for this school";});
  const mode=$(mounted,"#noorColorMode");if(mode)mode.value=prefs.color_mode;
  const font=$(mounted,"#noorFontScale");if(font&&document.activeElement!==font)font.value=prefs.font_scale;
  const motion=$(mounted,"#noorReducedMotion");if(motion)motion.checked=prefs.reduced_motion;
 }
 function apply(){
  const p=clean(prefs);
  document.documentElement.dataset.noorTheme=p.theme_key;
  document.documentElement.dataset.noorMode=p.color_mode;
  document.documentElement.dataset.noorFont=p.font_scale;
  document.documentElement.classList.toggle("noor-reduced-motion",p.reduced_motion);
  document.querySelectorAll("#noor-principal.pd-dark").forEach(el=>el.classList.remove("pd-dark"));
  refreshChoice();
  window.dispatchEvent(new CustomEvent("noor:theme-changed",{detail:{...p,institution_id:activeSchool}}));
 }
 function reset(){
  loadToken++;activeSchool=null;prefs={...DEFAULT};if(realtime){try{app().db?.removeChannel(realtime);}catch{}realtime=null;}apply();
 }
 async function loadForCurrentUser(){
  const id=school(),user=app().user?.id,db=app().db;
  if(!id||!user||!db){reset();return;}
  const token=++loadToken;
  if(activeSchool!==id){activeSchool=id;prefs={...DEFAULT};apply();}
  const valid=()=>token===loadToken&&school()===id&&app().user?.id===user;
  try{
   const auth=await db.auth.getUser();if(auth.error||auth.data?.user?.id!==user||!valid())return;
   const r=await db.from("noor_school_appearance").select("theme_key,color_mode,font_scale,reduced_motion").eq("institution_id",id).maybeSingle();
   if(r.error)throw r.error;if(!valid())return;
   prefs=clean(r.data);apply();
   status(principal()?"Theme saved separately for this school.":"Your principal controls this school theme.");
   if(realtime){try{db.removeChannel(realtime);}catch{}realtime=null;}
   if(typeof db.channel==="function")realtime=db.channel("school-appearance-"+id).on("postgres_changes",{event:"*",schema:"public",table:"noor_school_appearance",filter:"institution_id=eq."+id},()=>{if(school()===id&&app().user?.id===user)loadForCurrentUser();}).subscribe();
  }catch{if(valid()){prefs={...DEFAULT};apply();status("School theme not available. Other schools' settings were not loaded.");}}
 }
 function persist(){
  const id=school(),user=app().user?.id,db=app().db,value=clean(prefs),version=revision;
  if(!principal()||!id||id!==activeSchool||!user||!db){status("Only your school principal can change the theme.");return Promise.resolve();}
  queue=queue.catch(()=>{}).then(async()=>{
   if(school()!==id||app().user?.id!==user||!principal())return;
   const auth=await db.auth.getUser();if(auth.error||auth.data?.user?.id!==user)throw Error("Sign in again to save.");
   const r=await db.from("noor_school_appearance").upsert({institution_id:id,...value,updated_at:new Date().toISOString()},{onConflict:"institution_id"}).select("institution_id").single();
   if(r.error)throw r.error;if(r.data?.institution_id!==id)throw Error("School ID mismatch.");
   if(version===revision&&school()===id)status("Theme saved for this school only.");
  }).catch(e=>{if(school()===id)status("Theme not saved: "+e.message);});
  return queue;
 }
 function choose(){if(!principal()||school()!==activeSchool){status("Principal access required.");return;}revision++;apply();status("Saving school theme…");const id=school(),user=app().user?.id;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(school()===id&&app().user?.id===user)persist();},220);}
 function setMode(mode){if(!principal())return;prefs.color_mode=mode==="dark"?"dark":"light";choose();}
 function mount(container){
  if(!container)return;mounted=container;
  if(!principal()||!school()){
   container.innerHTML='<section class="noor-theme-panel"><div class="noor-theme-head"><div class="eyebrow">School workspace</div><h2>School Appearance</h2><p>Your principal chooses this school\'s theme. Other schools keep their own theme.</p><div data-theme-status role="status"></div></div></section>';
   status("Read-only school appearance.");return;
  }
  container.innerHTML='<section class="noor-theme-panel"><div class="noor-theme-head"><div><div class="eyebrow">Principal controls · this school only</div><h2>School Appearance</h2><p>Theme applies to this school\'s principal, teachers and students. Other schools and the public sign-in page are unaffected.</p></div><div data-theme-status role="status"></div></div><div class="noor-theme-grid">'+
   THEMES.map(t=>'<button type="button" class="noor-theme-card" data-theme-choice="'+t.id+'" aria-pressed="false"><span class="noor-theme-preview" style="--preview-primary:'+t.primary+';--preview-accent:'+t.accent+';--preview-canvas:'+t.canvas+';--preview-card:'+t.card+';--preview-ink:'+t.ink+'"><span class="noor-theme-mini-nav"></span><span class="noor-theme-mini-content"><span class="noor-theme-mini-title"></span><span class="noor-theme-mini-cards"><span></span><span></span></span></span></span><span class="noor-theme-name">'+E(t.name)+'</span><span class="noor-theme-desc">'+E(t.desc)+'</span><span class="noor-theme-selected">Choose for this school</span></button>').join('')+
   '</div><div class="noor-theme-options"><div class="noor-theme-field"><label for="noorFontScale">School text size</label><select id="noorFontScale"><option value="small">Compact</option><option value="normal">Standard</option><option value="large">Large</option></select></div><div class="noor-theme-field"><label for="noorColorMode">School display</label><select id="noorColorMode"><option value="light">Light</option><option value="dark">Dark</option></select></div><div class="noor-theme-field"><label>Motion</label><label class="noor-theme-check"><input type="checkbox" id="noorReducedMotion">Reduce animations</label></div></div><div class="noor-theme-actions"><button type="button" id="noorResetAppearance" class="noor-theme-reset">Reset school theme</button></div></section>';
  container.querySelectorAll("[data-theme-choice]").forEach(b=>b.addEventListener("click",()=>{prefs.theme_key=b.dataset.themeChoice;choose();}));
  $(container,"#noorColorMode").addEventListener("change",e=>setMode(e.target.value));
  $(container,"#noorFontScale").addEventListener("change",e=>{prefs.font_scale=e.target.value;choose();});
  $(container,"#noorReducedMotion").addEventListener("change",e=>{prefs.reduced_motion=e.target.checked;choose();});
  $(container,"#noorResetAppearance").addEventListener("click",()=>{prefs={...DEFAULT};choose();});
  refreshChoice();status("Only your school's appearance can be changed.");
 }
 window.NOOR_THEME_SETTINGS={mount,loadForCurrentUser,getPreferences:()=>({...prefs}),apply,setMode,flush:persist,reset};
 apply();
 window.addEventListener("focus",()=>{if(school()&&app().user?.id)loadForCurrentUser();});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden&&school()&&app().user?.id)loadForCurrentUser();});
})();