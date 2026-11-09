/* Section labels remain plain editable text. Never replace school names with fruit photos. */
(()=>{'use strict';const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function label(value){return E(String(value||'').replace(/[🥭🍎🍏]/gu,'').trim());}window.NOOR_CLASS_VISUALS=Object.freeze({label});})();
