/**
 * NOOR Management - Interactive Animated Cartoon Mascot ("نور Noorani")
 * Features:
 * - Expressive 2D Cartoon SVG Avatar with Blinking Eyes & Waving Hand
 * - Real-time Lip-Sync Animation synced with Web Speech Synthesis
 * - Harmonic Web Audio Chime Sound Effects
 * - Location-Aware Greetings (Sangareddy / Hyderabad, Telangana)
 * - Seamless integration with AI Co-Pilot & API Key Management
 */

(function () {
  'use strict';

  let lipSyncTimer = null;
  let isSpeaking = false;

  // Harmonic chime chord using Web Audio API
  function playAudioChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      // Soft ascending major triad (C5 - E5 - G5 - C6)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.09, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.6);
      });
    } catch (e) {
      console.warn('Audio chime note:', e);
    }
  }

  // Lip-sync frames for SVG mouth path
  const MOUTH_SHAPES = {
    rest: 'M 40 68 Q 50 78 60 68',
    openO: 'M 42 68 Q 50 84 58 68 Q 50 88 42 68',
    wideTalk: 'M 38 67 Q 50 81 62 67 Q 50 74 38 67',
    narrowTalk: 'M 43 69 Q 50 77 57 69 Q 50 72 43 69',
  };

  function startLipSync() {
    const mouth = document.getElementById('mascotMouthPath');
    const avatar = document.getElementById('mascotAvatarGroup');
    const visualizer = document.getElementById('mascotVisualizer');
    if (!mouth) return;

    avatar?.classList.add('mascot-speaking-bob');
    visualizer?.classList.add('active');

    const frames = [MOUTH_SHAPES.openO, MOUTH_SHAPES.wideTalk, MOUTH_SHAPES.narrowTalk, MOUTH_SHAPES.rest];
    let fIdx = 0;
    clearInterval(lipSyncTimer);
    lipSyncTimer = setInterval(() => {
      fIdx = (fIdx + 1) % frames.length;
      mouth.setAttribute('d', frames[fIdx]);
    }, 125);
  }

  function stopLipSync() {
    clearInterval(lipSyncTimer);
    const mouth = document.getElementById('mascotMouthPath');
    const avatar = document.getElementById('mascotAvatarGroup');
    const visualizer = document.getElementById('mascotVisualizer');
    if (mouth) mouth.setAttribute('d', MOUTH_SHAPES.rest);
    avatar?.classList.remove('mascot-speaking-bob');
    visualizer?.classList.remove('active');
  }

  // Text-to-speech with localized speech synthesis
  function speakMessage(text, onComplete) {
    if (!('speechSynthesis' in window)) {
      onComplete?.();
      return;
    }

    window.speechSynthesis.cancel();
    playAudioChime();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-IN';
    utterance.pitch = 1.15;
    utterance.rate = 1.0;

    utterance.onstart = () => {
      isSpeaking = true;
      startLipSync();
    };

    utterance.onend = () => {
      isSpeaking = false;
      stopLipSync();
      onComplete?.();
    };

    utterance.onerror = () => {
      isSpeaking = false;
      stopLipSync();
      onComplete?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  function getSchoolLocation() {
    const sch = window.NOOR_AI_APP?.school || window.currentSchool || {};
    return sch.address || sch.location || 'Sangareddy / Hyderabad, Telangana';
  }

  function initMascot() {
    if (document.getElementById('noorMascotContainer')) return;

    const container = document.createElement('div');
    container.id = 'noorMascotContainer';

    container.innerHTML = `
      <!-- Speech Bubble -->
      <div class="noor-mascot-speech-bubble" id="mascotBubble">
        <div class="noor-mascot-location-tag" id="mascotLocTag">
          📍 <span id="mascotLocText">Sangareddy / Hyderabad (Asia/Kolkata)</span>
        </div>
        <div id="mascotSpeechText" style="font-weight:600;color:#2b111e">
          Assalamu Alaikum! Hi, hello! I am <b>Noor (نور)</b>, your AI learning mascot.
        </div>
        <div class="noor-audio-visualizer" id="mascotVisualizer">
          <span class="noor-audio-bar"></span>
          <span class="noor-audio-bar"></span>
          <span class="noor-audio-bar"></span>
          <span class="noor-audio-bar"></span>
        </div>
        <div class="noor-bubble-actions">
          <button type="button" class="noor-bubble-btn" id="mascotBtnHello">👋 Say Hello</button>
          <button type="button" class="noor-bubble-btn" id="mascotBtnAsk">💬 Ask AI</button>
          <button type="button" class="noor-bubble-btn" id="mascotBtnKeys">⚙️ API Setup</button>
          <button type="button" class="noor-bubble-btn" id="mascotBtnCloseBubble" style="color:#786671;border-color:#e5d5df">✕ Close</button>
        </div>
      </div>

      <!-- Mascot Character Button -->
      <div class="noor-mascot-card" id="mascotCard" title="Click to interact with Noor AI Mascot">
        <svg class="noor-mascot-avatar-svg" viewBox="0 0 100 100" id="mascotSvg">
          <g id="mascotAvatarGroup">
            <!-- Glow circle background -->
            <circle cx="50" cy="50" r="44" fill="#faeaf2" stroke="#ebd4e0" stroke-width="2" />
            
            <!-- Character Head -->
            <ellipse cx="50" cy="54" rx="30" ry="28" fill="#ffe4d6" stroke="#f0bba5" stroke-width="2" />
            
            <!-- Scholarly / Wisdom Cap -->
            <path d="M 50 16 L 82 28 L 50 38 L 18 28 Z" fill="#71354f" stroke="#4a1d33" stroke-width="2" />
            <rect x="42" y="32" width="16" height="8" rx="3" fill="#57203b" />
            <!-- Gold Tassel -->
            <circle cx="50" cy="27" r="3" fill="#fbbf24" />
            <path d="M 50 27 Q 66 32 68 44" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" />
            <circle cx="68" cy="45" r="3" fill="#f59e0b" />

            <!-- Rosy Cheeks -->
            <ellipse cx="32" cy="62" rx="5" ry="3.5" fill="#fca5a5" opacity="0.65" />
            <ellipse cx="68" cy="62" rx="5" ry="3.5" fill="#fca5a5" opacity="0.65" />

            <!-- Expressive Blinking Eyes -->
            <g class="mascot-eye">
              <ellipse cx="37" cy="52" rx="4.5" ry="5.5" fill="#3b1526" />
              <circle cx="35.5" cy="50" r="1.8" fill="#ffffff" />
            </g>
            <g class="mascot-eye">
              <ellipse cx="63" cy="52" rx="4.5" ry="5.5" fill="#3b1526" />
              <circle cx="61.5" cy="50" r="1.8" fill="#ffffff" />
            </g>

            <!-- Friendly Eyebrows -->
            <path d="M 32 44 Q 38 41 43 45" fill="none" stroke="#71354f" stroke-width="2" stroke-linecap="round" />
            <path d="M 57 45 Q 62 41 68 44" fill="none" stroke="#71354f" stroke-width="2" stroke-linecap="round" />

            <!-- Cute Nose -->
            <circle cx="50" cy="59" r="1.8" fill="#e09d84" />

            <!-- Dynamic Lip-Sync Mouth -->
            <path id="mascotMouthPath" d="M 40 68 Q 50 78 60 68" fill="#dc2626" stroke="#991b1b" stroke-width="2" stroke-linecap="round" />

            <!-- Waving Hand -->
            <g id="mascotHand" class="mascot-hand-waving">
              <ellipse cx="20" cy="66" rx="6" ry="5" fill="#ffe4d6" stroke="#f0bba5" stroke-width="1.8" />
              <circle cx="16" cy="63" r="2.5" fill="#ffe4d6" stroke="#f0bba5" stroke-width="1.2" />
            </g>
          </g>
        </svg>

        <div class="noor-mascot-label">
          <span class="noor-mascot-name">نور Noorani</span>
          <span class="noor-mascot-sub">Interactive Mascot</span>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    bindMascotEvents();
  }

  function bindMascotEvents() {
    const card = document.getElementById('mascotCard');
    const bubble = document.getElementById('mascotBubble');
    const btnHello = document.getElementById('mascotBtnHello');
    const btnAsk = document.getElementById('mascotBtnAsk');
    const btnKeys = document.getElementById('mascotBtnKeys');
    const btnClose = document.getElementById('mascotBtnCloseBubble');
    const speechText = document.getElementById('mascotSpeechText');
    const locText = document.getElementById('mascotLocText');

    if (locText) {
      locText.textContent = getSchoolLocation() + ' (Asia/Kolkata)';
    }

    // Toggle speech bubble on card click
    card?.addEventListener('click', () => {
      const isActive = bubble?.classList.contains('active');
      if (isActive) {
        bubble?.classList.remove('active');
        window.speechSynthesis?.cancel();
        stopLipSync();
      } else {
        triggerGreeting();
      }
    });

    btnHello?.addEventListener('click', () => {
      triggerGreeting();
    });

    btnAsk?.addEventListener('click', () => {
      window.NOOR_AI_COPILOT?.open?.();
      bubble?.classList.remove('active');
    });

    btnKeys?.addEventListener('click', () => {
      window.NOOR_AI_COPILOT?.open?.();
      document.querySelector('.noor-ai-tab[data-tab="settings"]')?.click();
      bubble?.classList.remove('active');
    });

    btnClose?.addEventListener('click', () => {
      bubble?.classList.remove('active');
      window.speechSynthesis?.cancel();
      stopLipSync();
    });
  }

  function triggerGreeting() {
    const bubble = document.getElementById('mascotBubble');
    const speechText = document.getElementById('mascotSpeechText');
    const loc = getSchoolLocation();

    bubble?.classList.add('active');

    const greetingMessage = `Assalamu Alaikum! Hi, hello! I am Noor, your AI learning co-pilot for NOOR Management in ${loc}. Click me anytime to ask questions, check attendance, or explore lessons!`;

    if (speechText) {
      speechText.innerHTML = `Assalamu Alaikum! <b>Hi, hello!</b> I am <b>Noor (نور)</b>, your AI co-pilot in <i>${escapeHtml(loc)}</i>. How can I help you today?`;
    }

    speakMessage(greetingMessage);
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Export globally and init
  window.NOOR_MASCOT = {
    greet: triggerGreeting,
    speak: speakMessage,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMascot);
  } else {
    initMascot();
  }
})();
