/* General question/chat UI is retired. Feature-specific paper generation and analysis remain server backed. */
(()=>{'use strict';
function close(){document.getElementById('noorAIModal')?.remove();document.body.classList.remove('noor-ai-open');}
function mountSettings(container){container?.replaceChildren();}
window.NOOR_SECURE_AI=Object.freeze({open:close,close,mountSettings});
})();
