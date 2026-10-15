'use strict';
const DRUHY=['Beletria','Detektívka','Román','Fantasy','Sci-fi','Encyklopédia','Odborná','Životopis','Pre deti','Iné'];
const $=id=>document.getElementById(id);
let books=[],tab='neprecitane',editId=null,photoData=null;

/* ---------- IndexedDB ---------- */
const DB={db:null,
 open(){return new Promise((res,rej)=>{const r=indexedDB.open('kniznica',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('books',{keyPath:'id'});
  r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
 tx(m){return this.db.transaction('books',m).objectStore('books')},
 all(){return new Promise(r=>{const q=this.tx('readonly').getAll();q.onsuccess=()=>r(q.result||[])})},
 put(b){return new Promise(r=>{const q=this.tx('readwrite').put(b);q.onsuccess=()=>r()})},
 del(id){return new Promise(r=>{const q=this.tx('readwrite').delete(id);q.onsuccess=()=>r()})},
 clear(){return new Promise(r=>{const q=this.tx('readwrite').clear();q.onsuccess=()=>r()})}};

const today=()=>new Date().toISOString().slice(0,10);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>d?d.split('-').reverse().join('.'):'';
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',3000)}
const isRead=b=>b.stav==='precitane';
function allDruhy(){const s=new Set(DRUHY);books.forEach(b=>b.druh&&s.add(b.druh));return [...s]}

/* ---------- Render ---------- */
function render(){
 $('cntN').textContent='('+books.filter(b=>!isRead(b)).length+')';
 $('cntP').textContent='('+books.filter(isRead).length+')';
 $('tabNeprecitane').classList.toggle('active',tab==='neprecitane');
 $('tabPrecitane').classList.toggle('active',tab==='precitane');
 const fd=$('filterDruh'),cur=fd.value;
 fd.innerHTML='<option value="">Všetky druhy</option>'+allDruhy().map(d=>`<option>${esc(d)}</option>`).join('');fd.value=cur;
 const q=$('search').value.trim().toLowerCase();
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const nq=norm(q);
 const list=books.filter(b=>(tab==='precitane')===isRead(b))
  .filter(b=>!cur||b.druh===cur)
  .filter(b=>!nq||norm(b.nazov+' '+b.autor+' '+b.poznamka).includes(nq))
  .sort((a,b)=>(b.datumPrecitania||b.datumPridania||'').localeCompare(a.datumPrecitania||a.datumPridania||''));
 $('list').innerHTML=list.length?list.map(b=>`
 <div class="card" data-id="${b.id}">
  ${b.foto?`<img src="${b.foto}" alt="Obálka">`:'<div class="noimg">📕</div>'}
  <div class="info">
   <p class="t">${esc(b.nazov)}</p>
   <p class="a">${esc(b.autor)||'<i>autor neuvedený</i>'}</p>
   <p class="m">${esc(b.druh)}${b.stav==='citam'?' · 📖 práve čítam':''}${b.strana?' · strana '+esc(b.strana):''}</p>
   <p class="m">Pridané: ${fmt(b.datumPridania)}${b.datumPrecitania?' · Prečítané: '+fmt(b.datumPrecitania):''}</p>
   ${b.poznamka?`<p class="m">📝 ${esc(b.poznamka)}</p>`:''}
   <div class="acts">
    <button class="btn" data-act="move">${isRead(b)?'↩️ Do Neprečítaných':'✅ Prečítané'}</button>
    <button class="btn" data-act="edit">✏️ Upraviť</button>
    <button class="btn" data-act="del">🗑️ Zmazať</button>
   </div>
  </div></div>`).join(''):`<p class="empty">${q||cur?'Nič sa nenašlo.':'Zoznam je prázdny. Pridajte knihu tlačidlom hore.'}</p>`;
}
async function reload(){books=await DB.all();render()}

$('list').addEventListener('click',async e=>{
 const btn=e.target.closest('button');if(!btn)return;
 const b=books.find(x=>x.id===btn.closest('.card').dataset.id);
 if(btn.dataset.act==='move'){
  if(isRead(b)){b.stav='neprecitane';b.datumPrecitania=''}else{b.stav='precitane';b.datumPrecitania=b.datumPrecitania||today()}
  await DB.put(b);await reload();toast(isRead(b)?'Presunuté do Prečítaných':'Presunuté do Neprečítaných');
 }else if(btn.dataset.act==='edit')openForm(b);
 else if(btn.dataset.act==='del'){
  if(await confirmDlg(`Naozaj zmazať knihu „${b.nazov}“?`)){await DB.del(b.id);await reload();toast('Kniha zmazaná')}
 }
});
function confirmDlg(text){return new Promise(res=>{$('confirmText').textContent=text;const d=$('dlgConfirm');d.showModal();
 $('confirmYes').onclick=()=>{d.close();res(true)};$('confirmNo').onclick=()=>{d.close();res(false)}})}

/* ---------- Formulár ---------- */
function fillDruhSelect(sel){$('fDruh').innerHTML=allDruhy().filter(d=>d!=='Iné').concat(['Iné','+ Vlastný druh…']).map(d=>`<option>${esc(d)}</option>`).join('');$('fDruh').value=sel||'Beletria';$('wrapVlastny').hidden=true}
$('fDruh').onchange=()=>{$('wrapVlastny').hidden=$('fDruh').value!=='+ Vlastný druh…'};
function setPhoto(d){photoData=d||null;$('fFotoPrev').hidden=!d;$('btnFotoDel').hidden=!d;if(d)$('fFotoPrev').src=d}
function openForm(b){
 editId=b?b.id:null;$('formTitle').textContent=b?'Upraviť knihu':'Nová kniha';
 b=b||{stav:tab==='precitane'?'precitane':'neprecitane',datumPridania:today()};
 $('fNazov').value=b.nazov||'';$('fAutor').value=b.autor||'';fillDruhSelect(b.druh);
 $('fStav').value=b.stav||'neprecitane';$('fStrana').value=b.strana||'';$('fPoznamka').value=b.poznamka||'';
 $('fDatumPridania').value=b.datumPridania||today();$('fDatumPrecitania').value=b.datumPrecitania||'';
 $('lookupResults').innerHTML='';setPhoto(b.foto);$('dlgForm').showModal();
}
$('btnAdd').onclick=()=>openForm(null);
$('btnCancel').onclick=()=>$('dlgForm').close();
$('fStav').onchange=()=>{if($('fStav').value==='precitane'&&!$('fDatumPrecitania').value)$('fDatumPrecitania').value=today()};
$('bookForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const nazov=$('fNazov').value.trim();if(!nazov){toast('Zadajte názov knihy');$('fNazov').focus();return}
 let druh=$('fDruh').value;if(druh==='+ Vlastný druh…')druh=$('fDruhVlastny').value.trim()||'Iné';
 const old=books.find(x=>x.id===editId)||{};
 const b={...old,id:editId||uid(),nazov,autor:$('fAutor').value.trim(),druh,stav:$('fStav').value,
  strana:$('fStrana').value,poznamka:$('fPoznamka').value.trim(),datumPridania:$('fDatumPridania').value||today(),
  datumPrecitania:$('fDatumPrecitania').value,foto:photoData};
 if(b.stav==='precitane'&&!b.datumPrecitania)b.datumPrecitania=today();
 await DB.put(b);$('dlgForm').close();tab=isRead(b)?'precitane':'neprecitane';await reload();toast('Uložené: '+nazov);
});

/* ---------- Fotka: zmenšenie ---------- */
function compressImage(src,max=360,q=0.7){return new Promise((res,rej)=>{const img=new Image();img.crossOrigin='anonymous';
 img.onload=()=>{const s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');
  c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  try{res(c.toDataURL('image/jpeg',q))}catch(e){rej(e)}};img.onerror=rej;img.src=src})}
$('fFoto').onchange=async e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);
 try{setPhoto(await compressImage(url));toast('Fotka pridaná')}catch{toast('Fotku sa nepodarilo načítať')}URL.revokeObjectURL(url);e.target.value=''};
$('btnFotoDel').onclick=()=>setPhoto(null);

/* ---------- Diktovanie ---------- */
const GENRE_WORDS=[
 [/detekt[ií]vk|krimi/,'Detektívka'],[/fantas/,'Fantasy'],[/sci[\s-]?fi|sajfaj|science|vedeck[ée]j? fantast/,'Sci-fi'],
 [/encyklop/,'Encyklopédia'],[/odborn/,'Odborná'],[/[žz]ivotopis|biograf/,'Životopis'],[/pre deti|detsk/,'Pre deti'],
 [/rom[áa]n/,'Román'],[/beletri/,'Beletria']];
function parseSpeech(text){
 const r={};let t=' '+text.trim()+' ';
 // stav
 if(/nepre[čc][íi]tan/i.test(t)){r.stav='neprecitane';t=t.replace(/nepre[čc][íi]tan\S*/ig,' ')}
 else if(/pre[čc][íi]tan/i.test(t)){r.stav='precitane';t=t.replace(/(u[žz]\s+)?pre[čc][íi]tan\S*/ig,' ')}
 t=t.replace(/\s+/g,' ').replace(/\s+([,;.])/g,'$1').trim().replace(/[,;.]$/,'');
 const sm=t.match(/strana\s+(\d+)|strane\s+(\d+)/i);if(sm){r.strana=sm[1]||sm[2];t=t.replace(sm[0],' ')}
 const parts=t.split(/[,;.]| a druh | druh /i).map(s=>s.trim()).filter(Boolean);
 const rest=[];
 for(let p of parts){
  const am=p.match(/^(.*?)\b(?:autor(?:ka)?|od autora|napísal|napisal)\s+(.+)$/i);
  if(am){if(am[1].trim())rest.push(am[1].trim());p=am[2].trim();
   // žáner aj v rovnakej časti za autorom
   for(const [re,g] of GENRE_WORDS){const m=p.toLowerCase().match(new RegExp('\\s('+re.source+')\\S*$'));if(m){r.druh=g;p=p.slice(0,m.index).trim();break}}
   r.autor=cap(p);continue}
  const lp=p.toLowerCase();let g=null;
  for(const [re,gg] of GENRE_WORDS){if(re.test(lp)&&lp.split(/\s+/).length<=3){g=gg;break}}
  if(g&&!r.druh){r.druh=g;continue}
  rest.push(p);
 }
 if(rest.length)r.nazov=cap(rest.join(', ').replace(/^(názov|kniha)\s+/i,''));
 return r;
}
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
window.parseSpeech=parseSpeech;
function applyParsed(r){
 if(r.nazov)$('fNazov').value=r.nazov;if(r.autor)$('fAutor').value=r.autor;
 if(r.druh)$('fDruh').value=r.druh;if(r.stav){$('fStav').value=r.stav;$('fStav').onchange()}if(r.strana)$('fStrana').value=r.strana;
}
let rec=null;
$('btnMic').onclick=()=>{
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){toast('Diktovanie tento prehliadač nepodporuje. Použite Google Chrome.');return}
 if(rec){rec.stop();return}
 rec=new SR();rec.lang='sk-SK';rec.interimResults=false;rec.maxAlternatives=1;
 const b=$('btnMic');b.classList.add('listening');b.textContent='🔴 Počúvam… (ťuknite pre stop)';
 rec.onresult=e=>{const txt=e.results[0][0].transcript;$('micHint').textContent='Počul som: „'+txt+'“';applyParsed(parseSpeech(txt))};
 rec.onerror=e=>toast(e.error==='not-allowed'?'Povoľte mikrofón v prehliadači':e.error==='network'?'Diktovanie potrebuje internet':'Chyba diktovania: '+e.error);
 rec.onend=()=>{rec=null;b.classList.remove('listening');b.textContent='🎤 Nadiktovať'};
 rec.start();
};

/* ---------- Online vyhľadanie ---------- */
$('btnLookup').onclick=async()=>{
 const q=$('fNazov').value.trim();const out=$('lookupResults');
 if(!q){toast('Najprv zadajte názov');return}
 if(!navigator.onLine){toast('Ste offline – vyhľadanie nie je možné');return}
 out.innerHTML='<p class="hint">Hľadám…</p>';
 let items=[];
 try{
  const r=await fetch('https://www.googleapis.com/books/v1/volumes?maxResults=5&q='+encodeURIComponent('intitle:'+q+($('fAutor').value?' inauthor:'+$('fAutor').value:'')));
  const j=await r.json();
  items=(j.items||[]).map(i=>({t:i.volumeInfo.title,a:(i.volumeInfo.authors||[]).join(', '),c:(i.volumeInfo.imageLinks?.thumbnail||'').replace('http:','https:')}));
 }catch{}
 if(!items.length){try{
  const r=await fetch('https://openlibrary.org/search.json?limit=5&title='+encodeURIComponent(q));const j=await r.json();
  items=(j.docs||[]).map(d=>({t:d.title,a:(d.author_name||[]).join(', '),c:d.cover_i?`https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`:''}));
 }catch{}}
 if(!items.length){out.innerHTML='<p class="hint">Nenašlo sa nič (alebo nie je internet). Vyplňte ručne.</p>';return}
 out.innerHTML='<p class="hint">Ťuknite na správnu knihu:</p>'+items.map((x,i)=>`<button type="button" class="btn lk" data-i="${i}">${x.c?`<img src="${esc(x.c)}" alt="">`:'📕'}<span><b>${esc(x.t)}</b><br>${esc(x.a)}</span></button>`).join('');
 out.querySelectorAll('.lk').forEach(btn=>btn.onclick=async()=>{const x=items[btn.dataset.i];
  if(x.a)$('fAutor').value=x.a;if(!$('fNazov').value.trim())$('fNazov').value=x.t;
  if(x.c&&!photoData){try{setPhoto(await compressImage(x.c))}catch{}}
  out.innerHTML='';toast('Doplnené')});
};

/* ---------- Export / Import ---------- */
const COLS=[['Názov','nazov'],['Autor','autor'],['Druh','druh'],['Stav','stav'],['Strana','strana'],['Poznámka','poznamka'],['Dátum pridania','datumPridania'],['Dátum prečítania','datumPrecitania']];
const STAV_TXT={precitane:'Prečítané',neprecitane:'Neprečítané',citam:'Práve čítam'};
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
function buildWorkbook(){
 const wb=XLSX.utils.book_new();
 for(const [name,f] of [['Prečítané',isRead],['Neprečítané',b=>!isRead(b)]]){
  const rows=books.filter(f).map(b=>Object.fromEntries(COLS.map(([h,k])=>[h,k==='stav'?STAV_TXT[b.stav]||b.stav:b[k]||''])));
  const ws=XLSX.utils.json_to_sheet(rows,{header:COLS.map(c=>c[0])});ws['!cols']=[{wch:35},{wch:25},{wch:14},{wch:14},{wch:8},{wch:40},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb,ws,name);
 }return wb}
window.buildWorkbook=buildWorkbook;
$('btnExport').onclick=()=>{XLSX.writeFile(buildWorkbook(),'kniznica-'+today()+'.xlsx');toast('Excel uložený do Stiahnutých súborov')};
$('btnBackup').onclick=()=>{download(new Blob([JSON.stringify({app:'kniznica',verzia:1,datum:today(),knihy:books},null,1)],{type:'application/json'}),'kniznica-zaloha-'+today()+'.json');toast('Záloha uložená')};
function key(b){return (b.nazov+'|'+b.autor).toLowerCase()}
async function importBooks(list,replace){
 if(replace)await DB.clear();const ex=new Set(replace?[]:books.map(key));let n=0;
 for(const b of list){if(!b.nazov||ex.has(key(b)))continue;await DB.put({...b,id:b.id&&replace?b.id:uid()});n++}
 await reload();return n}
async function importXlsx(buf){
 const wb=XLSX.read(buf,{type:'array',cellDates:true});const list=[];
 const rev=Object.fromEntries(Object.entries(STAV_TXT).map(([k,v])=>[v.toLowerCase(),k]));
 for(const sn of wb.SheetNames){const read=/^pre[čc][íi]tan/i.test(sn);
  for(const row of XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:'',raw:false,dateNF:'yyyy-mm-dd'})){
   const b={};for(const [h,k] of COLS)b[k]=String(row[h]??'').trim();
   b.stav=rev[(b.stav||'').toLowerCase()]||(read?'precitane':'neprecitane');b.druh=b.druh||'Iné';b.datumPridania=b.datumPridania||today();list.push(b)}}
 return importBooks(list,false)}
window.importXlsx=importXlsx;
$('impXlsx').onchange=async e=>{const f=e.target.files[0];if(!f)return;
 try{const n=await importXlsx(await f.arrayBuffer());toast('Načítaných kníh: '+n)}catch(err){toast('Súbor sa nepodarilo načítať')}e.target.value=''};
$('impJson').onchange=async e=>{const f=e.target.files[0];if(!f)return;
 try{const j=JSON.parse(await f.text());const list=Array.isArray(j)?j:j.knihy;if(!Array.isArray(list))throw 0;
  const rep=await confirmDlg(`Záloha obsahuje ${list.length} kníh. Nahradiť celý súčasný zoznam? (Nie = len pridať chýbajúce)`);
  const n=await importBooks(list,rep);toast('Obnovených kníh: '+n)}catch{toast('Neplatný súbor zálohy')}e.target.value=''};

/* ---------- Menu, téma, písmo ---------- */
$('btnMenu').onclick=()=>$('dlgMenu').showModal();$('btnMenuClose').onclick=()=>$('dlgMenu').close();
function applyPrefs(){const t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
 document.documentElement.dataset.theme=t;document.documentElement.style.setProperty('--fs',(localStorage.getItem('fs')||22)+'px')}
$('btnTheme').onclick=()=>{localStorage.setItem('theme',document.documentElement.dataset.theme==='dark'?'light':'dark');applyPrefs()};
const fsz=d=>{const v=Math.min(34,Math.max(16,(+localStorage.getItem('fs')||22)+d));localStorage.setItem('fs',v);applyPrefs()};
$('fontPlus').onclick=()=>fsz(2);$('fontMinus').onclick=()=>fsz(-2);
$('tabNeprecitane').onclick=()=>{tab='neprecitane';render()};$('tabPrecitane').onclick=()=>{tab='precitane';render()};
$('search').oninput=render;$('filterDruh').onchange=render;
let deferred;addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('btnInstall').hidden=false});
$('btnInstall').onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;$('btnInstall').hidden=true}};

applyPrefs();
DB.open().then(reload).then(()=>{window.appReady=true});
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js');
