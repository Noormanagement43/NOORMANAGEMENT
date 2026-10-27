/* Deprecated legacy AI module. Do not put Gemini or Brevo keys in browser localStorage.
 * Use the authenticated, server-only NOOR_SECURE_AI launcher instead. */
(()=>{'use strict';window.NOOR_AI_COPILOT={open:()=>window.NOOR_SECURE_AI?.open?.(),close:()=>window.NOOR_SECURE_AI?.close?.()};})();
