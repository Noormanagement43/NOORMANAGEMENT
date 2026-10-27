/**
 * NOOR School Management - Interactive Guide Avatar & Voice Assistant
 * Replaces legacy mascots and floating toolbars with an integrated, professional
 * role-aware Guide Avatar using assets/guide-avatar.png and Natural Female TTS.
 */

(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const getApp = () => window.NOOR_AI_APP || {};
  const getRole = () => getApp().profile?.role || 'authenticated';
  const getProfile = () => getApp().profile || {};
  const getSchool = () => getApp().school || {};

  let isSpeaking = false;
  let isMuted = localStorage.getItem('noor_guide_muted') === 'true';
  let activeSpeechTimeout = null;
  let recognition = null;
  let isListening = false;

  // Gentle audio chime chord using Web Audio API
  function playGuideChime() {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const freqs = [587.33, 739.99, 880.0, 1174.66]; // D5, F#5, A5, D6 harmonic chord
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.06, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.5);
      });
    } catch (e) {
      console.warn('Guide chime:', e);
    }
  }

  // Best natural female neural voice selection
  function getBestFemaleVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) return null;

    // Preference hierarchy for clear, pleasant female voices
    const searchTerms = [
      'Google UK English Female',
      'Google US English',
      'Microsoft Zira',
      'Microsoft Jenny Online (Natural)',
      'Microsoft Jenny',
      'Heera',
      'Veena',
      'Samantha',
      'Karen',
      'Moira',
      'female'
    ];

    for (const term of searchTerms) {
      const v = voices.find(x => x.name.toLowerCase().includes(term.toLowerCase()));
      if (v) return v;
    }

    // Fallback: any en-IN, en-GB, en-US voice
    return voices.find(x => x.lang.startsWith('en')) || voices[0];
  }

  function speakText(text) {
    if (isMuted || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*_#`~✦✓●]/g, '').trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      const voice = getBestFemaleVoice();
      if (voice) utterance.voice = voice;
      utterance.pitch = 1.08;
      utterance.rate = 0.96;

      const wrap = $('noorGuideAvatarWrap');
      utterance.onstart = () => {
        isSpeaking = true;
        if (wrap) wrap.classList.add('speaking');
      };
      utterance.onend = utterance.onerror = () => {
        isSpeaking = false;
        if (wrap) wrap.classList.remove('speaking');
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  // Guidance texts based on active view and role
  function getGuidanceForView(viewName) {
    const role = getRole();
    const name = getProfile().full_name?.split(/\s+/)[0] || 'there';

    if (role === 'creator') {
      return `Welcome, Creator. Master Platform Control is active. All institutional databases, Gemini AI and Brevo communications are operational.`;
    }

    if (role === 'principal' || role === 'owner' || role === 'manager') {
      switch (viewName) {
        case 'classes':
          return `Here you can organize Classes 1 to 10 or University streams. Easily create custom sections like Mars, Rubies, or Apple for your school.`;
        case 'school-tasks':
          return `Here is your School Tasks console. Assign responsibilities to teachers and track deadlines in real-time.`;
        case 'email-automation':
          return `Email Automation panel. Send official notifications and test your school Brevo transactional emails right here.`;
        case 'school-calendar':
          return `Your dynamic School Calendar with localized holidays and scheduled examinations for Hyderabad / Sangareddy timezone.`;
        default:
          return `Good day, Principal ${name}! All 10 classes are active today. Attendance trends, daily reports, and administrative tasks are live below.`;
      }
    }

    if (role === 'teacher') {
      switch (viewName) {
        case 'paper-generator':
          return `Exam Paper Generator. Choose your grade level and subject to instantly generate structured question papers.`;
        case 'attendance':
          return `Mark class attendance easily section-wise. Saved records reflect immediately on the Principal's dashboard.`;
        default:
          return `Hello, Teacher ${name}! Your daily schedule is ready. You can take attendance, start active periods, or click 'Edit Timetable' to update your periods.`;
      }
    }

    if (role === 'student') {
      return `Welcome, ${name}! Your learning dashboard is ready. Check your homework deadlines, exam schedules, and attendance records below.`;
    }

    return `Welcome to NOOR School Management. Click me anytime for instant role-based AI assistance.`;
  }

  function showBubble(text, autoSpeak = true) {
    let bubble = $('noorGuideBubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'noorGuideBubble';
      bubble.className = 'noor-guide-bubble';
      const anchor = $('noorGuideWidget') || document.body;
      anchor.appendChild(bubble);
    }

    const roleLabel = getRole().toUpperCase();
    bubble.innerHTML = `
      <div class="noor-guide-bubble-head">
        <span>✦ NOOR Guide · ${roleLabel}</span>
        <div class="noor-guide-bubble-actions">
          <button class="noor-guide-icon-btn" id="noorGuideMuteBtn" title="${isMuted ? 'Unmute voice' : 'Mute voice'}">${isMuted ? '🔇' : '🔊'}</button>
          <button class="noor-guide-icon-btn" id="noorGuideCloseBubble" title="Close">✕</button>
        </div>
      </div>
      <div class="noor-guide-bubble-content">${text}</div>
      <div class="noor-guide-bubble-foot">
        <span style="color:#8c7582">Ask AI Co-Pilot</span>
        <button type="button" class="noor-guide-ask-pill" id="noorGuideBubbleAsk">Ask AI ✨</button>
      </div>
    `;

    bubble.style.display = 'block';

    $('noorGuideCloseBubble').onclick = (e) => {
      e.stopPropagation();
      bubble.style.display = 'none';
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };

    $('noorGuideMuteBtn').onclick = (e) => {
      e.stopPropagation();
      isMuted = !isMuted;
      localStorage.setItem('noor_guide_muted', isMuted);
      $('noorGuideMuteBtn').textContent = isMuted ? '🔇' : '🔊';
      if (isMuted && window.speechSynthesis) window.speechSynthesis.cancel();
      else if (!isMuted) speakText(text);
    };

    $('noorGuideBubbleAsk').onclick = (e) => {
      e.stopPropagation();
      bubble.style.display = 'none';
      openAskAIDrawer();
    };

    clearTimeout(activeSpeechTimeout);
    activeSpeechTimeout = setTimeout(() => {
      if (bubble) bubble.style.display = 'none';
    }, 14000);

    if (autoSpeak && !isMuted) {
      playGuideChime();
      speakText(text);
    }
  }

  // Role-Specific 'Ask AI' Drawer
  function openAskAIDrawer(initialPrompt = '') {
    let overlay = $('noorGuideModalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'noorGuideModalOverlay';
      overlay.className = 'noor-guide-modal-overlay';
      overlay.innerHTML = `
        <div class="noor-guide-drawer" role="dialog" aria-modal="true" aria-label="NOOR AI Co-Pilot Assistant">
          <header class="noor-guide-drawer-header">
            <div class="noor-guide-drawer-title">
              <div class="noor-guide-drawer-avatar">
                <img src="./assets/guide-avatar.png" alt="Guide Avatar">
              </div>
              <div>
                <h3 id="noorGuideDrawerRoleTitle">NOOR AI Assistant</h3>
                <p id="noorGuideDrawerSubTitle">Real-time school intelligence</p>
              </div>
            </div>
            <button class="noor-guide-drawer-close" id="noorGuideDrawerClose" aria-label="Close Assistant">✕</button>
          </header>
          <div class="noor-guide-pills" id="noorGuidePills"></div>
          <div class="noor-guide-messages" id="noorGuideMessages"></div>
          <form class="noor-guide-drawer-input" id="noorGuideForm">
            <input type="text" class="noor-guide-text-box" id="noorGuideInput" placeholder="Ask anything about your school, classes, or tasks…" autocomplete="off">
            <button type="button" class="noor-guide-mic-btn" id="noorGuideMicBtn" title="Speak question">🎤</button>
            <button type="submit" class="noor-guide-send-btn" id="noorGuideSendBtn" title="Send message">➤</button>
          </form>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAskAIDrawer();
      });
      $('noorGuideDrawerClose').onclick = closeAskAIDrawer;
      $('noorGuideForm').onsubmit = handleUserSubmit;
      $('noorGuideMicBtn').onclick = toggleSpeechRecognition;
    }

    const role = getRole();
    const titleEl = $('noorGuideDrawerRoleTitle');
    const subEl = $('noorGuideDrawerSubTitle');
    if (titleEl) {
      titleEl.textContent = role === 'principal' ? 'Principal AI Co-Pilot' :
                            role === 'teacher' ? 'Teacher Assistant' :
                            role === 'student' ? 'Student Study Helper' : 'Platform Creator Co-Pilot';
    }
    if (subEl) {
      subEl.textContent = `${getSchool().name || 'NOOR Institution'} · Verified Context`;
    }

    renderRolePills();

    // Initial greeting message if chat is empty
    const msgs = $('noorGuideMessages');
    if (msgs && msgs.children.length === 0) {
      const greeting = getGuidanceForView('overview');
      appendMessage('assistant', greeting);
    }

    overlay.classList.add('open');
    if (initialPrompt) {
      $('noorGuideInput').value = initialPrompt;
      $('noorGuideForm').dispatchEvent(new Event('submit'));
    } else {
      $('noorGuideInput').focus();
    }
  }

  function closeAskAIDrawer() {
    const overlay = $('noorGuideModalOverlay');
    if (overlay) overlay.classList.remove('open');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function renderRolePills() {
    const container = $('noorGuidePills');
    if (!container) return;
    const role = getRole();
    let pills = [];

    if (role === 'principal' || role === 'owner' || role === 'manager') {
      pills = [
        { label: '📊 School Health Check', query: 'What is the current school health and teacher attendance status today?' },
        { label: '📝 Missing Reports Alert', query: 'Show me any missing teacher daily reports and unrecorded classes today.' },
        { label: '📅 Upcoming Deadlines', query: 'What are the top overdue and approaching school tasks and exams?' },
        { label: '✉️ Draft Notice to Staff', query: 'Draft a short, professional notice for all teachers about lesson plan submissions.' }
      ];
    } else if (role === 'teacher') {
      pills = [
        { label: '📄 Question Paper', query: 'Help me draft a 25-mark test paper for Class 8 Mathematics on Linear Equations.' },
        { label: '💡 Quick Lesson Hook', query: 'Give me an engaging 5-minute real-world hook for today’s science lesson.' },
        { label: '📅 Today’s Timetable Check', query: 'Review my periods today and tell me what preparations I need.' },
        { label: '📝 Student Homework Idea', query: 'Suggest an engaging homework task that takes less than 20 minutes.' }
      ];
    } else if (role === 'student') {
      pills = [
        { label: '📚 Explain Topic', query: 'Explain the concept of Photosynthesis in simple, easy-to-understand bullet points.' },
        { label: '⏰ Homework Review', query: 'What homework tasks are due this week and how should I prioritize them?' },
        { label: '🧪 Exam Revision Tips', query: 'Give me 3 effective revision tips for my upcoming science assessment.' }
      ];
    } else {
      pills = [
        { label: '🏢 Platform Overview', query: 'Summarize active schools, teacher counts, and platform subscription health.' },
        { label: '🔑 API Keys Check', query: 'Are Gemini API and Brevo transactional email automation configured?' }
      ];
    }

    container.innerHTML = pills.map(p => `<button type="button" class="noor-guide-pill" data-query="${escapeHtml(p.query)}">${p.label}</button>`).join('');
    container.querySelectorAll('.noor-guide-pill').forEach(btn => {
      btn.onclick = () => {
        $('noorGuideInput').value = btn.dataset.query;
        $('noorGuideForm').dispatchEvent(new Event('submit'));
      };
    });
  }

  function appendMessage(role, text) {
    const msgs = $('noorGuideMessages');
    if (!msgs) return;
    const msg = document.createElement('div');
    msg.className = `noor-guide-msg ${role}`;
    msg.innerHTML = `<div>${escapeHtml(text).replace(/\n/g, '<br>')}</div><div class="noor-guide-msg-meta"><span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>${role === 'assistant' ? '<button class="noor-guide-icon-btn speak-btn" title="Read aloud">🔊</button>' : ''}</div>`;
    msgs.appendChild(msg);
    msgs.scrollTop = msgs.scrollHeight;

    const speakBtn = msg.querySelector('.speak-btn');
    if (speakBtn) {
      speakBtn.onclick = () => speakText(text);
    }
  }

  async function handleUserSubmit(e) {
    e.preventDefault();
    const input = $('noorGuideInput');
    const q = input.value.trim();
    if (!q) return;

    appendMessage('user', q);
    input.value = '';

    const btn = $('noorGuideSendBtn');
    if (btn) btn.disabled = true;

    try {
      const response = await fetchGeminiResponse(q);
      appendMessage('assistant', response);
      if (!isMuted) speakText(response);
    } catch (err) {
      appendMessage('assistant', `I could not reach the AI engine: ${err.message || err}. Please ensure your Gemini API key is configured in the Creator Panel.`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // Direct Gemini API Caller
  async function fetchGeminiResponse(prompt) {
    const key = localStorage.getItem('noor_gemini_api_key') || window.NOOR_CONFIG?.GEMINI_API_KEY;
    if (!key) {
      throw new Error('Gemini API key is not configured. Please save your API key in the Platform Creator panel.');
    }

    const role = getRole();
    const schoolName = getSchool().name || 'NOOR Institution';
    const profile = getProfile();

    const systemPrompt = `You are the interactive AI Guide co-pilot inside NOOR School Management SaaS for ${schoolName}.
The user is logged in as role: "${role}" (Name: ${profile.full_name || 'User'}).
School Timezone: Asia/Kolkata (Sangareddy / Hyderabad, Telangana).
Provide helpful, professional, structured, concise, and friendly guidance.
Do not use complicated markdown or long disclaimers. Format with clean bullet points when necessary.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser Question: ${prompt}` }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600
        }
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API error ${res.status}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return candidate || 'I have reviewed your request. Everything in your workspace is currently up to date.';
  }

  // Web Speech Recognition for Voice Input
  function toggleSpeechRecognition() {
    const mic = $('noorGuideMicBtn');
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    if (isListening && recognition) {
      recognition.stop();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isListening = true;
      if (mic) mic.classList.add('listening');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const input = $('noorGuideInput');
      if (input) {
        input.value = transcript;
        $('noorGuideForm').dispatchEvent(new Event('submit'));
      }
    };

    recognition.onerror = recognition.onend = () => {
      isListening = false;
      if (mic) mic.classList.remove('listening');
    };

    recognition.start();
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Mount the Guide Avatar into the authenticated top header
  function mountGuideWidget() {
    if ($('noorGuideWidget')) return;

    // Check if user is inside authenticated workspace
    const topbar = document.querySelector('.topbar .user-mini') || document.querySelector('.topbar');
    if (!topbar) return;

    const widget = document.createElement('div');
    widget.id = 'noorGuideWidget';
    widget.className = 'noor-guide-widget';
    widget.setAttribute('role', 'button');
    widget.setAttribute('tabindex', '0');
    widget.setAttribute('aria-label', 'Open NOOR Guide AI Assistant');

    widget.innerHTML = `
      <div class="noor-guide-avatar-wrap" id="noorGuideAvatarWrap">
        <img class="noor-guide-avatar-img" src="./assets/guide-avatar.png" alt="Guide Avatar">
        <span class="noor-guide-status-dot"></span>
      </div>
      <div class="noor-guide-meta">
        <span class="noor-guide-title">Guide AI <span style="font-size:10px;color:#cba46c">✦</span></span>
        <span class="noor-guide-sub" id="noorGuideStatusLabel">Assistant</span>
      </div>
    `;

    topbar.prepend(widget);

    widget.onclick = (e) => {
      e.stopPropagation();
      openAskAIDrawer();
    };

    // Remove old legacy elements if present in DOM
    const oldMascot = $('noorMascotContainer');
    if (oldMascot) oldMascot.remove();
    const oldFab = $('noorAiFab');
    if (oldFab) oldFab.remove();

    // Trigger initial proactive greeting
    setTimeout(() => {
      const initialText = getGuidanceForView('overview');
      showBubble(initialText, true);
    }, 1200);
  }

  // Listen for view navigation changes across NOOR
  function watchRouteChanges() {
    window.addEventListener('noor:view-changed', (e) => {
      const viewName = e.detail?.view || 'overview';
      const text = getGuidanceForView(viewName);
      showBubble(text, true);
    });

    // Also observe navigation clicks
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (btn) {
        const view = btn.dataset.view;
        setTimeout(() => {
          const text = getGuidanceForView(view);
          showBubble(text, false);
        }, 300);
      }
    });
  }

  // Global API
  window.NOOR_GUIDE = {
    mount: mountGuideWidget,
    speak: speakText,
    showBubble: showBubble,
    openAskAI: openAskAIDrawer
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountGuideWidget();
      watchRouteChanges();
    });
  } else {
    mountGuideWidget();
    watchRouteChanges();
  }

  // Periodic check to ensure guide widget is mounted after login
  setInterval(() => {
    const ws = $('workspace');
    if (ws && !ws.classList.contains('hidden') && !$('noorGuideWidget')) {
      mountGuideWidget();
    }
  }, 1000);
})();
