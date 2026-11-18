import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const paper=read('noor-assessment-studio.js');
const studioCSS=read('noor-assessment-studio.css');
const teacherReview=read('noor-weekly-quiz.js');
const gemini=read('supabase/functions/noor-v2-ai/index.ts');
const grader=read('supabase/functions/noor-test-grader/index.ts');

test('student paper displays plain text only with question-by-question navigation',()=>{
 assert.doesNotMatch(paper,/\+'\+questionVisual\(item\)\+'|\+questionVisual\(item\)\+|\+visual\(item\.visuals/);
 assert.match(paper,/data-prev>← Previous/);
 assert.match(paper,/showQuestion\(0\)/);
 assert.match(paper,/\[data-question\]\[hidden\]/.test(studioCSS)?/showQuestion\(index\)/:/showQuestion\(index\)/);
 assert.match(studioCSS,/\[data-question\]\[hidden\]\{display:none!important\}/);
});
test('question progress opens from button or right swipe and shows completion status',()=>{
 for(const code of ['data-open-progress','data-progress-drawer','data-jump','touchstart','touchend','dx>0','toggleProgress(true)'])assert.ok(paper.includes(code),code);
 assert.match(paper,/answers\.filter/);
});
test('teachers control question type, marks, choices and total before AI generation',()=>{
 for(const code of ['Question Setup','setupBlueprint','question_plan','data-plan-field="marks"','data-plan-field="format"','data-plan-field="option_count"'])assert.ok(paper.includes(code),code);
 assert.match(gemini,/const requested=input\.question_plan/);
 assert.match(gemini,/q\.scene='none';q\.visuals=\[\]/);
 assert.match(gemini,/q\.options\.length!==plan\[i\]\.option_count/);
 assert.match(gemini,/generate\('gemini'/);
});
test('teacher can review model key, student answers and grading outcome',()=>{
 for(const code of ['Correct Answer','Student Answer','Result','Marks','Submit Marks','Marks Submitted','data-grade'])assert.ok(teacherReview.includes(code),code);
 assert.match(grader,/noor_finish_auto_test/);
 assert.match(grader,/generate\('gemini'/);
});
test('existing online assessment runtime exports teacher and student routes',()=>{
 const context={window:{}};vm.runInNewContext(paper,context);
 assert.equal(typeof context.window.NOOR_WEEKLY_QUIZ.teacher,'function');
 assert.equal(typeof context.window.NOOR_WEEKLY_QUIZ.student,'function');
});
