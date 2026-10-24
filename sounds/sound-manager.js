/* Central SoundManager for every NOOR AI panel. No component should create its own audio. */
(() => {
  "use strict";
  const MAP = () => window.NOOR_SOUND_MAP || { eventToAsset: {}, categories: [], cheerEvents: [] };
  const DEFAULTS = Object.freeze({ masterSound: true, volume: 1, voiceCheers: true, haptics: true });
  const LOCAL_PREFIX = "noor.sound-feel.v1.";
  const DAILY_PREFIX = "noor.sound-daily.v1.";
  const MAX_VOLUME = 1;
  const DEBOUNCE_MS = 80;
  const REDUCED_MOTION = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const assets = window.NOOR_SOUND_ASSETS || {};
  const howls = Object.create(null);
  const listeners = new Set();
  let userId = null;
  let role = null;
  let supabase = null;
  let prefs = { ...DEFAULTS };
  let localUpdatedAt = 0;
  let saveTimer = 0;
  let lastPlayedAt = 0;
  let lastSoundName = "";
  let unlocked = false;
  let pendingLoginSound = "";
  let audioContext = null;
  let audioFailure = false;
  let dbReady = null;
  let speechIndex = 0;
  let lastVoiceAt = 0;
  let cheerTimer = 0;
  let toastObserver = null;
  let featureObserversAttached = false;
  let lastTypingAt = 0;
  const timerValues = new WeakMap();
  const activeIds = new Map();

  const clampVolume = value => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(MAX_VOLUME, Math.max(0, n)) : DEFAULTS.volume;
  };
  const cleanPrefs = value => ({
    masterSound: value?.masterSound !== false,
    volume: clampVolume(value?.volume ?? DEFAULTS.volume),
    voiceCheers: value?.voiceCheers !== false,
    haptics: value?.haptics !== false
  });
  const storageKey = id => LOCAL_PREFIX + (id || "guest");
  const emit = () => {
    const detail = { ...prefs, userId, role, syncStatus: supabase ? (dbReady === false ? "local-only" : "connected") : "local" };
    listeners.forEach(fn => { try { fn(detail); } catch (_) {} });
    window.dispatchEvent(new CustomEvent("noor:sound-preferences", { detail }));
  };
  const readLocal = id => {
    try {
      const raw = localStorage.getItem(storageKey(id));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return { prefs: cleanPrefs(parsed), updatedAt: Number(parsed.updatedAt) || 0 };
    } catch (_) { return null; }
  };
  const writeLocal = () => {
    localUpdatedAt = Date.now();
    try { localStorage.setItem(storageKey(userId), JSON.stringify({ ...prefs, updatedAt: localUpdatedAt })); } catch (_) {}
    emit();
  };
  const safeStopSpeech = () => {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {}
  };
  function applyMaster() {
    const v = clampVolume(prefs.volume);
    if (window.Howler) {
      try { window.Howler.volume(v); window.Howler.mute(!prefs.masterSound); } catch (_) {}
    }
    if (!prefs.masterSound || v <= 0) {
      if (cheerTimer) { window.clearTimeout(cheerTimer); cheerTimer = 0; }
      Object.values(howls).forEach(h => { try { h.stop(); } catch (_) {} });
      activeIds.clear();
      safeStopSpeech();
    }
  }
  function sourceFor(key) {
    const payload = assets[key];
    return payload ? "data:audio/ogg;base64," + payload : "";
  }
  function preload() {
    const Howl = window.Howl;
    if (!Howl) { audioFailure = true; console.warn("[NOOR Sound] Howler did not load; Web Audio fallback will be used where available."); return; }
    for (const [key, payload] of Object.entries(assets)) {
      if (!payload || howls[key]) continue;
      try {
        howls[key] = new Howl({
          src: [sourceFor(key)],
          format: ["ogg"],
          preload: true,
          volume: 0.9,
          html5: false,
          pool: 2,
          onloaderror: (id, error) => { audioFailure = true; console.warn("[NOOR Sound] Audio asset failed to load; other sounds remain available:", key, error); }
        });
      } catch (_) { audioFailure = true; }
    }
    applyMaster();
  }
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      if (window.Howler?.ctx?.state === "suspended") window.Howler.ctx.resume().catch(() => {});
    } catch (_) {}
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !audioContext) audioContext = new Ctx();
      if (audioContext?.state === "suspended") audioContext.resume().catch(() => {});
    } catch (_) {}
    if (pendingLoginSound && prefs.masterSound) {
      const queued = pendingLoginSound;
      pendingLoginSound = "";
      playSound(queued, { force: true, noVoice: true });
    }
  }
  function synthFallback(name, opts = {}) {
    if (!prefs.masterSound || prefs.volume <= 0 || !audioContext) return false;
    try {
      const now = audioContext.currentTime;
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(Math.min(0.18, prefs.volume * 0.45), now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (REDUCED_MOTION ? 0.12 : 0.2));
      gain.connect(audioContext.destination);
      const osc = audioContext.createOscillator();
      const pattern = ({
        "soft-buzz":[175,"triangle"], "soft-thud":[115,"sine"], "two-note-warning":[360,"sine"],
        "ding":[740,"sine"], "soft-chime":[660,"sine"], "sparkle":[1040,"sine"],
        "level-up":[880,"sine"], "tada":[920,"sine"], "tick":[1200,"square"],
        "soft-tick-tock":[950,"square"], "bubble-pop":[520,"sine"], "click":[720,"triangle"],
        "pop":[560,"sine"], "check-tick":[1000,"sine"], "bell":[620,"sine"]
      })[name] || [520,"sine"];
      osc.type = pattern[1];
      osc.frequency.setValueAtTime(pattern[0], now);
      if (["ding","soft-chime","sparkle","level-up","tada","star-twinkle"].includes(name)) {
        osc.frequency.exponentialRampToValueAtTime(pattern[0] * 1.34, now + 0.09);
      }
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + (REDUCED_MOTION ? 0.12 : 0.2));
      return true;
    } catch (_) { return false; }
  }
  function vibrate(pattern = 12) {
    if (!prefs.haptics || !navigator.vibrate) return false;
    try { return navigator.vibrate(pattern); } catch (_) { return false; }
  }
  function cheer(locale) {
    if (!prefs.masterSound || !prefs.voiceCheers || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    const now = Date.now();
    if (now - lastVoiceAt < 1200) return false;
    lastVoiceAt = now;
    const cheers = MAP().cheers || {};
    const locales = ["en", "hi", "te"];
    const lang = locales.includes(locale) ? locale : locales[speechIndex++ % locales.length];
    const phraseList = cheers[lang] || cheers.en || ["Well done!"];
    const phrase = phraseList[(speechIndex++) % phraseList.length] || phraseList[0];
    try {
      safeStopSpeech();
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = ({ en: "en-IN", hi: "hi-IN", te: "te-IN" })[lang] || "en-IN";
      utter.volume = Math.min(0.42, prefs.volume);
      utter.rate = 0.94;
      utter.pitch = 1.02;
      const voices = window.speechSynthesis.getVoices?.() || [];
      const langPrefix = utter.lang.toLowerCase().slice(0, 2);
      const matching = voices.filter(v => String(v.lang || "").toLowerCase().startsWith(langPrefix));
      const likelyWarmFemale = matching.find(v => /female|zira|samantha|karen|priya|heera|lekha|veena|siri/i.test(v.name || ""));
      if (likelyWarmFemale || matching[0]) utter.voice = likelyWarmFemale || matching[0];
      window.speechSynthesis.speak(utter);
      return true;
    } catch (_) { return false; }
  }
  function playSound(name, options = {}) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return false;
    const now = Date.now();
    if (!options.force && now - lastPlayedAt < DEBOUNCE_MS) return false;
    if (lastSoundName === key && now - lastPlayedAt < DEBOUNCE_MS) return false;
    lastPlayedAt = now;
    lastSoundName = key;
    const tactileEvents = ["soft-buzz","soft-thud","two-note-warning","submit-swoosh","check-tick","sparkle","tada"];
    if (tactileEvents.includes(key)) vibrate(key === "tada" || key === "sparkle" ? [12, 22, 12] : 12);
    if ((!options.force && !prefs.masterSound) || prefs.volume <= 0) return false;
    if (cheerTimer) { window.clearTimeout(cheerTimer); cheerTimer = 0; }
    if (window.speechSynthesis?.speaking) safeStopSpeech();
    const eventMap = MAP().eventToAsset || {};
    const assetKey = eventMap[key];
    const howl = assetKey ? howls[assetKey] : null;
    if (howl && howl.state() === "loaded") {
      try {
        Object.values(howls).forEach(h => { try { h.stop(); } catch (_) {} });
        activeIds.clear();
        howl.volume(0);
        const id = howl.play();
        const relativeGain = ({ "soft-buzz":0.43, "soft-thud":0.45, "two-note-warning":0.48,
          "applause":0.52, "party-horn":0.46, "gentle-gong":0.48, "tinkle-bell":0.46 })[key] || 0.62;
        howl.fade(0, relativeGain, REDUCED_MOTION ? 8 : 24, id);
        activeIds.set(assetKey, id);
        const duration = Number(howl.duration(id)) || 0.45;
        const fadeAt = Math.max(40, duration * 1000 - (REDUCED_MOTION ? 50 : 85));
        window.setTimeout(() => {
          try {
            if (howl.playing(id)) howl.fade(relativeGain, 0, REDUCED_MOTION ? 25 : 85, id);
          } catch (_) {}
        }, fadeAt);
      } catch (_) { synthFallback(key); }
    } else {
      synthFallback(key);
    }
    if (!options.noVoice && (MAP().cheerEvents || []).includes(key)) {
      const clipLength = assetKey && howls[assetKey] ? (Number(howls[assetKey].duration()) || 0.22) : 0.22;
      const wait = Math.min(1400, Math.max(260, clipLength * 1000 + 40));
      cheerTimer = window.setTimeout(() => {
        cheerTimer = 0;
        if (prefs.masterSound && prefs.voiceCheers) cheer();
      }, wait);
    }
    return true;
  }
  function setVolume(value) {
    prefs = cleanPrefs({ ...prefs, volume: value });
    applyMaster();
    writeLocal();
    scheduleSave();
    return prefs.volume;
  }
  function mute() {
    prefs = { ...prefs, masterSound: false };
    writeLocal();
    applyMaster();
    scheduleSave();
  }
  function unmute() {
    prefs = { ...prefs, masterSound: true };
    writeLocal();
    applyMaster();
    scheduleSave();
  }
  function setPreferences(patch) {
    const next = cleanPrefs({ ...prefs, ...(patch || {}) });
    const wasOn = prefs.masterSound;
    prefs = next;
    writeLocal();
    applyMaster();
    scheduleSave();
    if (wasOn && !prefs.masterSound) {
      Object.values(howls).forEach(h => { try { h.stop(); } catch (_) {} });
      safeStopSpeech();
    }
    return { ...prefs };
  }
  function scheduleSave() {
    if (saveTimer) window.clearTimeout(saveTimer);
    if (!userId || !supabase) return;
    saveTimer = window.setTimeout(async () => {
      const snapshot = { ...prefs };
      try {
        const result = await supabase.from("user_sound_preferences").upsert({
          user_id: userId,
          master_sound_enabled: snapshot.masterSound,
          volume: clampVolume(snapshot.volume),
          voice_cheers_enabled: snapshot.voiceCheers,
          haptic_enabled: snapshot.haptics,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });
        if (result.error) { dbReady = false; emit(); return; } /* Local settings remain functional if the migration is not deployed. */
        dbReady = true;
        emit();
      } catch (_) { /* Audio failures and database failures never block the workspace. */ }
    }, 280);
  }
  function loadUser(id, nextRole, client) {
    userId = id || null;
    role = nextRole || null;
    supabase = client || null;
    dbReady = supabase ? null : false;
    const local = readLocal(userId);
    prefs = local?.prefs ? cleanPrefs(local.prefs) : { ...DEFAULTS };
    localUpdatedAt = local?.updatedAt || 0;
    const volumeMigrationKey = "noor.sound-volume-v2." + (userId || "guest");
    let migrateVolume = false;
    try {
      migrateVolume = localStorage.getItem(volumeMigrationKey) !== "1";
      if (migrateVolume) localStorage.setItem(volumeMigrationKey, "1");
    } catch (_) {}
    applyMaster(); /* Apply a remembered mute before any new interaction can play. */
    let lastDay = "";
    try { lastDay = localStorage.getItem(DAILY_PREFIX + (userId || "guest")) || ""; } catch (_) {}
    const today = new Date().toLocaleDateString("en-CA");
    pendingLoginSound = lastDay === today ? "soft-chime" : "harp-swipe";
    try { localStorage.setItem(DAILY_PREFIX + (userId || "guest"), today); } catch (_) {}
    emit();
    if (unlocked && pendingLoginSound && prefs.masterSound) {
      const queued = pendingLoginSound;
      pendingLoginSound = "";
      playSound(queued, { force: true, noVoice: true });
    }
    if (!userId || !supabase) return;
    (async () => {
      try {
        const result = await supabase.from("user_sound_preferences")
          .select("master_sound_enabled,volume,voice_cheers_enabled,haptic_enabled,updated_at")
          .eq("user_id", userId).maybeSingle();
        if (result.error) { dbReady = false; emit(); return; }
        dbReady = true;
        const remote = result.data;
        if (remote && (!local || (Date.parse(remote.updated_at || "") || 0) > localUpdatedAt)) {
          prefs = cleanPrefs({
            masterSound: remote.master_sound_enabled,
            volume: remote.volume,
            voiceCheers: remote.voice_cheers_enabled,
            haptics: remote.haptic_enabled
          });
          applyMaster();
          writeLocal();
        } else if (!remote) {
          /* First login: seed a personal database row with all sound and haptic options ON. */
          scheduleSave();
        }
        if (migrateVolume) {
          /* Previous releases capped output at 50%; migrate existing accounts once to the requested 100% default. */
          prefs.volume = 1;
          applyMaster();
          scheduleSave();
        }
        emit();
      } catch (_) { /* Offline: use the instant local preferences. */ }
    })();
  }
  function clearUser() {
    safeStopSpeech();
    if (cheerTimer) { window.clearTimeout(cheerTimer); cheerTimer = 0; }
    Object.values(howls).forEach(h => { try { h.stop(); } catch (_) {} });
    userId = null;
    role = null;
    supabase = null;
    dbReady = null;
    pendingLoginSound = "";
    prefs = { ...DEFAULTS };
    applyMaster();
    emit();
  }
  function previewVoice() {
    if (!prefs.masterSound) return false;
    return cheer("en");
  }
  function installDelegates() {
    if (document.__noorSoundDelegates) return;
    document.__noorSoundDelegates = true;
    const getEvent = el => {
      if (!el || el.closest("[data-sound-preview], #soundMasterToggle")) return "";
      if (el.classList?.contains("sound-switch") && el.querySelector?.("#soundMasterToggle")) return "";
      if (el.classList?.contains("sound-switch")) return "bubble-pop";
      if (el.dataset?.sound === "none") return "";
      if (el.dataset?.sound) return el.dataset.sound;
      const txt = (el.innerText || el.textContent || el.getAttribute("aria-label") || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (el.closest("#mainNav") || el.id === "mobileMenu") return "slide";
      if (el.matches('input[type="checkbox"],input[type="radio"]')) return "bubble-pop";
      if (/\b(delete|remove permanently|discard)\b/.test(txt)) return "paper-crumple";
      if (/\b(generate|rewrite|create ai|smart notes|ai draft|ask ai)\b/.test(txt)) return "magic-wand";
      if (/\b(upload|attach file|choose file)\b/.test(txt)) return "upload-blip";
      if (/\b(download|export|file ready)\b/.test(txt)) return "download-done";
      if (/\b(message received|new message|incoming message)\b/.test(txt)) return "soft-doorbell";
      if (/\b(send|reply)\b/.test(txt)) return "send-whoosh";
      if (/\b(submit|finish test|turn in)\b/.test(txt)) return "submit-swoosh";
      if (/\b(time is up|time up|timer finished|time expired)\b/.test(txt)) return "gentle-gong";
      if (/\b(streak freeze|freeze streak|streak paused)\b/.test(txt)) return "ice-crystal";
      if (/\b(streak continues|continue streak|streak maintained)\b/.test(txt)) return "fire-whoosh";
      if (/\b(coin collect|coins earned|xp gained|earned xp)\b/.test(txt)) return "coin-collect";
      if (/\b(birthday|celebration|party time)\b/.test(txt)) return "party-horn";
      if (/\b(applause|top rank|first place|champion|top score)\b/.test(txt)) return "applause";
      if (/\b(result revealed|reveal result|results ready|show results)\b/.test(txt)) return "tada";
      if (/\b(present|mark present|attendance)\b/.test(txt)) return "check-tick";
      if (/\b(correct|right answer|well done)\b/.test(txt)) return "ding";
      if (/\b(wrong|incorrect|try again)\b/.test(txt)) return "soft-buzz";
      if (/\b(badge|achievement|streak|xp earned|level up)\b/.test(txt)) return "sparkle";
      if (/\b(flashcard|flip card|show answer)\b/.test(txt)) return "card-flip";
      if (/\b(reminder|remind me|notification)\b/.test(txt)) return "tinkle-bell";
      if (/\b(edit|write|draft|compose)\b/.test(txt)) return "pencil-scribble";
      if (/\b(save|confirm|approve|mark complete)\b/.test(txt)) return "check-tick";
      if (/\b(back|close|cancel)\b/.test(txt)) return "whoosh";
      return "click";
    };
    document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
    document.addEventListener("touchstart", unlock, { capture: true, passive: true });
    document.addEventListener("keydown", unlock, { capture: true });
    document.addEventListener("click", event => {
      const el = event.target?.closest?.('button,a[role="button"],[role="button"],.sound-switch,input[type="checkbox"],input[type="radio"],summary');
      if (!el) return;
      if (el.closest("[data-sound-preview], #soundMasterToggle")) return;
      const sound = getEvent(el);
      if (sound) playSound(sound);
    }, true);
    document.addEventListener("change", event => {
      const el = event.target;
      if (el?.matches?.("select") && !el.closest("[data-sound-preview]")) playSound("marimba-tap");
    }, true);
    document.addEventListener("submit", event => {
      const form = event.target;
      const id = String(form?.id || "").toLowerCase();
      if (/assessment|test|quiz/.test(id)) playSound("submit-swoosh");
      else if (/notesform|planform|reportform/.test(id)) playSound("pencil-scribble");
    }, true);
    const observeToast = () => {
      const toastEl = document.getElementById("toast");
      if (!toastEl || toastObserver) return;
      toastObserver = new MutationObserver(() => {
        if (!toastEl.style.display || toastEl.style.display === "none" || !toastEl.textContent.trim()) return;
        const kind = (toastEl.className || "").toLowerCase();
        if (kind.includes("error")) playSound("soft-thud");
        else if (kind.includes("success")) playSound("bell");
      });
      toastObserver.observe(toastEl, { attributes: true, childList: true, characterData: true, subtree: true });
    };
    const observeFeaturePanels = () => {
      if (featureObserversAttached) return;
      featureObserversAttached = true;
      const teachingRoot = document.getElementById("view-teaching");
      if (teachingRoot) {
        new MutationObserver(records => {
          const statusNodes = new Set();
          for (const record of records) {
            const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
            const closestStatus = target?.closest?.("#ocrStatus,#notesAiStatus,[data-ai-status],[aria-live]");
            if (closestStatus) statusNodes.add(closestStatus);
            for (const node of Array.from(record.addedNodes || [])) {
              if (node.nodeType !== 1) continue;
              if (node.matches?.("#ocrStatus,#notesAiStatus,[data-ai-status],[aria-live]")) statusNodes.add(node);
              node.querySelectorAll?.("#ocrStatus,#notesAiStatus,[data-ai-status],[aria-live]").forEach(el => statusNodes.add(el));
            }
          }
          for (const el of statusNodes) {
            const message = (el.textContent || "").toLowerCase();
            const kind = (el.className || "").toLowerCase();
            if (/generating notes|extracting text|processing syllabus|writing draft|drafting notes/.test(message)) {
              const now = Date.now();
              if (now - lastTypingAt > 900) { lastTypingAt = now; playSound("typing-blip"); }
            } else if (kind.includes("success") && /ai draft created|result revealed|results ready/.test(message)) {
              playSound("tada");
            }
          }
        }).observe(teachingRoot, { childList: true, characterData: true, attributes: true, subtree: true });
      }
      const assessmentRoot = document.getElementById("view-assessments");
      if (assessmentRoot) {
        new MutationObserver(() => {
          assessmentRoot.querySelectorAll("[data-test-timer],[data-countdown],.test-timer,#testTimer").forEach(el => {
            const value = (el.textContent || "").trim();
            let seconds = NaN;
            const clock = value.match(/^(\d{1,2}):(\d{2})$/);
            const plain = value.match(/^(\d{1,3})(?:\s*s(?:ec(?:ond)?s?)?)?$/i);
            if (clock) seconds = Number(clock[1]) * 60 + Number(clock[2]);
            else if (plain) seconds = Number(plain[1]);
            if (!Number.isFinite(seconds)) return;
            const previous = timerValues.get(el);
            timerValues.set(el, seconds);
            if (seconds > 0 && seconds <= 10 && seconds !== previous) playSound("tick");
          });
        }).observe(assessmentRoot, { childList: true, characterData: true, subtree: true });
      }
    };
    const afterDomReady = () => { observeToast(); observeFeaturePanels(); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", afterDomReady, { once: true });
    else afterDomReady();
  }
  const guestLocal = readLocal(null);
  if (guestLocal?.prefs) { prefs = cleanPrefs(guestLocal.prefs); localUpdatedAt = guestLocal.updatedAt || 0; }
  preload();
  applyMaster();
  installDelegates();
  window.NOOR_SOUND = {
    playSound, setVolume, mute, unmute, setPreferences, loadUser, clearUser,
    getPreferences: () => ({ ...prefs }),
    getStatus: () => ({ userId, role, sync: supabase ? (dbReady === false ? "local-only" : "connected") : "local", audioFallback: audioFailure }),
    getAssetStatuses: () => Object.fromEntries(Object.entries(howls).map(([key, howl]) => [key, { state: howl.state(), duration: Number(howl.duration()) || 0 }])),
    getMappedSoundNames: () => Object.keys(MAP().eventToAsset || {}),
    onPreferencesChange: fn => { if (typeof fn === "function") { listeners.add(fn); return () => listeners.delete(fn); } return () => {}; },
    vibrate, cheer, previewVoice,
    unlock
  };
})();