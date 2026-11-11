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

    clearTimeout(activeSpeechTimeout);
    activeSpeechTimeout = setTimeout(() => {
      if (bubble) bubble.style.display = 'none';
    }, 14000);

    if (autoSpeak && !isMuted) {
      playGuideChime();
      speakText(text);
    }
  }

  function openAskAIDrawer() { showBubble(getGuidanceForView('overview')); }

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
    widget.setAttribute('aria-label', 'Open NOOR Guide');

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
