/* Free local weak-password checks for NOOR signup/reset. Existing logins are unchanged.
   This supplements Auth; managed leaked-password protection is a separate Pro feature. */
(function(root){'use strict';
const common=new Set(['password','password1','password12','password123','12345678','123456789','1234567890','qwerty123','qwertyuiop','welcome123','admin123','admin1234','admin12345','school123','iloveyou','letmein123','changeme','abc12345','abcd1234','00000000','11111111']);
function validate(password){if(typeof password!=='string'||password.length<8||password.length>128)throw Error('Use a password of 8–128 characters.');const normalized=password.toLowerCase().replace(/[^a-z0-9]/g,'');if(common.has(normalized)||/^(.)\1{7,}$/.test(password))throw Error('Choose a less common password. Try three or four unrelated words.');return true;}
root.NOOR_PASSWORD_POLICY=Object.freeze({validate});
})(typeof window==='undefined'?globalThis:window);
