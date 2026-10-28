/* NOOR: subject-aware visual dictionary. No user-visible suggestion list.
 * Unknown subjects still receive a stable colour + readable initials badge.
 * This is display metadata only; it never grants access to a school subject.
 */
(function(global){
 'use strict';
 const rules=[
  [/anthropolog|ethnolog|palaeoanthropolog/i,"🧑‍🔬","Anthropology","anthropology"],
  [/zoolog|animal science|wildlife|veterinar|entomolog|ornitholog/i,"🐾","Zoology","zoology"],
  [/botan|plant science|horticultur|floricultur|mycolog/i,"🌿","Botany","botany"],
  [/marine biolog|oceanograph|fishery|aquacultur/i,"🐠","Marine Science","marine"],
  [/archaeolog|palaeontolog|paleontolog|prehistory/i,"🏺","Archaeology","archaeology"],
  [/astronom|astrophys|cosmolog|space science/i,"🔭","Astronomy","astronomy"],
  [/genetic|genom|bioinformatic|biotechnolog/i,"🧬","Genetics","genetics"],
  [/microbiolog|bacteriolog|virolog|immunolog|patholog/i,"🦠","Microbiology","microbiology"],
  [/biochem|molecular biolog|cell biolog/i,"🧫","Biochemistry","biochemistry"],
  [/neuroscien|neurolog/i,"🧠","Neuroscience","neuroscience"],
  [/human anatom|physiolog/i,"🫀","Anatomy","anatomy"],
  [/ecolog|environment|climate|sustainab|conservation/i,"🌱","Environmental Studies","environment"],
  [/geolog|geophys|earth science|mineralog|seismolog/i,"🪨","Geology","geology"],
  [/meteorolog|weather science|atmospher/i,"🌦️","Meteorology","meteorology"],
  [/organic chem|inorganic chem|physical chem|chemistry|chemical science/i,"⚗️","Chemistry","chemistry"],
  [/quantum|nuclear physics|applied physics|physics|mechanics|thermodynamic|optics/i,"⚛️","Physics","physics"],
  [/laboratory|\blab\b|practical|experiment/i,"🔬","Laboratory","lab"],
  [/biology|biological|life science|living science/i,"🧬","Biology","biology"],
  [/integrated science|general science|science/i,"🔬","Science","science"],
  [/statistics|statistic|data analysis|data science/i,"📊","Statistics","statistics"],
  [/mathematics|\bmath\b|maths|arithmetic|algebra|geometry|calculus|trigonometry|number theory/i,"🧮","Mathematics","math"],
  [/social studies|social science|social education/i,"🌍","Social Studies","social"],
  [/sociolog|social work|demograph/i,"👥","Sociology","sociology"],
  [/psycholog|behaviour|behavior|counsell/i,"🧠","Psychology","psychology"],
  [/histor|historiograph|ancient civiliz/i,"🏛️","History","history"],
  [/geograph|geopolitic|cartograph/i,"🗺️","Geography","geography"],
  [/civic|political science|politics|public policy|government/i,"🏛️","Civics","civics"],
  [/legal studies|criminolog|constitutional law|\blaw\b|jurisprudence/i,"⚖️","Law","law"],
  [/econom|microeconom|macroeconom/i,"📈","Economics","economics"],
  [/accountancy|accounting|bookkeeping|financial report/i,"🧾","Accountancy","accountancy"],
  [/business studies|business administration|business management|management/i,"💼","Management","management"],
  [/commerce|trade studies|commercial/i,"🛒","Commerce","commerce"],
  [/marketing|advertising|branding|public relation/i,"📣","Marketing","marketing"],
  [/entrepreneur|startup|innovation/i,"🚀","Entrepreneurship","entrepreneurship"],
  [/finance|banking|investment|insurance|taxation/i,"💳","Finance","finance"],
  [/human resource|organizational behavio/i,"🧑‍💼","Human Resources","hr"],
  [/agricultur|agronom|soil science|dairy science/i,"🌾","Agriculture","agriculture"],
  [/food science|nutrition|dietetics|culinary/i,"🍎","Nutrition","nutrition"],
  [/nursing|health education|public health|medicine|medical/i,"🩺","Health Sciences","health"],
  [/pharmacy|pharmacolog|pharmaceutical/i,"💊","Pharmacy","pharmacy"],
  [/dentistr|dental/i,"🦷","Dentistry","dentistry"],
  [/computer science|computer application|computing|informatics|programming|coding|software engineering|information technology|\bIT\b/i,"💻","Computer Science","computers"],
  [/cybersecurity|information security|cryptograph/i,"🔐","Cybersecurity","cybersecurity"],
  [/machine learning|artificial intelligence|\bAI\b|robotics|automation/i,"🤖","Artificial Intelligence","ai"],
  [/electrical|electronics|circuit|telecommunicat/i,"⚡","Electrical Engineering","electrical"],
  [/mechanical engineering|manufactur|automotive|mechatronic/i,"⚙️","Mechanical Engineering","mechanical"],
  [/civil engineering|structural engineering|construction/i,"🏗️","Civil Engineering","civil"],
  [/architecture|interior design|urban planning/i,"🏛️","Architecture","architecture"],
  [/english|literature|grammar|reading|creative writing/i,"📘","English","english"],
  [/hindi/i,"🔤","Hindi","hindi"],
  [/telugu/i,"🔡","Telugu","telugu"],
  [/urdu/i,"📜","Urdu","urdu"],
  [/arabic|persian|farsi/i,"📖","Arabic","arabic"],
  [/french/i,"🇫🇷","French","french"],
  [/german/i,"🇩🇪","German","german"],
  [/spanish/i,"🇪🇸","Spanish","spanish"],
  [/sanskrit/i,"🕉️","Sanskrit","sanskrit"],
  [/linguistic|phonetic|translation|foreign language|language studies/i,"🗣️","Languages","languages"],
  [/communication|journalism|mass media|media studies/i,"🎙️","Communication","communication"],
  [/fine art|drawing|painting|visual art|sculpture|craft/i,"🎨","Art","art"],
  [/dance|drama|theatre|performing art/i,"🎭","Performing Arts","performance"],
  [/music|vocal|instrument|orchestra/i,"🎵","Music","music"],
  [/film|cinema|photograph|animation|graphic design/i,"🎬","Creative Media","creative"],
  [/physical education|sports|fitness|yoga|athletic/i,"⚽","Physical Education","sports"],
  [/moral science|value education|ethics|philosoph/i,"🌟","Ethics","ethics"],
  [/religious studies|theology|scripture/i,"📿","Religious Studies","religious"],
  [/education|pedagog|teaching method|early childhood/i,"🎓","Education","education"],
  [/research method|thesis|dissertation/i,"🔎","Research","research"],
  [/home science|family studies|household/i,"🏡","Home Science","home"],
  [/tourism|hospitality|hotel management/i,"🧳","Hospitality","hospitality"]
 ];
 function normalize(input){return String(input??'').normalize('NFKC').trim().replace(/\s+/g,' ').slice(0,140)}
 function display(input){
  const subject=normalize(input);
  if(!subject)return{icon:'📚',label:'Subject',tone:'general',initials:'?',hue:230,matched:false};
  const rule=rules.find(([pattern])=>pattern.test(subject));
  let hash=2166136261;
  for(const cp of Array.from(subject.toLowerCase())){hash^=cp.codePointAt(0);hash=Math.imul(hash,16777619)}
  const initials=subject.split(/[\s/,&-]+/).filter(Boolean).slice(0,2).map(x=>Array.from(x)[0]?.toUpperCase()||'').join('').slice(0,2);
  return {icon:rule?.[1]||'📚',label:rule?.[2]||subject,tone:rule?.[3]||'custom',
   initials,hue:Math.abs(hash>>>0)%360,matched:Boolean(rule)};
 }
 global.NOOR_SUBJECT_ICONS=Object.freeze({display,normalize,knownCount:rules.length});
})(typeof window==='object'?window:globalThis);