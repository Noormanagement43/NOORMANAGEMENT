import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const file=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const window={};
vm.runInNewContext(file('noor-holiday-engine.js'),{window,Date,Set});
const engine=window.NOOR_HOLIDAY_ENGINE;
test('only published Telangana 2026 general holidays are automatically selected',()=>{
 const dates=Array.from(engine.holidays('TS',2026),v=>v.date);
 assert.ok(dates.includes('2026-11-08'));assert.ok(dates.includes('2026-10-20'));
 assert.equal(engine.holidays('TS',2027).length,0,'Do not invent the future official G.O.');
 assert.equal(engine.holidays('OTHER',2026).length,0,'Do not apply Telangana holidays to other states');
});
test('school working days exclude weekends plus holidays exactly once',()=>{
 const telangana=Array.from(engine.holidays('TS',2026),v=>v.date);
 const weekdays=Array.from(engine.workingDates('2026-11-01','2026-11-09',[0],telangana));
 assert.equal(weekdays.length,7,'Sunday Deepavali should not be double-subtracted');
 const override=Array.from(engine.workingDates('2026-11-01','2026-11-09',[0],[...telangana,'2026-11-05']));
 assert.equal(override.length,6,'School principal-declared closure must reduce working days');
});
test('attendance report counts all scheduled working days, not only saved attendance sessions',()=>{
 const code=file('noor-annual-reports.js');
 assert.match(code,/NOOR_HOLIDAY_ENGINE\?\.workingDates/);
 assert.match(code,/schoolDays\.map\(d=>\[d,\[\]\]\)/);
 assert.match(code,/if\(days\.has\(d\)\)days\.get\(d\)\.push\(x\.id\)/);
 assert.match(code,/row\.unmarked\+\+/);
 assert.match(code,/attendance_records/);
 assert.match(code,/region_code/);
 assert.match(code,/include_official_holidays/);
});
test('each school has its own theme and annual report follows selected color tokens',()=>{
 const theme=file('theme-system.js'),css=file('noor-annual-reports.css'),index=file('index.html');
 assert.match(theme,/noor_school_appearance/);
 assert.match(theme,/principal=\(\)=>app\(\)\.profile\?\.role==="principal"/);
 assert.doesNotMatch(theme,/noor\.login-theme|noor_appearance|user_theme_preferences|noor\.appearance\./);
 assert.match(css,/var\(--berry/);
 assert.match(css,/nar-summary/);
 assert.match(index,/NOOR_HOLIDAY_ENGINE|noor-holiday-engine\.js/);
 assert.match(index,/theme-system\.js\?v=[^"\s]+/);
});
