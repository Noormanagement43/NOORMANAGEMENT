import {configuredSender,messageHtml} from './school-mail.ts';
const assert=(v:unknown)=>{if(!v)throw Error('Assertion failed')};
Deno.test('sender selection respects explicit settings and the established NOOR fallback',()=>{
 assert(configuredSender({EMAIL_FROM:' Office@Example.invalid '})==='office@example.invalid');
 assert(configuredSender({BREVO_FROM_EMAIL:' School@Example.invalid '})==='school@example.invalid');
 assert(configuredSender({})==='noormanagement43@gmail.com');
});
Deno.test('school email escapes all message and school content and preserves line breaks',()=>{
 const html=messageHtml('<img src=x>','Hello\n<script>alert(1)</script>','Office <svg onload=x>');
 assert(html.includes('&lt;img src=x&gt;'));assert(html.includes('Hello<br>&lt;script&gt;'));
 assert(!html.includes('<script>')&&!html.includes('<svg'));assert(html.includes('role="presentation"'));
});
Deno.test('school meeting email includes a labelled local meeting time',()=>{
 const html=messageHtml('Meeting','Bring notes','School','2026-11-14T09:00:00Z');
 assert(html.includes('Meeting · ')&&html.includes('IST'));assert(html.includes('2:30'));
});
