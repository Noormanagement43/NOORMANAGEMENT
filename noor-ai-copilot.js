/**
 * NOOR Management - AI Intelligence Co-Pilot
 * Interactive Co-pilot supporting:
 * - Real-time Ask AI chat assistant
 * - Web Speech API Voice Recognition
 * - Interactive Live School Insights
 * - 2D Educational Cartoon & Visual Media Concept Generator
 * - Browser-based secure Gemini API Key configuration
 */

(function () {
  'use strict';

  function getGeminiKey() {
    return (
      localStorage.getItem('noor_gemini_api_key') ||
      window.NOOR_CONFIG?.GEMINI_API_KEY ||
      ''
    );
  }

  function setGeminiKey(key) {
    if (key) {
      localStorage.setItem('noor_gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('noor_gemini_api_key');
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Mount UI elements
  function initCoPilot() {
    if (document.getElementById('noorAiFab')) return;

    // 1. Create Floating Action Button
    const fab = document.createElement('button');
    fab.id = 'noorAiFab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Open NOOR AI Co-Pilot');
    fab.innerHTML = `
      <span class="fab-sparkle">✨</span>
      <span>Ask AI</span>
      <span class="fab-badge">نور Co-Pilot</span>
    `;
    document.body.appendChild(fab);

    // 2. Create Modal Overlay
    const overlay = document.createElement('div');
    overlay.id = 'noorAiModalOverlay';
    overlay.innerHTML = `
      <div class="noor-ai-modal" role="dialog" aria-modal="true" aria-labelledby="noorAiModalTitle">
        <header class="noor-ai-header">
          <div class="noor-ai-header-title">
            <span style="font-size:22px">✨</span>
            <div>
              <h2 id="noorAiModalTitle">NOOR AI Co-Pilot (نور)</h2>
              <p>Powered by Gemini 1.5 · Real-time Academic & School Intelligence</p>
            </div>
          </div>
          <button type="button" class="noor-ai-close-btn" id="noorAiCloseBtn" aria-label="Close modal">✕</button>
        </header>

        <nav class="noor-ai-tabs">
          <button type="button" class="noor-ai-tab active" data-tab="chat">💬 Ask AI & Voice</button>
          <button type="button" class="noor-ai-tab" data-tab="insights">📊 Live Insights</button>
          <button type="button" class="noor-ai-tab" data-tab="cartoon">🎨 Cartoon & Media</button>
          <button type="button" class="noor-ai-tab" data-tab="settings">⚙️ Gemini Key Setup</button>
        </nav>

        <main class="noor-ai-body">
          <!-- TAB 1: CHAT & VOICE -->
          <div class="noor-ai-tab-panel active" id="noorTabChat">
            <div class="noor-chips-row">
              <button type="button" class="noor-chip-btn" data-chip="How do I record today's attendance for my classes?">📋 How to take attendance?</button>
              <button type="button" class="noor-chip-btn" data-chip="Generate a balanced 5-day science lesson plan for Class 7">💡 5-Day Science Plan</button>
              <button type="button" class="noor-chip-btn" data-chip="Suggest 3 actionable ways to improve secondary school attendance trends.">📈 Improve Attendance</button>
              <button type="button" class="noor-chip-btn" data-chip="What are the essential topics for Class 10 board exam preparation?">📝 Class 10 Exam Tips</button>
            </div>

            <div class="noor-chat-container">
              <div class="noor-chat-messages" id="noorChatMessages">
                <div class="noor-chat-bubble assistant">
                  Assalamu Alaikum! I am your <b>NOOR AI Co-Pilot (نور)</b>. How can I help you today? You can type your question or click the 🎤 mic button to speak in English, Urdu, or Hindi.
                </div>
              </div>

              <div class="noor-chat-input-bar">
                <input type="text" id="noorChatInput" placeholder="Ask anything about classes, syllabus, students or schedules..." />
                <button type="button" class="noor-icon-btn" id="noorVoiceBtn" title="Voice dictation (Click to speak)">🎤</button>
                <button type="button" class="noor-send-btn" id="noorSendBtn">Send ➤</button>
              </div>
              <div id="noorVoiceStatus" style="font-size:11px;color:#7d5770;margin-top:4px;min-height:16px"></div>
            </div>
          </div>

          <!-- TAB 2: LIVE INSIGHTS -->
          <div class="noor-ai-tab-panel" id="noorTabInsights">
            <div class="noor-ai-card">
              <h3>⚡ Dynamic School Health & Academic Insights</h3>
              <p>Analyze live attendance records, active class rosters, and syllabus trends to produce immediate administrative recommendations.</p>
              <button type="button" class="noor-send-btn" id="noorBtnGenerateInsights" style="height:38px;padding:0 20px">⚡ Generate Live Insights Now</button>
            </div>
            <div id="noorInsightsResult"></div>
          </div>

          <!-- TAB 3: CARTOON & MEDIA -->
          <div class="noor-ai-tab-panel" id="noorTabCartoon">
            <div class="noor-ai-card">
              <h3>🎨 Educational Cartoon & Visual Concept Generator</h3>
              <p>Create playful, friendly 2D educational cartoon scenarios and prompts for students to make complex concepts intuitive and memorable.</p>
              
              <div style="display:flex;flex-direction:column;gap:10px">
                <div>
                  <label style="display:block;font-size:12px;font-weight:750;color:#4a1d33;margin-bottom:4px">Lesson Topic</label>
                  <input type="text" id="noorCartoonTopic" placeholder="e.g. Water Cycle & Cloud Formation, Solar System, Fractions" style="width:100%;padding:8px 12px;border:1px solid #ebd7e2;border-radius:10px;font-size:13px" value="Water Cycle & Cloud Formation" />
                </div>

                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  <div style="flex:1;min-width:180px">
                    <label style="display:block;font-size:12px;font-weight:750;color:#4a1d33;margin-bottom:4px">Target Grade Level</label>
                    <select id="noorCartoonGrade" style="width:100%;padding:8px 10px;border:1px solid #ebd7e2;border-radius:10px;font-size:13px">
                      <option value="Primary (Classes 1-5)">Primary School (Classes 1 to 5)</option>
                      <option value="Middle School (Classes 6-8)">Middle School (Classes 6 to 8)</option>
                      <option value="Secondary (Classes 9-10)">Secondary School (Classes 9 to 10)</option>
                    </select>
                  </div>
                  <div style="flex:1;min-width:180px">
                    <label style="display:block;font-size:12px;font-weight:750;color:#4a1d33;margin-bottom:4px">Illustration Art Style</label>
                    <select id="noorCartoonStyle" style="width:100%;padding:8px 10px;border:1px solid #ebd7e2;border-radius:10px;font-size:13px">
                      <option value="Colorful 2D educational storybook cartoon style with cute expressive characters">2D Storybook Cartoon</option>
                      <option value="Playful comic strip with friendly animal guides and speech balloons">Comic Strip with Characters</option>
                      <option value="Vibrant educational diagram with whimsical animated elements">Animated Educational Diagram</option>
                    </select>
                  </div>
                </div>

                <button type="button" class="noor-send-btn" id="noorBtnGenerateCartoon" style="height:38px;margin-top:6px">✨ Generate Cartoon Storyboard Prompt</button>
              </div>
            </div>
            <div id="noorCartoonResult"></div>
          </div>

          <!-- TAB 4: SETTINGS -->
          <div class="noor-ai-tab-panel" id="noorTabSettings">
            <div class="noor-ai-card">
              <h3>🔑 API Keys & Email Automation Setup</h3>
              <p>Configure your Gemini AI and Brevo Transactional Email keys in your browser's private storage. This keeps them completely private and <b>prevents GitHub push protection rejections</b>.</p>
              
              <!-- Gemini AI Section -->
              <div style="margin:14px 0;padding:12px;background:#fdf9fb;border:1px solid #f1e2ea;border-radius:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label style="font-size:12px;font-weight:800;color:#5a233c">✨ Google Gemini API Key</label>
                  <span id="noorGeminiBadge" style="font-size:10px;font-weight:750;color:#059669">Active</span>
                </div>
                <div style="display:flex;gap:8px">
                  <input type="password" id="noorApiKeyInput" placeholder="Enter Gemini key (e.g. AQ.Ab8RN6...)" style="flex:1;padding:8px 12px;border:1px solid #ebd7e2;border-radius:10px;font-size:13px" />
                  <button type="button" class="noor-send-btn" id="noorBtnToggleKey" style="padding:0 12px;background:#e2cbd8;color:#5a233c">Show</button>
                </div>
                <div style="display:flex;gap:8px;margin-top:8px">
                  <button type="button" class="noor-send-btn" id="noorBtnSaveKey" style="padding:0 14px;font-size:11px">💾 Save Gemini Key</button>
                  <button type="button" class="noor-send-btn" id="noorBtnTestGemini" style="background:#059669;padding:0 14px;font-size:11px">⚡ Test Gemini AI</button>
                </div>
                <div id="noorGeminiTestResult" style="margin-top:6px;font-size:11px"></div>
              </div>

              <!-- Brevo Email Automation Section -->
              <div style="margin:14px 0;padding:12px;background:#fdf9fb;border:1px solid #f1e2ea;border-radius:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <label style="font-size:12px;font-weight:800;color:#5a233c">✉️ Brevo (Sendinblue) Transactional SMTP Key</label>
                  <span id="noorBrevoBadge" style="font-size:10px;font-weight:750;color:#059669">Configured</span>
                </div>
                <input type="password" id="noorBrevoKeyInput" placeholder="Enter Brevo SMTP Key" style="width:100%;padding:8px 12px;border:1px solid #ebd7e2;border-radius:10px;font-size:13px;margin-bottom:8px" />
                <div style="display:flex;gap:8px;margin-bottom:8px">
                  <input type="email" id="noorSenderEmailInput" placeholder="Sender email (default: annoorhub786@gmail.com)" value="annoorhub786@gmail.com" style="flex:1;padding:8px 12px;border:1px solid #ebd7e2;border-radius:10px;font-size:12px" />
                </div>
                <div style="display:flex;gap:8px">
                  <button type="button" class="noor-send-btn" id="noorBtnSaveBrevo" style="padding:0 14px;font-size:11px">💾 Save Brevo Key</button>
                  <button type="button" class="noor-send-btn" id="noorBtnTestBrevo" style="background:#be185d;padding:0 14px;font-size:11px">✉️ Send Test Email via Brevo</button>
                </div>
                <div id="noorBrevoTestResult" style="margin-top:6px;font-size:11px"></div>
              </div>

              <!-- Quick 1-Click Setup -->
              <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="noor-send-btn" id="noorBtnPresetKeys" style="background:linear-gradient(135deg,#71354f,#4a1d33);padding:0 16px;font-size:11px">⚡ Load My Provided Keys (1-Click)</button>
                <button type="button" class="noor-send-btn" id="noorBtnClearAllKeys" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;padding:0 14px;font-size:11px">Clear Saved Keys</button>
              </div>

              <div style="margin-top:14px;padding:10px 12px;background:#fffdf6;border:1px solid #fde68a;border-radius:10px;font-size:11px;color:#92400e;line-height:1.5">
                🔒 <b>Privacy Guarantee:</b> Keys saved here are stored strictly inside your browser's private storage. They enable direct real-time communication with Gemini and Brevo without ever exposing secrets to your GitHub repository.
              </div>
            </div>
          </div>
        </main>
      </div>
    `;
    document.body.appendChild(overlay);

    bindEvents();
    updateKeyStatusUi();
  }

  function bindEvents() {
    const fab = document.getElementById('noorAiFab');
    const overlay = document.getElementById('noorAiModalOverlay');
    const closeBtn = document.getElementById('noorAiCloseBtn');

    fab?.addEventListener('click', () => {
      overlay?.classList.add('active');
      document.getElementById('noorChatInput')?.focus();
    });

    closeBtn?.addEventListener('click', () => {
      overlay?.classList.remove('active');
    });

    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });

    // Tab navigation
    document.querySelectorAll('.noor-ai-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.noor-ai-tab').forEach((t) => t.classList.remove('active'));
        document.querySelectorAll('.noor-ai-tab-panel').forEach((p) => p.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        const panel = document.getElementById(
          target === 'chat'
            ? 'noorTabChat'
            : target === 'insights'
            ? 'noorTabInsights'
            : target === 'cartoon'
            ? 'noorTabCartoon'
            : 'noorTabSettings'
        );
        panel?.classList.add('active');
      });
    });

    // Quick chips
    document.querySelectorAll('.noor-chip-btn').forEach((chip) => {
      chip.addEventListener('click', () => {
        const input = document.getElementById('noorChatInput');
        if (input) {
          input.value = chip.dataset.chip || '';
          handleSendMessage();
        }
      });
    });

    // Send button & Enter key
    document.getElementById('noorSendBtn')?.addEventListener('click', handleSendMessage);
    document.getElementById('noorChatInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
      }
    });

    // Voice recognition
    setupVoiceRecognition();

    // Insights button
    document.getElementById('noorBtnGenerateInsights')?.addEventListener('click', handleGenerateInsights);

    // Cartoon button
    document.getElementById('noorBtnGenerateCartoon')?.addEventListener('click', handleGenerateCartoon);

    // Settings buttons
    const keyInput = document.getElementById('noorApiKeyInput');
    const toggleBtn = document.getElementById('noorBtnToggleKey');
    const saveBtn = document.getElementById('noorBtnSaveKey');
    const clearBtn = document.getElementById('noorBtnClearKey');

    toggleBtn?.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = 'Hide';
      } else {
        keyInput.type = 'password';
        toggleBtn.textContent = 'Show';
      }
    });

    saveBtn?.addEventListener('click', () => {
      const val = keyInput?.value?.trim();
      if (!val) { alert('Please enter a Gemini API key.'); return; }
      setGeminiKey(val);
      updateKeyStatusUi();
      alert('Gemini API key saved in browser storage!');
    });

    document.getElementById('noorBtnTestGemini')?.addEventListener('click', async () => {
      const resEl = document.getElementById('noorGeminiTestResult');
      if (resEl) resEl.innerHTML = '<span style="color:#6366f1">Testing Gemini API connection...</span>';
      try {
        const reply = await callGemini('Say "NOOR AI connected successfully!" in 5 words.');
        if (resEl) resEl.innerHTML = '<span style="color:#059669">✓ Gemini API Connected: ' + escapeHtml(reply) + '</span>';
      } catch (err) {
        if (resEl) resEl.innerHTML = '<span style="color:#dc2626">✗ Connection failed: ' + escapeHtml(err.message) + '</span>';
      }
    });

    // Brevo handlers
    const brevoInput = document.getElementById('noorBrevoKeyInput');
    const senderInput = document.getElementById('noorSenderEmailInput');
    const savedBrevo = localStorage.getItem('noor_brevo_api_key') || '';
    const savedSender = localStorage.getItem('noor_sender_email') || 'annoorhub786@gmail.com';
    if (brevoInput && savedBrevo) brevoInput.value = savedBrevo;
    if (senderInput && savedSender) senderInput.value = savedSender;

    document.getElementById('noorBtnSaveBrevo')?.addEventListener('click', () => {
      const bKey = brevoInput?.value?.trim();
      const sEmail = senderInput?.value?.trim() || 'annoorhub786@gmail.com';
      if (bKey) localStorage.setItem('noor_brevo_api_key', bKey);
      localStorage.setItem('noor_sender_email', sEmail);
      alert('Brevo settings saved in browser storage!');
    });

    document.getElementById('noorBtnTestBrevo')?.addEventListener('click', async () => {
      const resEl = document.getElementById('noorBrevoTestResult');
      const bKey = brevoInput?.value?.trim() || localStorage.getItem('noor_brevo_api_key');
      const sEmail = senderInput?.value?.trim() || localStorage.getItem('noor_sender_email') || 'annoorhub786@gmail.com';
      if (!bKey) { alert('Please enter your Brevo API key first.'); return; }
      if (resEl) resEl.innerHTML = '<span style="color:#6366f1">Sending test email via Brevo...</span>';
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: { 'accept': 'application/json', 'api-key': bKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { name: 'NOOR Management (نور)', email: sEmail },
            to: [{ email: sEmail }],
            subject: 'NOOR Management - Brevo Email Automation Verification',
            htmlContent: '<h3>Assalamu Alaikum!</h3><p>Your Brevo email automation is running perfectly in NOOR Management SaaS.</p><p>Time: ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + '</p>'
          })
        });
        if (res.ok) {
          if (resEl) resEl.innerHTML = '<span style="color:#059669">✓ Test email delivered to ' + escapeHtml(sEmail) + '!</span>';
        } else {
          const errData = await res.json().catch(()=>({}));
          throw new Error(errData.message || 'Error ' + res.status);
        }
      } catch (err) {
        if (resEl) resEl.innerHTML = '<span style="color:#dc2626">✗ Email failed: ' + escapeHtml(err.message) + '</span>';
      }
    });

    // 1-Click Setup: paste from clipboard or prompt
    document.getElementById('noorBtnPresetKeys')?.addEventListener('click', async () => {
      let clip = '';
      try { clip = await navigator.clipboard?.readText?.() || ''; } catch {}
      const gKey = prompt('Paste your Gemini API Key:', clip.startsWith('AQ.') ? clip : (getGeminiKey() || ''));
      if (gKey && gKey.trim()) {
        setGeminiKey(gKey.trim());
        if (keyInput) keyInput.value = gKey.trim();
      }
      const bKey = prompt('Paste your Brevo SMTP API Key:', (localStorage.getItem('noor_brevo_api_key') || ''));
      if (bKey && bKey.trim()) {
        localStorage.setItem('noor_brevo_api_key', bKey.trim());
        if (brevoInput) brevoInput.value = bKey.trim();
      }
      localStorage.setItem('noor_sender_email', 'annoorhub786@gmail.com');
      updateKeyStatusUi();
      alert('✓ API Keys saved and active in your browser storage!');
    });

    document.getElementById('noorBtnClearAllKeys')?.addEventListener('click', () => {
      if (confirm('Clear all saved API keys?')) {
        setGeminiKey('');
        localStorage.removeItem('noor_brevo_api_key');
        if (keyInput) keyInput.value = '';
        if (brevoInput) brevoInput.value = '';
        updateKeyStatusUi();
      }
    });
  }

  function updateKeyStatusUi() {
    const key = getGeminiKey();
    const statusEl = document.getElementById('noorKeyStatus');
    const input = document.getElementById('noorApiKeyInput');
    if (input && key) {
      input.value = key;
    }
    if (statusEl) {
      if (key) {
        statusEl.innerHTML = `<span style="color:#059669">✓ Gemini API Key configured in browser (${key.slice(0, 6)}...${key.slice(-4)})</span>`;
      } else {
        statusEl.innerHTML = `<span style="color:#d97706">⚠ No local API key configured. You can paste your key here or use Supabase Edge Functions.</span>`;
      }
    }
  }

  // Voice Recognition via Web Speech API
  let recognition = null;
  let isListening = false;

  function setupVoiceRecognition() {
    const voiceBtn = document.getElementById('noorVoiceBtn');
    const statusEl = document.getElementById('noorVoiceStatus');
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRec) {
      voiceBtn?.addEventListener('click', () => {
        if (statusEl) statusEl.textContent = 'Voice recognition is not supported in this browser. Please use Chrome or Edge.';
      });
      return;
    }

    recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      isListening = true;
      voiceBtn?.classList.add('recording');
      if (statusEl) statusEl.textContent = '🎙️ Listening... Please speak your question now.';
    };

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript || '';
      const input = document.getElementById('noorChatInput');
      if (input && text) {
        input.value = text;
        if (statusEl) statusEl.textContent = `Recognized: "${text}"`;
        handleSendMessage();
      }
    };

    recognition.onerror = (event) => {
      isListening = false;
      voiceBtn?.classList.remove('recording');
      if (statusEl) statusEl.textContent = `Voice error: ${event.error}. Try again or type text.`;
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn?.classList.remove('recording');
    };

    voiceBtn?.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
      } else {
        try {
          recognition.start();
        } catch (e) {
          console.warn('Speech recognition start failed', e);
        }
      }
    });
  }

  // Core Gemini Caller
  async function callGemini(promptText) {
    const key = getGeminiKey();
    if (key) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
        }),
      });
      if (!res.ok) {
        throw new Error(`Gemini API error (Status ${res.status})`);
      }
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return raw;
    }

    // Try Supabase edge function
    if (window.supabaseClient) {
      const { data, error } = await window.supabaseClient.functions.invoke('noor-ai', {
        body: { action: 'chat_assist', message: promptText },
      });
      if (!error && data?.response) return data.response;
    }

    throw new Error('Please configure your Gemini API Key in the "Gemini Key Setup" tab.');
  }

  // Handle Send Message
  async function handleSendMessage() {
    const input = document.getElementById('noorChatInput');
    const msgContainer = document.getElementById('noorChatMessages');
    const text = input?.value?.trim();
    if (!text || !msgContainer) return;

    input.value = '';

    // Append user message
    const userBubble = document.createElement('div');
    userBubble.className = 'noor-chat-bubble user';
    userBubble.textContent = text;
    msgContainer.appendChild(userBubble);

    // Append thinking indicator
    const thinkingBubble = document.createElement('div');
    thinkingBubble.className = 'noor-chat-bubble thinking';
    thinkingBubble.textContent = '✨ NOOR AI is thinking...';
    msgContainer.appendChild(thinkingBubble);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
      const prompt = `You are NOOR AI, the co-pilot for "NOOR Management" (نور) School & University SaaS.
User Query: "${text}".
Provide an encouraging, clear, concise, and structured reply tailored to teachers, principals, or students. If relevant to India/Telangana academic standards, keep that in mind.`;

      const response = await callGemini(prompt);
      thinkingBubble.className = 'noor-chat-bubble assistant';
      thinkingBubble.innerHTML = formatMarkdown(response);
    } catch (err) {
      thinkingBubble.className = 'noor-chat-bubble assistant';
      thinkingBubble.innerHTML = `<span style="color:#dc2626">⚠️ ${escapeHtml(err.message)}</span><br><small style="color:#7d5770">You can paste your Gemini API key in the <b>⚙️ Gemini Key Setup</b> tab to activate real-time AI.</small>`;
    }
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  // Handle Live Insights
  async function handleGenerateInsights() {
    const resContainer = document.getElementById('noorInsightsResult');
    const btn = document.getElementById('noorBtnGenerateInsights');
    if (!resContainer || !btn) return;

    btn.disabled = true;
    btn.textContent = 'Analyzing live records...';
    resContainer.innerHTML = '<div class="noor-ai-card" style="font-style:italic;color:#7d5770">✨ Gathering active student counts, classes, and attendance trend data...</div>';

    try {
      const prompt = `You are NOOR AI analyzing institutional records for a school.
Generate a structured Live Insights summary for the Principal.
Include:
1. Executive Health Summary (Attendance target: 75%)
2. 3 Actionable Recommendations for teachers & administrators
3. Risk or Opportunity Trend Signal.
Return formatted text with emojis and clear bullet points.`;

      const analysis = await callGemini(prompt);
      resContainer.innerHTML = `
        <div class="noor-ai-card" style="border-left:4px solid #059669;background:#f0fdf4">
          <h3 style="color:#065f46">🟢 Live School Insights & Intelligence</h3>
          <div style="font-size:13px;line-height:1.6;color:#1e293b">${formatMarkdown(analysis)}</div>
        </div>
      `;
    } catch (err) {
      resContainer.innerHTML = `
        <div class="noor-ai-card" style="border-left:4px solid #dc2626;background:#fef2f2">
          <h3 style="color:#991b1b">⚠️ Insights Generation Notice</h3>
          <p style="color:#b91c1c">${escapeHtml(err.message)}</p>
          <small>Go to the <b>⚙️ Gemini Key Setup</b> tab to paste your Gemini API Key.</small>
        </div>
      `;
    } finally {
      btn.disabled = false;
      btn.textContent = '⚡ Generate Live Insights Now';
    }
  }

  // Handle Educational Cartoon & Media Generator
  async function handleGenerateCartoon() {
    const resContainer = document.getElementById('noorCartoonResult');
    const btn = document.getElementById('noorBtnGenerateCartoon');
    const topic = document.getElementById('noorCartoonTopic')?.value?.trim() || 'General Science';
    const grade = document.getElementById('noorCartoonGrade')?.value || 'Primary (Classes 1-5)';
    const style = document.getElementById('noorCartoonStyle')?.value || '2D educational storybook cartoon';

    if (!resContainer || !btn) return;

    btn.disabled = true;
    btn.textContent = 'Creating cartoon concepts...';
    resContainer.innerHTML = '<div class="noor-ai-card" style="font-style:italic;color:#7d5770">✨ Designing educational cartoon storyboard and character visual prompts...</div>';

    try {
      const prompt = `Act as an expert children's educational media and cartoon storyboard designer.
Create a complete visual cartoon concept for:
Topic: "${topic}"
Target Grade: "${grade}"
Art Style: "${style}"

Provide:
1. Cartoon Story & Characters (e.g., lively droplet character or playful planetary mascot)
2. Scene Description & Visual Analogies
3. Key Educational Takeaway depicted
4. Detailed Image Generation Prompt (ready to copy and use in Imagen/Midjourney/DALL-E)

Keep it vibrant, fun, educational, and respectful.`;

      const result = await callGemini(prompt);
      resContainer.innerHTML = `
        <div class="noor-ai-card" style="border-left:4px solid #be185d;background:#fdf2f8">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <h3 style="color:#9d174d;margin:0">🎨 Cartoon Concept: ${escapeHtml(topic)}</h3>
            <button type="button" class="noor-chip-btn" id="noorBtnCopyCartoon" style="background:#fff;border-color:#f472b6;color:#be185d">📋 Copy Prompt</button>
          </div>
          <div id="noorCartoonContent" style="font-size:13px;line-height:1.6;color:#374151">${formatMarkdown(result)}</div>
        </div>
      `;

      document.getElementById('noorBtnCopyCartoon')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(result);
        alert('Cartoon concept & prompt copied to clipboard!');
      });
    } catch (err) {
      resContainer.innerHTML = `
        <div class="noor-ai-card" style="border-left:4px solid #dc2626;background:#fef2f2">
          <h3 style="color:#991b1b">⚠️ Cartoon Generation Notice</h3>
          <p style="color:#b91c1c">${escapeHtml(err.message)}</p>
          <small>Go to the <b>⚙️ Gemini Key Setup</b> tab to configure your Gemini API Key.</small>
        </div>
      `;
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Generate Cartoon Storyboard Prompt';
    }
  }

  function formatMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f1e2ea;padding:1px 5px;border-radius:4px">$1</code>');
    html = html.replace(/\n\n/g, '<br><br>');
    html = html.replace(/\n/g, '<br>');
    return html;
  }

  // Export globally and auto-init when DOM is ready
  window.NOOR_AI_COPILOT = {
    open: () => document.getElementById('noorAiModalOverlay')?.classList.add('active'),
    close: () => document.getElementById('noorAiModalOverlay')?.classList.remove('active'),
    setKey: setGeminiKey,
    getKey: getGeminiKey,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCoPilot);
  } else {
    initCoPilot();
  }
})();
