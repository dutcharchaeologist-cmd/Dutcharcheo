/* ================================================================
   Performance Intelligence v5.3
   - Import: XLSX (eigen lezer, werkt offline), XLS (SheetJS via CDN), CSV/TSV.
   - Kolomherkenning op naam én inhoud; handmatige koppeling altijd mogelijk.
   - Gegevens blijven lokaal (IndexedDB) en overleven herladen.
   - Dashboard: top 20, onderwerpen, periodes, RPM, formats, hooks, dagen.
   - Rangschikking en selectie van 12 + 5 voor de dagelijkse batch.
   ================================================================ */
(function(){
const $=id=>document.getElementById(id);
const nl=(n,d=0)=>n==null||!isFinite(n)?'—':Number(n).toLocaleString('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d});
const compact=n=>{if(n==null||!isFinite(n))return '—';const a=Math.abs(n);if(a>=1e6)return nl(n/1e6,a>=1e7?0:1)+' mln';if(a>=1e4)return nl(n/1e3,0)+'k';return nl(n,0);};
const money=(n,d=2)=>n==null||!isFinite(n)?'—':'$'+nl(n,d);
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const quant=(a,q)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.max(0,Math.floor(q*(s.length-1))))];};
const sum=a=>a.reduce((x,y)=>x+y,0);
const esc=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
const MIN_GROUP=15;   // onder dit aantal posts geen harde conclusies

/* ---------- onderwerpen ---------- */
/* [naam, voorlopige referentie-index (uit eerdere analyse) of null, trefwoorden]
   Trefwoorden zijn woordbeginnen; een $ aan het eind betekent 'heel woord'. */
const CATS=[
 ['Water & techniek',1.39,['dijk','delta','flood','overstrom','watersnood','polder','bridge','brug','dam$','dams$','dammen$','canal','kanaal','gracht','engineer','ingenieur','tunnel','sluice','sluis','sluizen','windmill','windmolen','molen','gemaal','pumping','afsluitdijk','zuiderzee','deltawerk','storm surge','land reclamation','inpoldering','schiphol']],
 ['Dutch lifestyle & cultuur',1.27,['tradition','traditie','fiets','bicycle','bike','cycling','gewoonte','customs$','woonwagen','curtain','gordijn','gezellig','clog','klomp','tulip','tulp','sinterklaas','carnival','carnaval','houseboat','woonboot','directness','dutch habit','dutch people','dialect']],
 ['Rampen, misdaad & moord',1.09,['disaster','ramp$','rampen$','catastrophe','murder','moord','crime','misdaad','criminal','killer','fire$','fires$','blaze','explosion','explod','ontploff','crash','shipwreck','schipbreuk','scheepsramp','epidemic','plague','pest$','execution','executed','executie','terechtgesteld','witch','heks','robbery','overval','theft','diefstal','kidnap','ontvoer','massacre','bloedbad']],
 ['WOII & bezetting',1.02,['wwii','ww2','world war ii','world war 2','second world war','tweede wereldoorlog','nazi','occupation','occupied','bezetting','bezet$','bezette','verzet','resistance','holocaust','jodenvervolging','anne frank','hongerwinter','hunger winter','liberation','bevrijding','market garden','luftwaffe','gestapo','nsb$','wehrmacht','bombing of rotterdam','bombardement','194\\d$']],
 ['Opstand & Oranjes',1.01,['orange','oranje','william of orange','willem van oranje','opstand','revolt','eighty years','tachtigjarige','spanish','spaans','alva$','beggars','geuzen','stadtholder','stadhouder','king$','koning','queen','koningin','royal','koninklijk','prince$','prins$','princess','prinses']],
 ['Oudheid & middeleeuwen',1.00,['roman$','romans$','romein','medieval','middeleeuw','viking','prehistor','ancient','dorestad','castle','kasteel','knight','ridder','hunebed','dolmen','bog body','veenlijk','bronze age','bronstijd','iron age','ijzertijd','stone age','steentijd','neanderthal','mammoth','mammoet','frisian','friezen','celtic','kelt','batav','limes$','monastery','klooster','crusade','kruistocht','charlemagne','karel de grote']],
 ['Eten & tradities',0.93,['food$','eten$','cheese','kaas','stroopwafel','herring','haring','recipe','recept','bread$','brood$','beer$','bier$','jenever','licorice','drop$','pancake','pannenkoek','oliebol','bitterbal','kroket','croquette','poffertje','hagelslag','erwtensoep','stamppot','cuisine','keuken']],
 ['Gouden Eeuw, VOC & zee',0.81,['voc$','wic$','east india','west india','golden age','gouden eeuw','ship$','ships$','schip$','schepen','naval','navy','marine$','fleet','vloot','de ruyter','tromp$','tasman','sailor','zeeman','zeelieden','admiral','admiraal','batavia','new amsterdam','nieuw-amsterdam','spice','specerij']],
 ['Wetenschap & uitvinders',0.73,['scientist','wetenschap','invent','uitvind','microscope','microscoop','leeuwenhoek','huygens','telescope','telescoop','physicist','natuurkund','astronom','sterrenkund','chemist','scheikund','nobel']],
 ['Kolonialisme & slavernij',0.60,['slavery','slavernij','enslav','slave$','slaves$','slaaf','slaven$','colonial','koloniaal','koloniale','kolonie','colony','indonesi','suriname','plantation','plantage']],
 ['Archeologie & vondsten',null,['archaeolog','archeolog','excavat','opgraving','opgegraven','unearthed','dug up','artefact','artifact','skeleton','skelet','burial','begraaf','grave$','graves$','graf$','metal detector','metaaldetector','hoard','muntschat','treasure','schat$','coin$','coins$','munten','relic','fossil','fossiel']],
 ['Kunst & erfgoed',null,['painting','schilderij','painter','schilder$','rembrandt','vermeer','van gogh','frans hals','mondriaan','mondrian','escher','museum','mauritshuis','rijksmuseum','masterpiece','meesterwerk','sculpture','beeldhouw','architect','cathedral','kathedraal','church$','kerk$']]
];
const catRx=CATS.map(([name,base,words])=>[name,base,new RegExp('(?:^|[^\\p{L}\\p{N}])(?:'+words.map(w=>w.endsWith('$')?w.slice(0,-1)+'(?![\\p{L}\\p{N}])':w).join('|')+')','giu')]);
/* De hook weegt zwaar; de caption telt mee maar wordt afgetopt, zodat een
   lange tekst met toevallige trefwoorden het onderwerp niet overneemt. */
function categorize(text,hook){
  const t=String(text||''),head=hook!=null?String(hook):t.slice(0,240);let best=null,bestScore=0;
  for(const [name,base,rx] of catRx){
    rx.lastIndex=0;const all=Math.min(4,(t.match(rx)||[]).length);rx.lastIndex=0;const h=(head.match(rx)||[]).length;
    const score=all+h*3;if(score>bestScore){bestScore=score;best=[name,base];}
  }
  return best||['Overig',null];
}

/* ---------- historische periodes ---------- */
const PERIODS=[
 ['Prehistorie',-1e6,-801,/prehistor|stone age|steentijd|bronze age|bronstijd|neolith|mesolith|paleolith|hunebed|dolmen|mammoth|mammoet|neanderthal|ice age|ijstijd/i],
 ['Oudheid & Romeinen',-800,499,/\broman|romein|caesar|limes\b|batav|ancient|oudheid|iron age|ijzertijd|\bbc\b|v\.\s?chr|before christ/i],
 ['Middeleeuwen',500,1499,/medieval|middeleeuw|viking|knight|ridder|castle|kasteel|crusade|kruistocht|charlemagne|karel de grote|dorestad|monaster|klooster/i],
 ['16e eeuw & Opstand',1500,1599,/eighty years|tachtigjarige|willem van oranje|william of orange|beeldenstorm|iconoclas|alva\b|geuzen|beggars/i],
 ['Gouden Eeuw (17e eeuw)',1600,1699,/golden age|gouden eeuw|\bvoc\b|rembrandt|vermeer|de ruyter|rampjaar|disaster year 1672/i],
 ['18e eeuw',1700,1799,/patriot|batavian republic|bataafse republiek|18th century|18e eeuw|achttiende eeuw/i],
 ['19e eeuw',1800,1913,/napoleon|19th century|19e eeuw|negentiende eeuw|victorian|industrial revolution|industriële revolutie/i],
 ['WOI & interbellum',1914,1938,/world war i\b|first world war|eerste wereldoorlog|great war|1918 flu|spaanse griep|interbellum|crisis jaren|great depression/i],
 ['WOII',1939,1945,/wwii|ww2|world war ii|second world war|tweede wereldoorlog|nazi|bezetting|occupation|hongerwinter|hunger winter|holocaust|anne frank|liberation|bevrijding/i],
 ['Na 1945',1946,2100,/watersnoodramp 1953|cold war|koude oorlog|1953 flood|post-war|naoorlogs|wederopbouw/i]
];
function periodOf(text){
  const t=String(text||'').slice(0,900);
  const ym=t.match(/\b(\d{3,4})\s*(bc|bce|v\.?\s?chr)\b/i);
  if(ym){const y=-Number(ym[1]);return PERIODS.find(p=>y>=p[1]&&y<=p[2])?.[0]||'Prehistorie';}
  const years=[...t.matchAll(/\b(1[0-9]{3}|20[0-2][0-9]|[5-9][0-9]{2})\b/g)].map(m=>Number(m[1])).filter(y=>y>=500&&y<=2030);
  for(const p of PERIODS)if(p[3].test(t))return p[0];
  if(years.length){const y=years[0];const p=PERIODS.find(p=>y>=p[1]&&y<=p[2]);if(p)return p[0];}
  return 'Onbekend';
}

/* ---------- hooks en formats ---------- */
function hookOf(text){
  const t=String(text||'').trim();const first=t.split(/\n/).find(l=>l.trim())||'';
  const m=first.match(/^(.{20,220}?[.!?…])(\s|$)/);return (m?m[1]:first).slice(0,220).trim();
}
const HOOK_FEATURES=[
 ['Begint met een jaartal',h=>/^\s*(in\s+)?\d{3,4}\b/i.test(h)],
 ['Bevat een getal',h=>/\d/.test(h)],
 ['Is een vraag',h=>/\?\s*$/.test(h)||/^(why|how|what|who|did|waarom|hoe|wat|wie|wist)\b/i.test(h)],
 ['Superlatief (eerste, oudste, grootste…)',h=>/\b(first|oldest|largest|biggest|only|most|worst|best|deadliest|eerste|oudste|grootste|enige|meeste|ergste|beste|dodelijkste)\b/i.test(h)],
 ['"Did you know" / "Wist je dat"',h=>/^(did you know|wist je)/i.test(h)],
 ['Emotioneel woord (shocking, tragic…)',h=>/\b(shock|tragic|heartbreak|terrible|horrif|incredible|unbelievable|amazing|brutal|schokkend|tragisch|verschrikkelijk|ongelooflijk|wreed)/i.test(h)],
 ['Kort (< 70 tekens)',h=>h.length<70],
 ['Lang (> 140 tekens)',h=>h.length>140]
];
function lengthBucket(words){return words<80?'Kort (< 80 woorden)':words<=150?'Middel (80–150 woorden)':words<=260?'Lang (151–260 woorden)':'Zeer lang (> 260 woorden)';}

/* ---------- getallen en datums ---------- */
function parseNumber(x){
  if(typeof x==='number')return isFinite(x)?x:null;
  let t=String(x??'').trim();if(!t||/^[-–—]$/.test(t)||/^n\/?a$/i.test(t))return null;
  let mult=1;const suf=t.match(/(k|m|mln|mio|miljoen|million|b|mld|bn)\.?\s*$/i);
  if(suf){const s=suf[1].toLowerCase();mult=s==='k'?1e3:(s==='b'||s==='mld'||s==='bn')?1e9:1e6;t=t.slice(0,suf.index);}
  const neg=/^\s*[-–(]/.test(t);
  t=t.replace(/[^\d,.]/g,'');if(!t)return null;
  const comma=t.lastIndexOf(','),dot=t.lastIndexOf('.');
  if(comma>=0&&dot>=0)t=comma>dot?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'');
  else if(comma>=0)t=(/,\d{1,2}$/.test(t)||(mult>1&&/,\d+$/.test(t)))&&(t.match(/,/g)||[]).length===1?t.replace(',','.'):t.replace(/,/g,'');
  else if(dot>=0&&/^\d{1,3}(\.\d{3})+$/.test(t)&&mult===1)t=t.replace(/\./g,'');
  const n=Number(t);return isFinite(n)?(neg?-n:n)*mult:null;
}
function parseDate(v){
  if(v==null||v==='')return null;
  if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Math.round((v-25569)*864e5));return isNaN(d)?null:d;}
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})(?:[ T,]+(\d{1,2}):(\d{2}))?/);
  if(m){const d=new Date(+m[3],+m[2]-1,+m[1],+(m[4]||0),+(m[5]||0));return isNaN(d)?null:d;}
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if(m){const d=new Date(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0));return isNaN(d)?null:d;}
  if(/^\d+(\.\d+)?$/.test(s)){const n=Number(s);if(n>1e9){const d=new Date(n>1e12?n:n*1000);return isNaN(d)?null:d;}if(n>20000&&n<80000)return parseDate(n);}
  const d=new Date(s);return isNaN(d)||d.getFullYear()<2000||d.getFullYear()>2100?null:d;
}

/* ---------- bestanden lezen ---------- */
function csvParse(txt,sep){const rows=[];let row=[],field='',quoted=false;txt=txt.replace(/^\uFEFF/,'');for(let i=0;i<txt.length;i++){const c=txt[i];if(quoted){if(c==='"'){if(txt[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}else if(c==='"'&&field==='')quoted=true;else if(c===sep){row.push(field);field='';}else if(c==='\n'||c==='\r'){if(c==='\r'&&txt[i+1]==='\n')i++;row.push(field);if(row.some(x=>String(x).trim()))rows.push(row);row=[];field='';}else field+=c;}row.push(field);if(row.some(x=>String(x).trim()))rows.push(row);return rows;}
function sniffSep(t){
  const sample=t.slice(0,60000);let best=',',bestScore=-1;
  for(const sep of [',',';','\t','|']){
    const rows=csvParse(sample,sep).slice(0,40);if(rows.length<2)continue;
    const counts=new Map();for(const r of rows)if(r.length>1)counts.set(r.length,(counts.get(r.length)||0)+1);
    let modeCols=0,modeN=0;for(const [c,n] of counts)if(n>modeN||(n===modeN&&c>modeCols)){modeCols=c;modeN=n;}
    if(modeCols<2)continue;const score=modeN/rows.length*100+Math.min(modeCols,30);
    if(score>bestScore){bestScore=score;best=sep;}
  }
  return best;
}
async function decodeText(file){const buf=await file.arrayBuffer();const b=new Uint8Array(buf);if(b[0]===0xFF&&b[1]===0xFE)return new TextDecoder('utf-16le').decode(buf);if(b[0]===0xFE&&b[1]===0xFF)return new TextDecoder('utf-16be').decode(buf);const u=new TextDecoder('utf-8').decode(buf);return u.includes('\uFFFD')?new TextDecoder('windows-1252').decode(buf):u;}

/* Minimale XLSX-lezer: ZIP-container + sheet-XML. Gebruikt de ingebouwde
   DecompressionStream van de browser, dus geen download of internet nodig. */
async function inflateRaw(bytes){const ds=new DecompressionStream('deflate-raw');const stream=new Blob([bytes]).stream().pipeThrough(ds);return new Uint8Array(await new Response(stream).arrayBuffer());}
async function unzip(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf);let eocd=-1;
  for(let i=u8.length-22;i>=Math.max(0,u8.length-70000);i--)if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}
  if(eocd<0)throw Error('Geen geldig XLSX-bestand (ZIP-structuur ontbreekt).');
  const count=dv.getUint16(eocd+10,true);let p=dv.getUint32(eocd+16,true);const files={};const dec=new TextDecoder();
  for(let n=0;n<count;n++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nlen=dv.getUint16(p+28,true),elen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    const name=dec.decode(u8.subarray(p+46,p+46+nlen));
    files[name]={method,csize,off};p+=46+nlen+elen+clen;
  }
  return {names:Object.keys(files),async read(name){const f=files[name]||files[Object.keys(files).find(k=>k.toLowerCase()===name.toLowerCase())];if(!f)return null;const ln=dv.getUint16(f.off+26,true),le=dv.getUint16(f.off+28,true);const data=u8.subarray(f.off+30+ln+le,f.off+30+ln+le+f.csize);const raw=f.method===0?data:f.method===8?await inflateRaw(data):null;if(!raw)throw Error('Onbekende compressie in XLSX');return new TextDecoder('utf-8').decode(raw);}};
}
const xml=t=>new DOMParser().parseFromString(t,'application/xml');
const tags=(node,name)=>[...node.getElementsByTagNameNS('*',name)];
function colIndex(ref){const m=String(ref||'').match(/^([A-Z]+)/i);if(!m)return -1;let n=0;for(const ch of m[1].toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n-1;}
async function readXlsx(buf){
  const z=await unzip(buf);
  const wb=xml(await z.read('xl/workbook.xml')||'');
  const relsTxt=await z.read('xl/_rels/workbook.xml.rels');const rels={};
  if(relsTxt)for(const r of tags(xml(relsTxt),'Relationship'))rels[r.getAttribute('Id')]=r.getAttribute('Target');
  const ssTxt=await z.read('xl/sharedStrings.xml');
  const shared=ssTxt?tags(xml(ssTxt),'si').map(si=>tags(si,'t').map(t=>t.textContent).join('')):[];
  const sheets=[];
  for(const sh of tags(wb,'sheet')){
    const rid=sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sh.getAttribute('r:id');
    let target=rels[rid]||'';if(!target)continue;target=target.replace(/^\//,'');if(!target.startsWith('xl/'))target='xl/'+target;
    const txt=await z.read(target);if(!txt)continue;
    const doc=xml(txt),rows=[];
    for(const r of tags(doc,'row')){
      const ri=Number(r.getAttribute('r'))-1;const row=[];
      for(const c of tags(r,'c')){
        const ci=colIndex(c.getAttribute('r'));const t=c.getAttribute('t');const v=tags(c,'v')[0]?.textContent??'';let val;
        if(t==='s')val=shared[Number(v)]??'';else if(t==='inlineStr')val=tags(c,'t').map(x=>x.textContent).join('');else if(t==='str'||t==='e')val=v;else if(t==='b')val=v==='1'?'TRUE':'FALSE';else val=v===''?'':(isFinite(Number(v))?Number(v):v);
        row[ci>=0?ci:row.length]=val;
      }
      for(let i=0;i<row.length;i++)if(row[i]===undefined)row[i]='';
      rows[ri>=0?ri:rows.length]=row;
    }
    sheets.push({name:sh.getAttribute('name')||('Blad '+(sheets.length+1)),rows:rows.map(r=>r||[]).filter(r=>r.some(x=>String(x).trim()!==''))});
  }
  if(!sheets.length)throw Error('Geen werkbladen gevonden in het XLSX-bestand.');
  return sheets;
}
async function loadSheetJS(){if(typeof XLSX!=='undefined')return;await new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';s.onload=ok;s.onerror=()=>fail(Error('Kan de Excel-lezer niet downloaden (geen internet). Exporteer als CSV of XLSX.'));document.head.appendChild(s);});}
async function readFile(f){
  const name=f.name||'';
  if(/\.(csv|tsv|txt)$/i.test(name)||/text\//.test(f.type)){const t=await decodeText(f);return [{name:name.replace(/\.[^.]+$/,'')||'CSV',rows:csvParse(t,/\.tsv$/i.test(name)?'\t':sniffSep(t))}];}
  const buf=await f.arrayBuffer();const head=new Uint8Array(buf.slice(0,4));
  const isZip=head[0]===0x50&&head[1]===0x4B;
  if(isZip&&'DecompressionStream' in window){try{return await readXlsx(buf);}catch(e){console.warn('Eigen XLSX-lezer faalde, SheetJS volgt',e);}}
  await loadSheetJS();
  const book=XLSX.read(buf,{type:'array'});
  return book.SheetNames.map(n=>({name:n,rows:XLSX.utils.sheet_to_json(book.Sheets[n],{header:1,defval:'',raw:true}).filter(r=>r.some(x=>String(x).trim()!==''))}));
}

/* ---------- kolomherkenning ---------- */
const norm=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const FIELDS=[
 {key:'text',label:'Posttekst',req:true,exact:['message','postmessage','posttext','text','caption','postcaption','description','postdescription','content','postcontent','tekst','posttekst','bericht','berichttekst','omschrijving','beschrijving','body','fulltext','copy','status','statusupdate','title','titel'],part:['message','caption','posttext','tekst','description','content','bericht','omschrijving']},
 {key:'views',label:'Views / bereik',req:true,exact:['views','postviews','videoviews','totalviews','viewcount','views3s','3secondvideoviews','weergaven','weergaves','aantalweergaven','plays','reach','postreach','totalreach','bereik','impressions','postimpressions','vertoningen','weergave'],part:['views','weergaven','weergaves','plays','reach','bereik','impression','vertoning']},
 {key:'revenue',label:'Inkomsten',exact:['earnings','estimatedearnings','estimatedearningsusd','revenue','estimatedrevenue','totalrevenue','income','inkomsten','opbrengst','verdiensten','geschatteinkomsten','monetization','contentmonetization','approximatecontentmonetizationearnings','monetizationearnings','payout','uitbetaling','amount','bedrag','usd','eur'],part:['earning','revenue','income','inkomsten','opbrengst','verdienst','monetiz','payout']},
 {key:'reactions',label:'Reacties / likes',exact:['reactions','likes','totalreactions','postreactions','vindikleuks','likesreactions','emoties'],part:['reaction','likes','vindikleuk']},
 {key:'comments',label:'Comments',exact:['comments','totalcomments','postcomments','opmerkingen','reacties','commentaren'],part:['comment','opmerking','commentaar']},
 {key:'shares',label:'Shares',exact:['shares','totalshares','postshares','keergedeeld','gedeeld','delingen','deelacties'],part:['share','gedeeld','deling']},
 {key:'reposts',label:'Reposts',exact:['reposts','repost','repostcount','herplaatsingen','herposts','reshares'],part:['repost','herplaats','herpost']},
 {key:'date',label:'Datum',exact:['date','publishtime','publishedtime','publishedat','publishdate','posted','postedat','postdate','createdtime','createdat','created','datum','publicatiedatum','publicatietijd','gepubliceerd','tijdstip','datetime','time'],part:['publish','posted','created','datum','date']},
 {key:'type',label:'Posttype / format',exact:['posttype','type','mediatype','format','soort','contenttype','berichttype','soortbericht'],part:['posttype','mediatype','contenttype','format']},
 {key:'link',label:'Link',exact:['permalink','link','url','posturl','postlink','postid','id'],part:['permalink','posturl','postlink']},
 {key:'media',label:'Media',exact:['media','mediaurl','image','imageurl','afbeelding','thumbnail','thumbnailurl','attachment','picture','foto'],part:['mediaurl','imageurl','thumbnail','afbeelding']}
];
function columnProfile(rows,hi,ci){
  const vals=rows.slice(hi+1,hi+201).map(r=>r[ci]).filter(v=>v!==undefined&&String(v).trim()!=='');
  const nums=vals.filter(v=>parseNumber(v)!==null&&!/[a-z]{3,}/i.test(String(v).replace(/\b(k|m|mln|usd|eur)\b/gi,'')));
  const avgLen=vals.length?sum(vals.map(v=>String(v).length))/vals.length:0;
  return {filled:vals.length,numeric:vals.length?nums.length/vals.length:0,avgLen};
}
function headerScore(row){let s=0;const h=row.map(norm);for(const f of FIELDS){if(h.some(v=>f.exact.includes(v)))s+=f.req?3:1;else if(h.some(v=>v.length<40&&f.part.some(p=>v.includes(p))))s+=f.req?2:.5;}return s;}
function detect(sheets){
  let best=null;
  sheets.forEach((sh,si)=>{for(let i=0;i<Math.min(sh.rows.length,30);i++){const sc=headerScore(sh.rows[i]);const dataRows=sh.rows.length-i-1;if(sc<=0)continue;const total=sc*1000+Math.min(dataRows,999);if(!best||total>best.total)best={si,hi:i,total};}});
  if(!best){const si=sheets.reduce((b,s,i)=>s.rows.length>sheets[b].rows.length?i:b,0);best={si,hi:0};}
  const rows=sheets[best.si].rows;return {sheet:best.si,header:best.hi,mapping:autoMap(rows,best.hi)};
}
function autoMap(rows,hi){
  const head=(rows[hi]||[]).map(norm);const width=Math.max(head.length,...rows.slice(hi,hi+20).map(r=>r.length));
  const used=new Set(),map={};const prof=[];for(let c=0;c<width;c++)prof[c]=columnProfile(rows,hi,c);
  for(const f of FIELDS){
    const cands=[];
    head.forEach((h,c)=>{if(used.has(c)||!h)return;const ex=f.exact.indexOf(h);if(ex>=0)cands.push({c,rank:ex});else{const pi=f.part.findIndex(p=>h.includes(p));if(pi>=0&&h.length<45)cands.push({c,rank:100+pi});}});
    let ok=cands.filter(x=>{const p=prof[x.c];if(!p||!p.filled)return false;if(['views','revenue','reactions','comments','shares','reposts'].includes(f.key))return p.numeric>=.6;if(f.key==='text')return p.numeric<.5;return true;});
    if(f.key==='text'){
      ok.sort((a,b)=>prof[b.c].avgLen-prof[a.c].avgLen);
      if(!ok.length||prof[ok[0].c].avgLen<15){const any=prof.map((p,c)=>({c,p})).filter(x=>!used.has(x.c)&&x.p.filled&&x.p.numeric<.3&&x.p.avgLen>=40).sort((a,b)=>b.p.avgLen-a.p.avgLen);ok=any.length?[{c:any[0].c}]:ok;}
    }else ok.sort((a,b)=>a.rank-b.rank);
    map[f.key]=ok.length?ok[0].c:-1;if(map[f.key]>=0)used.add(map[f.key]);
  }
  return map;
}

/* ---------- records ---------- */
let records=[],meta=null,pending=null;
function buildRecords(rows,hi,map){
  const out=[],seen=new Set();let skipped=0;
  const get=(r,k)=>map[k]>=0?r[map[k]]:undefined;
  for(const r of rows.slice(hi+1)){
    const text=String(get(r,'text')??'').trim();const views=parseNumber(get(r,'views'));
    if(text.length<3||views===null||views<0){skipped++;continue;}
    const link=String(get(r,'link')??'').trim();const d=parseDate(get(r,'date'));
    const key=link?'L|'+link:d?'D|'+d.toISOString()+'|'+text.slice(0,140):null;
    if(key){if(seen.has(key)){skipped++;continue;}seen.add(key);}
    const num=k=>{if(map[k]<0)return null;const n=parseNumber(get(r,k));return n===null?null:n;};
    const words=text.split(/\s+/).filter(Boolean).length;
    out.push({text,hook:hookOf(text),views,revenue:num('revenue'),reactions:num('reactions'),comments:num('comments'),shares:num('shares'),reposts:num('reposts'),date:d?d.toISOString():null,type:String(get(r,'type')??'').trim(),link,media:String(get(r,'media')??'').trim(),words});
  }
  return {out,skipped};
}
function enrich(){for(const r of records){r.cat=categorize(r.text,r.hook)[0];r.period=periodOf(r.text);r.len=lengthBucket(r.words);r.eng=engagementOf(r);}buildIndex();}
function engagementOf(r){const parts=[r.reactions,r.comments,r.shares,r.reposts].filter(x=>x!==null);if(!parts.length||!r.views)return null;return sum(parts)/r.views*1000;}
const hasField=k=>records.some(r=>r[k]!==null&&r[k]!==undefined&&r[k]!=='');

/* ---------- opslag (IndexedDB, met nette terugval) ---------- */
function idb(){return new Promise((ok,fail)=>{if(!('indexedDB' in window))return fail(Error('geen IndexedDB'));const q=indexedDB.open('hce-perf',1);q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>ok(q.result);q.onerror=()=>fail(q.error);});}
async function store(value){try{const db=await idb();await new Promise((ok,fail)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(value,'perf');tx.oncomplete=ok;tx.onerror=()=>fail(tx.error);});return true;}catch(e){console.warn(e);return false;}}
async function restore(){try{const db=await idb();return await new Promise((ok,fail)=>{const q=db.transaction('kv').objectStore('kv').get('perf');q.onsuccess=()=>ok(q.result||null);q.onerror=()=>fail(q.error);});}catch(e){return null;}}

/* ---------- import-UI ---------- */
function setStatus(m,err){const el=$('perfStatus');el.textContent=m;el.classList.toggle('err',!!err);}
function fillMapping(){
  const {sheets,sheet,header,mapping}=pending;
  const sel=$('perfSheet');sel.replaceChildren(...sheets.map((s,i)=>{const o=document.createElement('option');o.value=i;o.textContent=s.name+' ('+s.rows.length+' rijen)';return o;}));sel.value=String(sheet);
  $('perfHeaderRow').value=header+1;
  const rows=sheets[sheet].rows,head=rows[header]||[],width=Math.max(head.length,...rows.slice(header,header+10).map(r=>r.length));
  const box=$('perfMapFields');box.replaceChildren();
  for(const f of FIELDS){
    const wrap=document.createElement('div');const l=document.createElement('label');l.textContent=f.label+(f.req?' *':'');l.htmlFor='perfMap_'+f.key;
    const s=document.createElement('select');s.id='perfMap_'+f.key;
    const opts=f.req?[]:[[-1,'— niet aanwezig —']];
    for(let c=0;c<width;c++){const sample=String(rows[header+1]?.[c]??'').replace(/\s+/g,' ').slice(0,40);opts.push([c,(String(head[c]??'').trim()||'Kolom '+(c+1))+(sample?' — '+sample:'')]);}
    for(const [v,t] of opts){const o=document.createElement('option');o.value=v;o.textContent=t;s.append(o);}
    s.value=String(mapping[f.key]>=0?mapping[f.key]:(f.req?0:-1));
    s.onchange=()=>{pending.mapping[f.key]=Number(s.value);};
    wrap.append(l,s);box.append(wrap);
  }
  $('perfMapping').hidden=false;
}
$('perfSheet').onchange=()=>{pending.sheet=Number($('perfSheet').value);pending.header=detectHeader(pending.sheets[pending.sheet].rows);pending.mapping=autoMap(pending.sheets[pending.sheet].rows,pending.header);fillMapping();};
$('perfHeaderRow').onchange=()=>{const h=Math.max(0,Number($('perfHeaderRow').value)-1);pending.header=Math.min(h,Math.max(0,pending.sheets[pending.sheet].rows.length-2));pending.mapping=autoMap(pending.sheets[pending.sheet].rows,pending.header);fillMapping();};
function detectHeader(rows){let b=0,bs=-1;for(let i=0;i<Math.min(rows.length,30);i++){const s=headerScore(rows[i]);if(s>bs){bs=s;b=i;}}return b;}
async function commit(){
  const {sheets,sheet,header,mapping,fileName}=pending;
  if(mapping.text<0||mapping.views<0)throw Error('Kies een kolom voor posttekst én views.');
  if(mapping.text===mapping.views)throw Error('Posttekst en views kunnen niet dezelfde kolom zijn.');
  const {out,skipped}=buildRecords(sheets[sheet].rows,header,mapping);
  if(!out.length)throw Error('Geen bruikbare posts gevonden: elke rij heeft tekst én een getal bij views nodig. Controleer de kolommen en de rij met kolomnamen.');
  records=out;enrich();
  const head=sheets[sheet].rows[header]||[];const named=Object.fromEntries(FIELDS.map(f=>[f.key,mapping[f.key]>=0?String(head[mapping[f.key]]??('Kolom '+(mapping[f.key]+1))):'']));
  meta={fileName,sheetName:sheets[sheet].name,importedAt:new Date().toISOString(),columns:named,skipped,mapping,header,sheet};
  const saved=await store({records,meta});
  $('perfMapping').hidden=true;$('perfRemap').hidden=false;
  const viewsCol=named.views;const reachNote=/reach|bereik|impression|vertoning/i.test(viewsCol)?' Let op: "'+viewsCol+'" is als views gebruikt.':'';
  setStatus(records.length+' posts geïmporteerd uit "'+meta.sheetName+'"'+(skipped?' ('+skipped+' rijen overgeslagen: lege tekst, geen views of dubbel)':'')+'. Gekoppeld: tekst = '+named.text+', views = '+viewsCol+(named.revenue?', inkomsten = '+named.revenue:', geen inkomstenkolom')+(named.shares?', shares = '+named.shares:'')+'.'+reachNote+(saved?' Opgeslagen in deze browser.':' Let op: niet opgeslagen; na herladen opnieuw importeren.'));
  afterData();
}
$('perfFile').addEventListener('change',async e=>{
  const f=e.target.files[0];if(!f)return;
  setStatus('Bestand lezen: '+f.name+'…');
  try{
    const sheets=await readFile(f);
    if(!sheets.some(s=>s.rows.length>1))throw Error('Het bestand bevat geen gegevensrijen.');
    const d=detect(sheets);pending={sheets,fileName:f.name,...d};
    if(d.mapping.text<0||d.mapping.views<0){fillMapping();setStatus('Niet alle kolommen automatisch herkend'+(d.mapping.text<0?' (posttekst)':'')+(d.mapping.views<0?' (views)':'')+'. Kies ze hieronder en tik op Import bevestigen.',true);return;}
    await commit();
  }catch(err){setStatus('Import mislukt: '+err.message,true);console.error(err);}
  finally{e.target.value='';}
});
$('perfConfirmMap').onclick=async()=>{try{if(!pending)throw Error('Kies eerst een bestand.');await commit();}catch(e){setStatus(e.message,true);}};
$('perfCancelMap').onclick=()=>{$('perfMapping').hidden=true;};
$('perfRemap').onclick=()=>{if(pending){fillMapping();return;}setStatus('Kies het bestand opnieuw om de koppeling aan te passen; de app bewaart alleen de ingelezen posts, niet het originele bestand.',true);};
$('perfClear').onclick=async()=>{if(records.length&&!confirm('Geïmporteerde prestatiegegevens uit deze browser wissen?'))return;records=[];meta=null;pending=null;await store(null);$('perfRemap').hidden=true;setStatus('Import gewist. De voorlopige referentiewaarden zijn weer actief.');afterData();};

/* ---------- dashboard ---------- */
const TOP={views:{label:'Views',val:r=>r.views,fmt:compact},revenue:{label:'Inkomsten',val:r=>r.revenue,fmt:v=>money(v)},shares:{label:'Shares',val:r=>r.shares,fmt:v=>nl(v)},rpm:{label:'RPM',val:r=>r.revenue!==null&&r.views>=MIN_RPM_VIEWS()?r.revenue/r.views*1000:null,fmt:v=>money(v)},engagement:{label:'Eng./1.000',val:r=>r.views>=MIN_RPM_VIEWS()?r.eng:null,fmt:v=>nl(v,1)}};
function MIN_RPM_VIEWS(){const m=median(records.map(r=>r.views));return Math.max(1000,m||0);}
let topMetric='views';
$('topMetric').addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(!b)return;topMetric=b.dataset.m;$('topMetric').querySelectorAll('[data-m]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));drawTop();});
function table(el,head,rows,opts={}){
  const t=$(el);t.replaceChildren();
  const thead=document.createElement('thead'),tr=document.createElement('tr');
  head.forEach((h,i)=>{const th=document.createElement('th');th.textContent=h;if(opts.num?.includes(i))th.className='num';tr.append(th);});thead.append(tr);t.append(thead);
  const tb=document.createElement('tbody');
  if(!rows.length){const r=document.createElement('tr'),td=document.createElement('td');td.colSpan=head.length;td.textContent=opts.empty||'Geen gegevens.';r.append(td);tb.append(r);}
  for(const row of rows){const r=document.createElement('tr');row.cells.forEach((c,i)=>{const td=document.createElement('td');if(c instanceof Node)td.append(c);else td.textContent=c;if(opts.num?.includes(i))td.className='num';r.append(td);});if(row.onclick){r.className='clickable';r.onclick=()=>row.onclick(r);}tb.append(r);}
  t.append(tb);
}
function barCell(value,max,label,low){const f=document.createDocumentFragment();const b=document.createElement('span');b.className='bar'+(low?' low':'');b.style.width=Math.max(2,Math.round(Math.min(1,(value||0)/(max||1))*70))+'px';f.append(b,document.createTextNode(label));return f;}
function groupStats(keyFn){
  const overall=median(records.map(r=>r.views))||1;const revAll=records.filter(r=>r.revenue!==null);
  const overallRpm=revAll.length?sum(revAll.map(r=>r.revenue))/Math.max(1,sum(revAll.map(r=>r.views)))*1000:null;
  const groups=new Map();for(const r of records){const k=keyFn(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  return [...groups].map(([name,rs])=>{
    const rev=rs.filter(r=>r.revenue!==null);const revSum=rev.length?sum(rev.map(r=>r.revenue)):null;
    const rpm=rev.length?revSum/Math.max(1,sum(rev.map(r=>r.views)))*1000:null;
    const sh=rs.filter(r=>r.shares!==null&&r.views>0);const shareRate=sh.length?sum(sh.map(r=>r.shares))/sum(sh.map(r=>r.views))*1000:null;
    return {name,n:rs.length,median:median(rs.map(r=>r.views)),index:median(rs.map(r=>r.views))/overall,revenue:revSum,rpm,rpmIndex:rpm!==null&&overallRpm?rpm/overallRpm:null,shareRate,avgRev:rev.length?revSum/rev.length:null,low:rs.length<MIN_GROUP};
  });
}
function drawGroupTable(el,keyFn,empty){
  const g=groupStats(keyFn).sort((a,b)=>(a.low-b.low)||(b.index-a.index));const mx=Math.max(...g.map(x=>x.index),1);const rev=hasField('revenue'),sh=hasField('shares');
  const head=['Groep','Posts','Mediane views','Index'];if(rev)head.push('Inkomsten','RPM');if(sh)head.push('Shares/1.000');
  table(el,head,g.map(x=>{const name=document.createElement('span');name.textContent=x.name;if(x.low){const l=document.createElement('span');l.className='lowdata';l.textContent='weinig data';name.append(l);}
    const c=[name,nl(x.n),compact(x.median),barCell(x.index,mx,nl(x.index,2),x.low)];if(rev)c.push(money(x.revenue,0),money(x.rpm));if(sh)c.push(nl(x.shareRate,1));return {cells:c};}),{num:[1,2,4,5,6],empty});
  return g;
}
function drawTop(){
  const m=TOP[topMetric];const rows=records.map(r=>({r,v:m.val(r)})).filter(x=>x.v!==null&&x.v!==undefined&&isFinite(x.v)).sort((a,b)=>b.v-a.v).slice(0,20);
  $('topNote').textContent=topMetric==='rpm'||topMetric==='engagement'?'Alleen posts met minimaal '+nl(MIN_RPM_VIEWS())+' views (mediaan), zodat kleine aantallen niet domineren. Tik op een rij voor de volledige tekst.':'Tik op een rij voor de volledige tekst.';
  const date=r=>r.date?r.date.slice(0,10):'';
  const extra=topMetric!=='views';
  table('topTable',['#','Post','Onderwerp',m.label].concat(extra?['Views']:[]),rows.map((x,i)=>{const sp=document.createElement('span');sp.textContent=x.r.hook;const d=document.createElement('span');d.className='why';d.textContent=[date(x.r),x.r.period,x.r.type].filter(Boolean).join(' · ');sp.append(d);
    return {cells:[String(i+1),sp,x.r.cat,m.fmt(x.v)].concat(extra?[compact(x.r.views)]:[]),onclick:(tr)=>{const exp=tr.classList.toggle('expanded');sp.firstChild.textContent=exp?x.r.text:x.r.hook;}};}),{num:[3,4],empty:hasField(topMetric==='rpm'?'revenue':topMetric==='engagement'?'views':topMetric)?'Geen posts met genoeg data.':'Deze kolom zit niet in je import.'});
}
function drawScatter(){
  const box=$('scatter');box.replaceChildren();const pts=records.filter(r=>r.revenue!==null&&r.views>0);
  if(pts.length<10){box.textContent=hasField('revenue')?'Te weinig posts met inkomsten voor een grafiek.':'Geen inkomstenkolom geïmporteerd.';return;}
  const W=640,H=300,L=56,B=36,T=12,R=12;const xs=pts.map(p=>Math.log10(p.views)),ys=pts.map(p=>p.revenue);
  const x0=Math.floor(Math.min(...xs)),x1=Math.ceil(Math.max(...xs));const rawStep=(quant(ys,.99)*1.05||1)/4,mag=10**Math.floor(Math.log10(rawStep)),y1=4*mag*[1,2,2.5,3,4,5,6,8,10].find(f=>f*mag>=rawStep);
  const X=v=>L+(Math.log10(v)-x0)/(x1-x0||1)*(W-L-R),Y=v=>H-B-Math.min(v,y1)/y1*(H-B-T);
  const NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('role','img');svg.setAttribute('aria-label','Spreidingsdiagram views tegen inkomsten per post');
  const el=(n,a)=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);svg.append(e);return e;};
  for(let p=x0;p<=x1;p++){el('line',{x1:X(10**p),x2:X(10**p),y1:T,y2:H-B,stroke:'#E6E4DE','stroke-width':1});const t=el('text',{x:X(10**p),y:H-B+18,'text-anchor':'middle','font-size':11,fill:'#6E756F'});t.textContent=compact(10**p);}
  for(let i=0;i<=4;i++){const v=y1*i/4;el('line',{x1:L,x2:W-R,y1:Y(v),y2:Y(v),stroke:'#E6E4DE','stroke-width':1});const t=el('text',{x:L-6,y:Y(v)+4,'text-anchor':'end','font-size':11,fill:'#6E756F'});t.textContent='$'+nl(v,v<10?1:0);}
  const tip=document.createElement('div');tip.className='tip';
  for(const p of pts){const c=el('circle',{cx:X(p.views),cy:Y(p.revenue),r:4,fill:'#2E796C','fill-opacity':.55,stroke:'#fff','stroke-width':1});
    const show=ev=>{tip.style.display='block';tip.textContent=p.hook.slice(0,110)+' — '+compact(p.views)+' views · '+money(p.revenue)+' · '+p.cat;const bb=box.getBoundingClientRect();const cx=(ev.touches?ev.touches[0].clientX:ev.clientX)-bb.left,cy=(ev.touches?ev.touches[0].clientY:ev.clientY)-bb.top;tip.style.left=Math.min(bb.width-245,Math.max(0,cx+10))+'px';tip.style.top=Math.max(0,cy-50)+'px';};
    c.addEventListener('mouseenter',show);c.addEventListener('click',show);c.addEventListener('mouseleave',()=>{tip.style.display='none';});}
  box.append(svg,tip);
}
function adviceList(cats,periods){
  const out=[];const solid=cats.filter(c=>!c.low&&c.name!=='Overig');
  const up=solid.filter(c=>c.index>=1.15).sort((a,b)=>b.index-a.index),down=solid.filter(c=>c.index<=.85).sort((a,b)=>a.index-b.index);
  if(up.length)out.push('Verdienen vaker een plek in de batch: '+up.map(c=>c.name+' (index '+nl(c.index,2)+', '+c.n+' posts)').join(', ')+'.');
  if(down.length)out.push('Presteren structureel onder het gemiddelde: '+down.map(c=>c.name+' (index '+nl(c.index,2)+', '+c.n+' posts)').join(', ')+'. Alleen kiezen met een sterke hook of nieuwswaarde.');
  const rpmUp=solid.filter(c=>c.rpmIndex!==null&&c.rpmIndex>=1.2).sort((a,b)=>b.rpmIndex-a.rpmIndex);
  if(rpmUp.length)out.push('Relatief hoge opbrengst per 1.000 views: '+rpmUp.map(c=>c.name+' (RPM '+money(c.rpm)+')').join(', ')+'.');
  const ps=periods.filter(p=>!p.low&&p.name!=='Onbekend').sort((a,b)=>b.index-a.index);
  if(ps.length>=2)out.push('Sterkste periode: '+ps[0].name+' (index '+nl(ps[0].index,2)+'); zwakste: '+ps[ps.length-1].name+' (index '+nl(ps[ps.length-1].index,2)+').');
  if(!out.length)out.push('Nog geen harde conclusies: de verschillen zijn klein of de groepen bevatten minder dan '+MIN_GROUP+' posts.');
  out.push('Dit zijn waarnemingen uit het verleden, geen garanties. Bereik hangt ook af van timing, beeld en het algoritme.');
  return out;
}
function renderDashboard(){
  const dash=$('dash');if(!records.length){dash.hidden=true;return;}dash.hidden=false;
  const views=records.map(r=>r.views),rev=records.filter(r=>r.revenue!==null),totalRev=rev.length?sum(rev.map(r=>r.revenue)):null;
  const revViews=sum(rev.map(r=>r.views));const eng=records.filter(r=>r.eng!==null);const sh=records.filter(r=>r.shares!==null);
  const k=[[nl(records.length),'Posts'],[compact(sum(views)),'Totale views'],[compact(median(views)),'Mediane views'],[money(totalRev,0),'Gemeten inkomsten'],[money(rev.length?totalRev/rev.length:null),'Gem. inkomsten per post'],[money(rev.length?totalRev/Math.max(1,revViews)*1000:null),'RPM (per 1.000 views)'],[sh.length?nl(sum(sh.map(r=>r.shares))/Math.max(1,sum(sh.map(r=>r.views)))*1000,1):'—','Shares per 1.000 views'],[eng.length?nl(median(eng.map(r=>r.eng)),1):'—','Engagement per 1.000 (mediaan)']];
  $('dashKpis').replaceChildren(...k.map(([v,l])=>{const d=document.createElement('div');d.className='perf-stat';const s=document.createElement('strong');s.textContent=v;const sm=document.createElement('small');sm.textContent=l;d.append(s,sm);return d;}));
  const dates=records.map(r=>r.date).filter(Boolean).sort();
  const missing=FIELDS.filter(f=>!f.req&&['revenue','shares','comments','reactions','date'].includes(f.key)&&!hasField(f.key)).map(f=>f.label.toLowerCase());
  $('dashNotes').textContent=(meta?'Bron: '+meta.fileName+' · tabblad '+meta.sheetName+'. ':'')+(dates.length?'Periode '+dates[0].slice(0,10)+' t/m '+dates[dates.length-1].slice(0,10)+'. ':'')+(rev.length<records.length&&rev.length?(records.length-rev.length)+' posts zonder inkomsten tellen niet mee in RPM. ':'')+(missing.length?'Niet in deze export: '+missing.join(', ')+'.':'');
  drawTop();
  const cats=drawGroupTable('catTable',r=>r.cat);
  const periods=drawGroupTable('periodTable',r=>r.period);
  drawScatter();
  const rg=groupStats(r=>r.cat).filter(g=>g.rpm!==null&&!g.low).sort((a,b)=>b.rpm-a.rpm);
  table('rpmTable',['Onderwerp (min. '+MIN_GROUP+' posts)','RPM','Gem. per post','Mediane views'],rg.map(g=>({cells:[g.name,money(g.rpm),money(g.avgRev),compact(g.median)]})),{num:[1,2,3],empty:hasField('revenue')?'Te weinig posts per onderwerp met inkomsten.':'Geen inkomstenkolom geïmporteerd.'});
  const fmtRows=[];if(records.some(r=>r.type))fmtRows.push(...groupStats(r=>'Type: '+(r.type||'onbekend')));fmtRows.push(...groupStats(r=>r.len).sort((a,b)=>a.name.localeCompare(b.name)));
  const fmx=Math.max(...fmtRows.map(x=>x.index),1);const rev2=hasField('revenue');
  table('formatTable',['Format','Posts','Mediane views','Index'].concat(rev2?['RPM']:[]),fmtRows.map(x=>({cells:[x.name+(x.low?' (weinig data)':''),nl(x.n),compact(x.median),barCell(x.index,fmx,nl(x.index,2),x.low)].concat(rev2?[money(x.rpm)]:[])})),{num:[1,2,4]});
  const hasSh=hasField('shares');const overall=median(views)||1;
  const feat=HOOK_FEATURES.map(([name,fn])=>{const yes=records.filter(r=>fn(r.hook));const rate=rs=>{const s=rs.filter(r=>r.shares!==null&&r.views>0);return s.length?sum(s.map(r=>r.shares))/sum(s.map(r=>r.views))*1000:null;};return {name,n:yes.length,index:yes.length?median(yes.map(r=>r.views))/overall:null,share:rate(yes),low:yes.length<MIN_GROUP};});
  const fx=Math.max(...feat.map(f=>f.index||0),1);
  table('hookFeatTable',['Hookkenmerk','Posts','Views-index'].concat(hasSh?['Shares/1.000']:[]),feat.map(f=>({cells:[f.name+(f.low?' (weinig data)':''),nl(f.n),f.index===null?'—':barCell(f.index,fx,nl(f.index,2),f.low)].concat(hasSh?[nl(f.share,1)]:[])})),{num:[1,3]});
  const minV=median(views)||0;
  const hk=hasSh?records.filter(r=>r.shares!==null&&r.views>=minV).map(r=>({r,v:r.shares/r.views*1000})).sort((a,b)=>b.v-a.v).slice(0,20):[];
  table('hookTopTable',['Hook','Shares','Shares/1.000'],hk.map(x=>({cells:[x.r.hook,nl(x.r.shares),nl(x.v,1)]})),{num:[1,2],empty:hasSh?'Geen posts boven de mediaan.':'Geen shares-kolom geïmporteerd.'});
  const dated=records.filter(r=>r.date);$('timeSection').hidden=dated.length<30;
  if(dated.length>=30){const days=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];const hasTime=dated.some(r=>new Date(r.date).getHours()||new Date(r.date).getMinutes());
    const g=days.map((d,i)=>{const rs=dated.filter(r=>new Date(r.date).getDay()===i);return {name:d,n:rs.length,med:median(rs.map(r=>r.views))};});const mx=Math.max(...g.map(x=>x.med||0),1);
    const rows=g.map(x=>({cells:[x.name,nl(x.n),barCell(x.med,mx,compact(x.med),x.n<MIN_GROUP)]}));
    if(hasTime){for(const [lab,a,b] of [['00–06 uur',0,5],['06–12 uur',6,11],['12–18 uur',12,17],['18–24 uur',18,23]]){const rs=dated.filter(r=>{const h=new Date(r.date).getHours();return h>=a&&h<=b;});rows.push({cells:[lab,nl(rs.length),barCell(median(rs.map(r=>r.views))||0,mx,compact(median(rs.map(r=>r.views))),rs.length<MIN_GROUP)]});}}
    table('dayTable',['Dag / tijdvak','Posts','Mediane views'],rows,{num:[1]});}
  const ul=$('dashAdvice');ul.replaceChildren(...adviceList(cats,periods).map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
}
$('dashExport').onclick=()=>{if(!records.length)return;const head=['Hook','Onderwerp','Periode','Lengte','Views','Inkomsten','RPM','Reacties','Comments','Shares','Reposts','Engagement/1000','Datum','Type','Link'];
  const rows=records.map(r=>[r.hook,r.cat,r.period,r.len,r.views,r.revenue??'',r.revenue!==null&&r.views?(r.revenue/r.views*1000).toFixed(4):'',r.reactions??'',r.comments??'',r.shares??'',r.reposts??'',r.eng===null?'':r.eng.toFixed(2),r.date?r.date.slice(0,16):'',r.type,r.link]);
  saveBlob(new Blob(['\uFEFF'+[head,...rows].map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'TDA_performance_analyse.csv');};

/* ---------- gelijkenis met eerdere posts (TF-IDF) ---------- */
const STOP=new Set('the and was were with that this from they their have had for are not but his her its into after when who which what one all about been more there would could also than then them out over only most very just because while where some such these those other first new year years de het een van en op aan te voor met door bij was zijn waren werd worden dat die dit deze wie wat waar hoe toen ook niet maar had heeft hebben hij zij werd jaar jaren nog naar uit over dan als wel zo'.split(' '));
let IDX=null;
const stem=w=>{const x=w.replace(/(ings|ing|ed|es|en|s|e)$/,'');return x.length>=4?x:w;};
function toks(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/https?:\/\/\S+/g,' ').replace(/#[\w]+/g,' ').split(/[^a-z0-9]+/).filter(w=>w.length>2&&!STOP.has(w)&&!/^\d{1,2}$/.test(w)).map(stem);}
function vec(tokens){const m=new Map();for(const w of tokens)m.set(w,(m.get(w)||0)+1);return m;}
function buildIndex(){
  if(!records.length){IDX=null;return;}
  const df=new Map();const full=records.map(r=>vec(toks(r.hook+' '+r.text.slice(0,600)))),heads=records.map(r=>vec(toks(r.hook)));
  for(const v of full)for(const w of v.keys())df.set(w,(df.get(w)||0)+1);
  const N=records.length,idf=w=>Math.log((N+1)/((df.get(w)||0)+1))+1;
  const weigh=v=>{const o=new Map();let n=0;for(const [w,c] of v){const x=(1+Math.log(c))*idf(w);o.set(w,x);n+=x*x;}return {v:o,n:Math.sqrt(n)||1};};
  IDX={idf,full:full.map(weigh),heads:heads.map(weigh)};
}
function cosineBest(text,docs){
  const v=vec(toks(text));const q=new Map();let qn=0;for(const [w,c] of v){const x=(1+Math.log(c))*IDX.idf(w);q.set(w,x);qn+=x*x;}qn=Math.sqrt(qn)||1;if(!q.size)return {s:0,i:-1};
  let s=-1,i=-1;docs.forEach((d,k)=>{let dot=0;for(const [w,x] of q){const y=d.v.get(w);if(y)dot+=x*y;}const c=dot/(qn*d.n);if(c>s){s=c;i=k;}});return {s,i};
}
/* Vergelijkt zowel de hook (kort, onderscheidend) als de hook + begin van de caption. */
function mostSimilar(hook,caption){
  if(!IDX)return null;const a=cosineBest(hook,IDX.heads),b=cosineBest(hook+' '+String(caption||'').slice(0,600),IDX.full);
  const best=a.s>=b.s?a:b;return best.i>=0?{sim:best.s,rec:records[best.i]}:null;
}

/* ---------- rangschikking van de batch ---------- */
function categoryModel(){
  const overall=median(records.map(r=>r.views))||null;const revAll=records.filter(r=>r.revenue!==null&&r.views>0);
  const overallRpm=revAll.length?sum(revAll.map(r=>r.revenue))/sum(revAll.map(r=>r.views))*1000:null;const model={};
  for(const [name,base] of CATS.concat([['Overig',null]])){
    const rs=records.filter(r=>r.cat===name&&r.views>0);const med=median(rs.map(r=>r.views));
    const emp=med&&overall?Math.max(.35,Math.min(2.2,med/overall)):null;const w=rs.length/(rs.length+20);
    const prior=base??1;const reach=emp===null?prior:prior*(1-w)+emp*w;
    const rv=rs.filter(r=>r.revenue!==null);const rpm=rv.length?sum(rv.map(r=>r.revenue))/sum(rv.map(r=>r.views))*1000:null;
    const rw=rv.length/(rv.length+20);const rpmIdx=rpm!==null&&overallRpm?1*(1-rw)+(rpm/overallRpm)*rw:null;
    model[name]={reach,n:rs.length,emp,base,rpm,rpmIdx,nRev:rv.length};
  }
  return {model,p75:quant(records.map(r=>r.views),.75)};
}
function imagePotential(it){
  if(it.localMain)return [1,'eigen beeld'];
  const u=it.sourceImageUrl||'';
  if(/(upload|thumb)\.wikimedia\.org|commons\.wikimedia\.org\/wiki\/(File|Special)/i.test(u))return [.95,'Wikimedia-beeld'];
  if(/\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(u))return [.85,'directe beeldlink'];
  if(u)return [.7,'beeldlink'];
  if(/\/wiki\/(File|Bestand):/i.test(it.imageSourceUrl||''))return [.8,'Commons-bronpagina'];
  if(it.imageSourceUrl)return [.5,'alleen bronpagina'];
  if(it.isAi)return [.35,'reconstructie, geen echt beeld'];
  return [.15,'geen beeld'];
}
function hookQuality(it){
  if(it.brand==='dutch'){const h=String(it.imageHook||'').trim();const story=String(it.imageStory||'').trim().split(/\s+/).filter(Boolean).length;let q=1;if(!h)q-=.6;else if(h.length>100)q-=.35;else if(h.length<20)q-=.2;if(story<40||story>60)q-=.2;return Math.max(0,q);}
  return hookScore(it)/100;
}
function onThisDay(it){
  const d=it.scheduledDate?new Date(it.scheduledDate+'T12:00:00'):null;if(!d)return false;
  const day=d.getDate(),mEN=d.toLocaleString('en-GB',{month:'long'}),mNL=d.toLocaleString('nl-NL',{month:'long'});
  const t=(it.imageHook+' '+it.facebookCaption).toLowerCase();
  return new RegExp('\\b'+day+'(st|nd|rd|th)?\\s+('+mEN+'|'+mNL+')\\b','i').test(t)||new RegExp('\\b('+mEN+')\\s+'+day+'\\b','i').test(t)||/\bon this day\b|\bvandaag in\b/i.test(t);
}
function scoreBatch(){
  const batch=typeof BULK!=='undefined'?BULK:[];const {model,p75}=categoryModel();
  for(const it of batch){
    const reasons=[];const text=[it.imageHook,it.facebookCaption].join(' ');const [cat]=categorize(text,[it.title,it.imageHook].join(' '));const m=model[cat]||{reach:1,n:0};
    const perfNorm=Math.max(0,Math.min(1,(m.reach-.4)/1.4));
    reasons.push(cat+': '+(m.n?'index '+nl(m.reach,2)+' uit '+m.n+' eigen posts':(m.base?'referentie '+nl(m.base,2)+' (nog geen eigen data)':'neutraal (geen data)')));
    const rpmNorm=m.rpmIdx===null||m.rpmIdx===undefined?.5:Math.max(0,Math.min(1,(m.rpmIdx-.4)/1.4));
    if(m.rpmIdx!=null)reasons.push('RPM-index '+nl(m.rpmIdx,2));
    const [img,imgWhy]=imagePotential(it);reasons.push('beeld: '+imgWhy);
    const hq=hookQuality(it);reasons.push('hook '+Math.round(hq*100)+'/100');
    const ver=String(it.verificationSources||it.verification||'').trim()?1:.4;if(ver<1)reasons.push('verificatiebron ontbreekt');
    let score=100*(.45*perfNorm+.15*rpmNorm+.15*img+.15*hq+.10*ver);
    if(onThisDay(it)){score+=5;reasons.push('past bij publicatiedatum (+5)');}
    const allowRepeat=/DOUBLE-DOWN|NEW ANGLE/i.test(it.classification||'');
    const sim=mostSimilar(it.imageHook||it.title||'',it.facebookCaption);
    let similar=null;
    if(sim&&sim.sim>=.28){similar={sim:sim.sim,views:sim.rec.views,text:sim.rec.hook,date:sim.rec.date};
      if(sim.sim>=.45&&!allowRepeat){score*=.6;reasons.push('lijkt sterk op eerdere post ('+compact(sim.rec.views)+' views) −40%');}
      else if(sim.sim>=.45&&allowRepeat)reasons.push('bewust herhaald onderwerp ('+it.classification+')');
      else if(p75&&sim.rec.views>=p75)reasons.push('verwant aan een eerdere toppost');}
    if(it.duplicateOf){score*=.5;reasons.push('dubbel in deze batch −50%');}
    else if(it.historyDuplicate&&!allowRepeat){score*=.7;reasons.push('eerder geëxporteerd −30%');}
    it.perf={score:Math.round(Math.max(0,Math.min(100,score))),category:cat,reasons,similar};
  }
  return batch;
}
function drawRanking(){
  const batch=typeof BULK!=='undefined'?BULK:[];const tb=$('perfResults');tb.replaceChildren();
  if(!batch.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent='Nog geen batch ingelezen.';tr.append(td);tb.append(tr);}
  const order=[...batch].sort((a,b)=>(b.perf?.score??0)-(a.perf?.score??0));
  order.forEach((it,i)=>{const tr=document.createElement('tr');if(it.slot)tr.className='sel-'+it.slot;
    const n=document.createElement('td');n.textContent=String(i+1);
    const t=document.createElement('td');t.textContent=(it.imageHook||it.title||'Zonder hook').slice(0,110);const w=document.createElement('span');w.className='why';w.textContent=(it.slot?({main:'Hoofdpost',reserve:'Reserve',out:'Niet geselecteerd'}[it.slot]+' · '):'')+(it.perf?.reasons||[]).join(' · ');t.append(w);
    const s=document.createElement('td');s.className='num';s.textContent=it.perf?String(it.perf.score):'—';tr.append(n,t,s);tb.append(tr);});
  const src=records.length?records.length+' eigen posts uit '+(meta?.fileName||'je import'):'voorlopige referentiewaarden (nog geen RepostHQ-import)';
  const sel=batch.filter(x=>x.slot==='main').length,res=batch.filter(x=>x.slot==='reserve').length;
  $('selStatus').textContent=batch.length?(batch.length+' onderwerpen gescoord op basis van '+src+'.'+(sel?' Geselecteerd: '+sel+' hoofdposts en '+res+' reserves.':'')):'Lees eerst een batch in.';
}
let originalOrder=null;
function rankOnly(){scoreBatch();drawRanking();if(typeof drawBulkList==='function')drawBulkList();}
function selectBest(){
  const batch=typeof BULK!=='undefined'?BULK:[];if(!batch.length){bulkSet('Lees eerst een batch in.',true);return;}
  if(!originalOrder)originalOrder=batch.map(x=>x.id);
  scoreBatch();
  const sorted=[...batch].sort((a,b)=>(!!a.duplicateOf-!!b.duplicateOf)||(b.perf.score-a.perf.score));
  const main=Math.min(12,sorted.length),reserve=Math.min(5,Math.max(0,sorted.length-main));
  sorted.forEach((it,i)=>{const was=it.slot;it.slot=i<main?'main':i<main+reserve?'reserve':'out';if(was!==it.slot&&it.loadedImageBlob&&!it.dirtyImage){/* beeld blijft geldig */}});
  BULK.splice(0,BULK.length,...sorted);
  applySchedule(true);drawRanking();drawBulkList();$('perfUndo').hidden=false;
  const out=sorted.length-main-reserve;
  bulkSet('Selectie gemaakt: '+main+' hoofdposts en '+reserve+' reserves'+(out?' ('+out+' niet geselecteerd, blijven zichtbaar)':'')+'. Schema opnieuw berekend. Controleer de keuze voordat je verdergaat.');
}
function undoSelect(){
  if(!originalOrder)return;const byId=new Map(BULK.map(x=>[x.id,x]));const restored=originalOrder.map(id=>byId.get(id)).filter(Boolean);
  for(const x of BULK)if(!restored.includes(x))restored.push(x);
  restored.forEach(x=>{x.slot='';});BULK.splice(0,BULK.length,...restored);originalOrder=null;$('perfUndo').hidden=true;
  applySchedule(true);drawRanking();drawBulkList();bulkSet('Oorspronkelijke volgorde hersteld; selectie opgeheven.');
}
$('perfRank').onclick=rankOnly;$('perfSelect').onclick=selectBest;$('perfUndo').onclick=undoSelect;
$('perfExport').onclick=()=>{scoreBatch();const order=[...BULK].sort((a,b)=>b.perf.score-a.perf.score);
  const data=[['Rang','Selectie','Hook','Onderwerp','Score','Redenen','Lijkt op eerdere post','Views eerdere post'],...order.map((it,i)=>[i+1,it.slot||'',it.imageHook,it.perf.category,it.perf.score,it.perf.reasons.join(' | '),it.perf.similar?it.perf.similar.text:'',it.perf.similar?Math.round(it.perf.similar.views):''])];
  saveBlob(new Blob(['\uFEFF'+data.map(r=>r.map(esc).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'ranglijst-'+BRAND+'.csv');};
$('bulkParse').addEventListener('click',()=>{originalOrder=null;$('perfUndo').hidden=true;setTimeout(rankOnly,0);});

function afterData(){if(!$('pane-perf').classList.contains('is-on')){$('dash').hidden=!records.length;}else renderDashboard();if(typeof BULK!=='undefined'&&BULK.length)rankOnly();else drawRanking();}

window.HCE_PERF={renderDashboard,rankOnly,get records(){return records;},categorize,periodOf,parseNumber,readFile,detect,mostSimilar};

restore().then(v=>{if(v&&Array.isArray(v.records)&&v.records.length){records=v.records;meta=v.meta||null;enrich();$('perfRemap').hidden=false;setStatus(records.length+' posts geladen uit eerdere import'+(meta?' ('+meta.fileName+', '+String(meta.importedAt).slice(0,10)+')':'')+'.');afterData();}});
})();
