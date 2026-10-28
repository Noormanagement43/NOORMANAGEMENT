/* NOOR AI — personal appearance preferences, synced to the signed-in account. */
(() => {
  "use strict";
  const THEMES = [
    { id:"pastel-aurora",name:"Pastel Aurora",desc:"Peach, lavender, powder blue and rose from your first reference.",primary:"#4B6B8B",accent:"#E7C8D6",canvas:"#fff5f4",card:"#fffefa",ink:"#1B2A44" },
    { id:"linen-pearl",name:"Linen Pearl",desc:"Elegant pearl, warm beige and muted slate from your second reference.",primary:"#4B6382",accent:"#E3C39D",canvas:"#faf8f4",card:"#fffdfa",ink:"#071739" },
    { id:"porcelain-blue",name:"Blue & White",desc:"Clean white, soft sky and professional navy.",primary:"#3667A0",accent:"#A7C4D9",canvas:"#f3f9ff",card:"#ffffff",ink:"#183559" },
    { id:"rose-whisper",name:"Rose Whisper",desc:"Gentle blush, champagne and lavender-grey.",primary:"#9B6F91",accent:"#E7C8D6",canvas:"#fff8fb",card:"#ffffff",ink:"#453554" },
    { id:"rose-gold",name:"Burgundy & Ivory",desc:"Signature wine, rose gold and luminous ivory.",primary:"#6B0F1A",accent:"#D6B174",canvas:"#fff8f5",card:"#fffdfb",ink:"#301d25" },
    { id:"ocean-blue",name:"Deep Ocean",desc:"Blue leadership palette on crisp light surfaces.",primary:"#174A72",accent:"#A7C4D9",canvas:"#f2f7fc",card:"#ffffff",ink:"#172a38" },
    { id:"sage-garden",name:"Forest & Sage",desc:"Deep green accents and restful pale sage.",primary:"#315B45",accent:"#A4B5C4",canvas:"#f5faf6",card:"#fffefb",ink:"#203126" }
  ];
  const DEFAULT = { theme_key:"pastel-aurora", font_scale:"normal", reduced_motion:false, color_mode:"light" };
  let prefs = { ...DEFAULT }, mounted = null, activeUserId = null, saveTimer = null, loading = false, revision = 0, loadToken = 0, saveQueue = Promise.resolve();
  const app = () => window.NOOR_AI_APP || {};
  const $ = (root, selector) => root?.querySelector(selector);
  const e = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch]));
  const localKey = id => "noor.appearance." + id;
  const status = (message, kind="info") => {
    const node = mounted && $(mounted, "[data-theme-status]");
    if (node) { node.textContent = message; node.dataset.kind = kind; }
  };
  function apply() {
    const theme = THEMES.some(t => t.id === prefs.theme_key) ? prefs.theme_key : DEFAULT.theme_key;
    document.documentElement.dataset.noorTheme = theme;
    document.documentElement.dataset.noorMode = prefs.color_mode === "dark" ? "dark" : "light";
    document.querySelectorAll('#noor-principal.pd-dark').forEach(el => el.classList.remove('pd-dark'));
    try{localStorage.setItem("noor.login-theme",theme);localStorage.setItem("noor.login-mode",prefs.color_mode === "dark" ? "dark" : "light");}catch{}
    document.documentElement.dataset.noorFont = ["small","normal","large"].includes(prefs.font_scale) ? prefs.font_scale : "normal";
    document.documentElement.classList.toggle("noor-reduced-motion", Boolean(prefs.reduced_motion));
    if (mounted) renderSelected();
    window.dispatchEvent(new CustomEvent("noor:theme-changed", { detail: { ...prefs } }));
  }
  function localRead(id) {
    try {
      const data = JSON.parse(localStorage.getItem(localKey(id)) || "{}");
      return { ...DEFAULT, theme_key:localStorage.getItem("noor.login-theme")||DEFAULT.theme_key,color_mode:localStorage.getItem("noor.login-mode")==="dark"?"dark":"light", ...data };
    } catch { return { ...DEFAULT }; }
  }
  function localWrite(id) {
    try { localStorage.setItem(localKey(id), JSON.stringify({ ...prefs })); return true; }
    catch { return false; }
  }
  function clean(value) {
    const v = value || {};
    return {theme_key:THEMES.some(t=>t.id===v.theme_key)?v.theme_key:DEFAULT.theme_key,
      font_scale:["small","normal","large"].includes(v.font_scale)?v.font_scale:"normal",
      reduced_motion:v.reduced_motion===true,color_mode:v.color_mode==="dark"?"dark":"light",
      updated_at:typeof v.updated_at==="string"?v.updated_at:null};
  }
  async function loadForCurrentUser() {
    const userId=app().user?.id, db=app().db;
    if(!userId || !db)return;
    const token=++loadToken, version=revision;
    activeUserId=userId; loading=true;
    prefs=clean(localRead(userId));apply();
    const current=()=>token===loadToken && app().user?.id===userId && revision===version;
    try {
      const result=await db.auth.getUser();
      if(result.error)throw result.error;
      if(!current() || result.data?.user?.id!==userId)return;
      let remote=result.data.user.user_metadata?.noor_appearance;
      if(!remote){
        // Read previous account preferences once; new palettes do not depend
        // on the legacy table's restricted theme CHECK constraint.
        const old=await db.from("user_theme_preferences").select("theme_key,font_scale,reduced_motion,updated_at").eq("user_id",userId).maybeSingle();
        if(!old.error)remote=old.data;
      }
      if(!current())return;
      if(remote && (!prefs.updated_at || Date.parse(remote.updated_at||0)>=Date.parse(prefs.updated_at))){
        prefs=clean(remote);localWrite(userId);apply();
      }
      status("Your appearance applies to sign-up, sign-in and every dashboard.","success");
    }catch(error){if(current())status("Device preference restored. Account sync is unavailable.","warning");}
    finally{if(token===loadToken)loading=false;}
  }
  function persist() {
    const userId=app().user?.id, db=app().db, value=clean(prefs), version=revision;
    if(!userId || !db){status("Sign in to sync appearance.","warning");return Promise.resolve();}
    // Serialize saves so an older response cannot overwrite a newer choice.
    saveQueue=saveQueue.catch(()=>{}).then(async()=>{
      if(app().user?.id!==userId)return;
      const verified=await db.auth.getUser();
      if(verified.error || verified.data?.user?.id!==userId)throw Error("Sign in again to save appearance.");
      if(app().user?.id!==userId)return;
      // Metadata stores appearance only; it is never used for permissions.
      const result=await db.auth.updateUser({data:{noor_appearance:value}});
      if(result.error)throw result.error;
      if(result.data?.user?.id!==userId)throw Error("Appearance account mismatch.");
      if(app().user?.id===userId && revision===version)status("Appearance saved to your account.","success");
    }).catch(error=>{if(app().user?.id===userId && revision===version)status("Saved on this device; account sync failed. Try again.","warning");});
    return saveQueue;
  }
  function scheduleSave() {
    revision++;prefs.updated_at=new Date().toISOString();
    apply();if(app().user?.id)localWrite(app().user.id);
    status("Applying and saving…","info");
    const scheduledUserId=app().user?.id;
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(app().user?.id===scheduledUserId)persist();},250);
  }
  function setMode(mode){prefs.color_mode=mode==="dark"?"dark":"light";scheduleSave();}
  function renderSelected() {
    if (!mounted) return;
    mounted.querySelectorAll("[data-theme-choice]").forEach(button => {
      const selected = button.dataset.themeChoice === prefs.theme_key;
      button.setAttribute("aria-pressed", String(selected));
      const label = button.querySelector(".noor-theme-selected");
      if (label) label.textContent = selected ? "✓ Selected" : "Preview theme";
    });
    const font = $(mounted, "#noorFontScale"); if (font && document.activeElement !== font) font.value = prefs.font_scale;
    const mode = $(mounted,"#noorColorMode");if(mode)mode.value=prefs.color_mode;
    const reduced = $(mounted, "#noorReducedMotion"); if (reduced) reduced.checked = Boolean(prefs.reduced_motion);
  }
  function mount(container) {
    if (!container) return;
    mounted = container;
    container.innerHTML = '<section class="noor-theme-panel" aria-labelledby="noorThemeTitle">' +
      '<div class="noor-theme-head"><div><div class="eyebrow">Personal experience</div><h2 id="noorThemeTitle">Appearance Studio</h2><p>Choose one of four light palettes. Your selection stays active across sign-up, sign-in, settings and every dashboard on this browser, and syncs to your account.</p></div><div class="noor-theme-status" data-theme-status role="status" aria-live="polite">Loading appearance preferences…</div></div>' +
      '<div class="noor-theme-grid">' + THEMES.slice(0,4).map(theme =>
        '<button type="button" class="noor-theme-card" data-theme-choice="' + theme.id + '" aria-pressed="false" aria-label="Use ' + e(theme.name) + ' theme">' +
          '<span class="noor-theme-preview" style="--preview-primary:' + theme.primary + ';--preview-accent:' + theme.accent + ';--preview-canvas:' + theme.canvas + ';--preview-card:' + theme.card + ';--preview-ink:' + theme.ink + '">' +
            '<span class="noor-theme-mini-nav"></span><span class="noor-theme-mini-content"><span class="noor-theme-mini-title"></span><span class="noor-theme-mini-cards"><span></span><span></span></span></span>' +
          '</span><span class="noor-theme-name">' + e(theme.name) + '</span><span class="noor-theme-desc">' + e(theme.desc) + '</span><span class="noor-theme-selected">Preview theme</span></button>'
      ).join("") + '</div><div class="noor-theme-options">' +
      '<div class="noor-theme-field"><label for="noorFontScale">Text size</label><select id="noorFontScale"><option value="small">Compact</option><option value="normal">Standard</option><option value="large">Comfortable / Large</option></select></div>' +
      '<div class="noor-theme-field"><label for="noorColorMode">Display mode</label><select id="noorColorMode"><option value="light">Light</option><option value="dark">Dark</option></select></div>'+
      '<div class="noor-theme-field"><label>Motion</label><label class="noor-theme-check"><input type="checkbox" id="noorReducedMotion"> Reduce animations</label></div>' +
      '<div class="noor-theme-field"><label>Personal settings</label><div class="noor-theme-caption">Preferences follow your account when account sync is available.</div></div>' +
      '</div><div class="noor-theme-actions"><button class="noor-theme-reset" type="button" id="noorResetAppearance">Reset to Pastel Aurora</button><span class="noor-theme-caption">Sound controls are below in Sound &amp; Feel. Your sound volume and theme remain separate.</span></div></section>';
    container.querySelectorAll("[data-theme-choice]").forEach(button => button.addEventListener("click", () => {
      prefs.theme_key = button.dataset.themeChoice;
      scheduleSave();
    }));
    $(container,"#noorColorMode").addEventListener("change",event=>setMode(event.target.value));
    $(container, "#noorFontScale").addEventListener("change", event => { prefs.font_scale = event.target.value; scheduleSave(); });
    $(container, "#noorReducedMotion").addEventListener("change", event => { prefs.reduced_motion = event.target.checked; scheduleSave(); });
    $(container, "#noorResetAppearance").addEventListener("click", () => { prefs = { ...DEFAULT }; scheduleSave(); });
    renderSelected();
    status(app().user?.id ? "Your account appearance preferences." : "Sign in to sync appearance preferences.", "info");
  }
  window.NOOR_THEME_SETTINGS = { mount, loadForCurrentUser, getPreferences:() => ({ ...prefs }), apply, setMode, flush:persist };
  try{const startup=localStorage.getItem('noor.login-theme');document.documentElement.dataset.noorTheme=THEMES.some(t=>t.id===startup)?startup:DEFAULT.theme_key;}catch{document.documentElement.dataset.noorTheme=DEFAULT.theme_key;}
  try{prefs.theme_key=document.documentElement.dataset.noorTheme;prefs.color_mode=localStorage.getItem("noor.login-mode")==="dark"?"dark":"light";apply();}catch{}
  window.addEventListener("storage", event => {
    if (event.key !== localKey(app().user?.id) || !event.newValue) return;
    try { prefs = { ...DEFAULT, ...JSON.parse(event.newValue) }; apply(); } catch {}
  });
})();