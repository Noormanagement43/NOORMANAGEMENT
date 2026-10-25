/* NOOR AI Daily Dynamic Quote Engine powered by Gemini API with resilient role-specific fallback repository. */
(()=>{
  'use strict';

  const CURATED_QUOTES = {
    principal: [
      { quote: "Leadership in education is not about being in charge; it is about taking care of those in our charge.", author: "Simon Sinek" },
      { quote: "The task of the modern educator is not to cut down jungles, but to irrigate deserts.", author: "C.S. Lewis" },
      { quote: "A school leader's greatest legacy is creating an environment where curiosity and character thrive together.", author: "NOOR Leadership" },
      { quote: "Great institutions are built on trust, clear vision, and daily encouragement of teachers and students alike.", author: "Educational Leadership" },
      { quote: "To lead is to serve, to listen, and to inspire every teacher to bring out the brilliance in every child.", author: "NOOR Vision" },
      { quote: "True school leadership transforms challenges into stepping stones for academic excellence.", author: "Dr. A.P.J. Abdul Kalam" },
      { quote: "An enlightened school culture empowers every educator to innovate without fear of failure.", author: "NOOR Academy" }
    ],
    teacher: [
      { quote: "Teaching is the greatest act of optimism — believing that what you plant today will bloom tomorrow.", author: "Colleen Wilcox" },
      { quote: "One child, one teacher, one book, one pen can change the world.", author: "Malala Yousafzai" },
      { quote: "A teacher affects eternity; he can never tell where his influence stops.", author: "Henry Adams" },
      { quote: "Education is not the filling of a pail, but the lighting of a fire.", author: "W.B. Yeats" },
      { quote: "The art of teaching is the art of assisting discovery.", author: "Mark Van Doren" },
      { quote: "In every classroom, a dedicated teacher shapes the architects of tomorrow's world.", author: "NOOR Pedagogy" },
      { quote: "Patience with a struggling learner is the highest form of pedagogical mastery.", author: "NOOR Faculty" }
    ],
    student: [
      { quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
      { quote: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
      { quote: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
      { quote: "Curiosity is the wick in the candle of learning.", author: "William Arthur Ward" },
      { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
      { quote: "Every mistake you make is a lesson that brings you one step closer to mastery.", author: "NOOR Learning" },
      { quote: "Knowledge is the light that guides your footsteps toward your highest aspirations.", author: "NOOR Wisdom" }
    ]
  };

  function getDayKey() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  function getFallbackQuote(role = 'teacher') {
    const normalizedRole = ['owner', 'principal', 'manager', 'creator'].includes(role) ? 'principal' : (role === 'student' ? 'student' : 'teacher');
    const list = CURATED_QUOTES[normalizedRole] || CURATED_QUOTES.teacher;
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = (now - start) + ((start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000);
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const index = dayOfYear % list.length;
    return list[index];
  }

  function getGeminiKey() {
    return window.NOOR_CONFIG?.GEMINI_API_KEY ||
      window.GEMINI_API_KEY ||
      localStorage.getItem('noor_gemini_api_key') ||
      '';
  }

  async function fetchGeminiQuote(role = 'teacher') {
    const apiKey = getGeminiKey();
    if (!apiKey) return null;

    const normalizedRole = ['owner', 'principal', 'manager', 'creator'].includes(role) ? 'Principal & School Leaders' : (role === 'student' ? 'Students' : 'Teachers & Educators');
    const prompt = `Generate a single inspiring, concise educational quote (max 22 words) specifically tailored for ${normalizedRole}. Return ONLY JSON with format: {"quote": "The quote text here", "author": "Attributed author or Inspiring Educator"}. No markdown, no backticks.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 120 }
        })
      });

      if (!res.ok) return null;
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.() || '';
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed?.quote) {
        return { quote: String(parsed.quote).replace(/^"|"$/g, ''), author: String(parsed.author || 'Gemini Inspiration') };
      }
    } catch (e) {
      console.warn('Gemini Daily Quote generation fallback active:', e.message);
    }
    return null;
  }

  async function getDailyQuote(role = 'teacher', forceRefresh = false) {
    const today = getDayKey();
    const cacheKey = `noor_daily_quote_${role}_${today}`;

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }

    // Try Gemini API
    const geminiQuote = await fetchGeminiQuote(role);
    if (geminiQuote) {
      try { localStorage.setItem(cacheKey, JSON.stringify(geminiQuote)); } catch (e) {}
      return geminiQuote;
    }

    // Fallback curated quote
    const fallback = getFallbackQuote(role);
    try { localStorage.setItem(cacheKey, JSON.stringify(fallback)); } catch (e) {}
    return fallback;
  }

  async function applyQuotes() {
    const app = window.NOOR_AI_APP || {};
    const profile = app.profile || {};
    const role = profile.role || 'teacher';

    const quoteData = await getDailyQuote(role);
    if (!quoteData?.quote) return;

    // Apply to Principal Dashboard
    const pdQuote = document.querySelector('#noor-principal .pd-quote, #pd-quote');
    if (pdQuote) {
      pdQuote.innerHTML = `“${quoteData.quote}” <span style="display:block;margin-top:4px;font-size:11px;opacity:0.85;font-style:normal">— ${quoteData.author}</span>`;
    }
    const pdInsight = document.getElementById('pd-insight');
    if (pdInsight && (!pdInsight.textContent || pdInsight.textContent.includes('Leadership in education builds'))) {
      pdInsight.textContent = quoteData.quote;
    }

    // Apply to Teacher Dashboard
    const teacherQuotes = document.querySelectorAll('.nt-quote p, #nt-quote');
    teacherQuotes.forEach(el => {
      el.innerHTML = `“${quoteData.quote}” <small style="display:block;margin-top:4px;opacity:0.8">— ${quoteData.author}</small>`;
    });

    // Apply to Student Dashboard
    const studentBanner = document.querySelector('.sp-daily-quote');
    if (studentBanner) {
      studentBanner.innerHTML = `<em>“${quoteData.quote}”</em> <small>— ${quoteData.author}</small>`;
    }
  }

  window.NOOR_DAILY_QUOTES = {
    getDailyQuote,
    getFallbackQuote,
    applyQuotes,
    setApiKey: (key) => {
      localStorage.setItem('noor_gemini_api_key', key.trim());
      applyQuotes();
    }
  };

  // Re-run apply on route or workspace changes
  window.addEventListener('noor:workspace-ready', applyQuotes);
  document.addEventListener('DOMContentLoaded', () => setTimeout(applyQuotes, 600));
})();
