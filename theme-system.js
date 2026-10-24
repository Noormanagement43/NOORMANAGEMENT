/* NOOR AI — personal appearance preferences, synced to the signed-in account. */
(() => {
  "use strict";
  const THEMES = [
    { id:"rose-gold", name:"Rose Gold", desc:"Signature berry, blush and warm gold.", primary:"#54243b", accent:"#d6b174", canvas:"#fff8f5", card:"#fffdfb", ink:"#2c2027" },
    { id:"pearl-ivory", name:"Pearl Ivory", desc:"Quiet neutral luxury for focused work.", primary:"#5a5148", accent:"#b58a4a", canvas:"#f8f6f1", card:"#fffefa", ink:"#282522" },
    { id:"ocean-blue", name:"Ocean Blue", desc:"Calm navy with crisp blue highlights.", primary:"#244d78", accent:"#d6aa67", canvas:"#f2f7fc", card:"#fcfeff", ink:"#1d2b3c" },
    { id:"sage-garden", name:"Sage Garden", desc:"Soft botanical greens and warm neutrals.", primary:"#365d4c", accent:"#c6a168", canvas:"#f4f8f2", card:"#fdfffb", ink:"#24342b" },
    { id:"lavender-mist", name:"Lavender Mist", desc:"Gentle lilac, muted violet and pearl.", primary:"#62508a", accent:"#c7a66f", canvas:"#f8f6fd", card:"#fffefe", ink:"#302943" },
    { id:"teal-glass", name:"Teal Glass", desc:"Fresh teal with a modern glass-like finish.", primary:"#176b70", accent:"#cba56a", canvas:"#f0f9f8", card:"#fbffff", ink:"#19383a" },
    { id:"sandstone", name:"Sandstone", desc:"Earthy caramel, stone and cream.", primary:"#79543c", accent:"#c99b5a", canvas:"#faf4ec", card:"#fffdf8", ink:"#37291f" },
    { id:"midnight-luxe", name:"Midnight Luxe", desc:"Premium dark surfaces with soft lilac glow.", primary:"#b08adf", accent:"#dfbd82", canvas:"#100e17", card:"#191622", ink:"#f2edf8" }
  ];
  const DEFAULT = { theme_key:"rose-gold", font_scale:"normal", reduced_motion:false };
  let prefs = { ...DEFAULT }, mounted = null, activeUserId = null, saveTimer = null, loading = false;
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
    document.documentElement.dataset.noorFont = ["small","normal","large"].includes(prefs.font_scale) ? prefs.font_scale : "normal";
    document.documentElement.classList.toggle("noor-reduced-motion", Boolean(prefs.reduced_motion));
    if (mounted) renderSelected();
    window.dispatchEvent(new CustomEvent("noor:theme-changed", { detail: { ...prefs } }));
  }
  function localRead(id) {
    try {
      const data = JSON.parse(localStorage.getItem(localKey(id)) || "{}");
      return { ...DEFAULT, ...data };
    } catch { return { ...DEFAULT }; }
  }
  function localWrite(id) {
    try { localStorage.setItem(localKey(id), JSON.stringify({ ...prefs, updated_at:new Date().toISOString() })); return true; }
    catch { return false; }
  }
  async function loadForCurrentUser() {
    const userId = app().user?.id;
    if (!userId) return;
    if (loading && activeUserId === userId) return;
    loading = true; activeUserId = userId;
    prefs = localRead(userId);
    apply();
    try {
      const db = app().db;
      if (db) {
        const { data, error } = await db.from("user_theme_preferences")
          .select("theme_key,font_scale,reduced_motion").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (data) {
          prefs = { ...DEFAULT, ...data };
          localWrite(userId); apply();
          status("Appearance synced to your NOOR AI account.", "success");
        } else {
          status("Choose a look; it will be saved to your NOOR AI account.", "info");
        }
      } else {
        status("Saved on this device. Account sync is unavailable.", "warning");
      }
    } catch (error) {
      console.warn("[NOOR Appearance] Account sync unavailable; local preferences remain active.", error?.code || error?.message || "sync failed");
      status("Saved on this device; account sync needs attention.", "warning");
    } finally {
      loading = false;
    }
  }
  async function persist() {
    const userId = app().user?.id;
    if (!userId) { status("Sign in to save these preferences.", "warning"); return; }
    localWrite(userId);
    status("Saving your appearance…", "info");
    try {
      const db = app().db;
      if (!db) throw new Error("Account database is unavailable.");
      const row = { user_id:userId, theme_key:prefs.theme_key, font_scale:prefs.font_scale, reduced_motion:Boolean(prefs.reduced_motion), updated_at:new Date().toISOString() };
      const { error } = await db.from("user_theme_preferences").upsert(row, { onConflict:"user_id" });
      if (error) throw error;
      status("Saved to your NOOR AI account.", "success");
    } catch (error) {
      console.warn("[NOOR Appearance] Account save failed; local copy retained.", error?.code || error?.message || "save failed");
      status("Saved on this device, but account sync failed.", "warning");
    }
  }
  function scheduleSave() {
    apply();
    localWrite(app().user?.id);
    status("Applying and saving…", "info");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 250);
  }
  function renderSelected() {
    if (!mounted) return;
    mounted.querySelectorAll("[data-theme-choice]").forEach(button => {
      const selected = button.dataset.themeChoice === prefs.theme_key;
      button.setAttribute("aria-pressed", String(selected));
      const label = button.querySelector(".noor-theme-selected");
      if (label) label.textContent = selected ? "✓ Selected" : "Preview theme";
    });
    const font = $(mounted, "#noorFontScale"); if (font && document.activeElement !== font) font.value = prefs.font_scale;
    const reduced = $(mounted, "#noorReducedMotion"); if (reduced) reduced.checked = Boolean(prefs.reduced_motion);
  }
  function mount(container) {
    if (!container) return;
    mounted = container;
    container.innerHTML = '<section class="noor-theme-panel" aria-labelledby="noorThemeTitle">' +
      '<div class="noor-theme-head"><div><div class="eyebrow">Personal experience</div><h2 id="noorThemeTitle">Appearance Studio</h2><p>Pick a polished workspace theme for your own account. Your selection changes only your view—it does not change another student’s, teacher’s or school’s preferences.</p></div><div class="noor-theme-status" data-theme-status role="status" aria-live="polite">Loading appearance preferences…</div></div>' +
      '<div class="noor-theme-grid">' + THEMES.map(theme =>
        '<button type="button" class="noor-theme-card" data-theme-choice="' + theme.id + '" aria-pressed="false" aria-label="Use ' + e(theme.name) + ' theme">' +
          '<span class="noor-theme-preview" style="--preview-primary:' + theme.primary + ';--preview-accent:' + theme.accent + ';--preview-canvas:' + theme.canvas + ';--preview-card:' + theme.card + ';--preview-ink:' + theme.ink + '">' +
            '<span class="noor-theme-mini-nav"></span><span class="noor-theme-mini-content"><span class="noor-theme-mini-title"></span><span class="noor-theme-mini-cards"><span></span><span></span></span></span>' +
          '</span><span class="noor-theme-name">' + e(theme.name) + '</span><span class="noor-theme-desc">' + e(theme.desc) + '</span><span class="noor-theme-selected">Preview theme</span></button>'
      ).join("") + '</div><div class="noor-theme-options">' +
      '<div class="noor-theme-field"><label for="noorFontScale">Text size</label><select id="noorFontScale"><option value="small">Compact</option><option value="normal">Standard</option><option value="large">Comfortable / Large</option></select></div>' +
      '<div class="noor-theme-field"><label>Motion</label><label class="noor-theme-check"><input type="checkbox" id="noorReducedMotion"> Reduce animations</label></div>' +
      '<div class="noor-theme-field"><label>Personal settings</label><div class="noor-theme-caption">Preferences follow your account when account sync is available.</div></div>' +
      '</div><div class="noor-theme-actions"><button class="noor-theme-reset" type="button" id="noorResetAppearance">Reset to Rose Gold</button><span class="noor-theme-caption">Sound controls are below in Sound &amp; Feel. Your sound volume and theme remain separate.</span></div></section>';
    container.querySelectorAll("[data-theme-choice]").forEach(button => button.addEventListener("click", () => {
      prefs.theme_key = button.dataset.themeChoice;
      scheduleSave();
    }));
    $(container, "#noorFontScale").addEventListener("change", event => { prefs.font_scale = event.target.value; scheduleSave(); });
    $(container, "#noorReducedMotion").addEventListener("change", event => { prefs.reduced_motion = event.target.checked; scheduleSave(); });
    $(container, "#noorResetAppearance").addEventListener("click", () => { prefs = { ...DEFAULT }; scheduleSave(); });
    renderSelected();
    status(app().user?.id ? "Your account appearance preferences." : "Sign in to sync appearance preferences.", "info");
  }
  window.NOOR_THEME_SETTINGS = { mount, loadForCurrentUser, getPreferences:() => ({ ...prefs }), apply };
  window.addEventListener("storage", event => {
    if (event.key !== localKey(app().user?.id) || !event.newValue) return;
    try { prefs = { ...DEFAULT, ...JSON.parse(event.newValue) }; apply(); } catch {}
  });
})();