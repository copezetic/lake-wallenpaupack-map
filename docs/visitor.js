import {cleanTrip, parseTrip, searchEntries} from './discovery.js';
export function initVisitor(c) {
  const {D,CATS,hooks,panel,esc,openSheet,openPlace,flyTo,say,share,pinEls,getOrigin,hidden,setSearchIds,LITE} = c;
  const ids = new Set(D.pois.map(p=>p.id)), byId = new Map(D.pois.map(p=>[p.id,p]));
  const Q = new URLSearchParams(location.search), key = 'wallymap-weekend-v1';
  let trip = {title:'My lake weekend',stops:[]}, shared = parseTrip(Q.get('trip'), ids), searchText='', category='', sort='relevance', mapFilter=false, collectionBack=null;
  try { trip = cleanTrip(JSON.parse(localStorage.getItem(key)),ids); } catch {}
  function persist() { try { localStorage.setItem(key,JSON.stringify(trip)); return true; } catch { say('Browser storage is unavailable. Use Share to keep your trip link.'); return false; } }
  function marks(){ for(const [id,el] of pinEls) el.classList.toggle('trip-pin',trip.stops.includes(id)); }
  const menu = document.getElementById('nav');
  menu.innerHTML = `<details id="exploreMenu"><summary>Explore</summary><div class="navmenu" id="exploreItems"><span class="menu-title">Find places & plan a day</span></div></details><details id="conditionsMenu"><summary>Conditions</summary><div class="navmenu" id="conditionItems"></div></details><button class="navbtn" id="myWeekend">My weekend</button><details id="experienceMenu"><summary>Map</summary><div class="navmenu" id="experienceItems"><span class="menu-title">Map experience</span></div></details>`;
  const groups = {explore:document.getElementById('exploreItems'),conditions:document.getElementById('conditionItems'),experience:document.getElementById('experienceItems')};
  const closeMenus = () => menu.querySelectorAll('details').forEach(d=>d.open=false);
  menu.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{ if(d.open) menu.querySelectorAll('details').forEach(o=>{if(o!==d)o.open=false;}); }));
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenus();});
  function button(text,group,fn){const b=document.createElement('button');b.className='chip';b.textContent=text;b.onclick=()=>{closeMenus();fn();};groups[group].append(b);return b;}
  function move(b){
    if(b.dataset.grouped) return; b.dataset.grouped='true';
    const label=b.textContent.trim(); const group = b.dataset.menu || (/^(Traffic|Weather|\d+°|Conditions|Forecast)/.test(label)|| b.title==='Weather at the lake' ? 'conditions' : /^(Ride|Sound|Time & season|About)$/.test(label) ? 'experience' : 'explore');
    if(b.id==='bInfo') groups.experience.append(b); else groups[group].append(b);
    b.addEventListener('click',()=>{if(!b.hasAttribute('aria-pressed'))closeMenus();});
  }
  ['bFish','bEvents','bComs','bInfo'].forEach(id=>move(document.getElementById(id)));
  const chips=document.getElementById('chips');
  const drain=()=>[...chips.children].forEach(move); drain(); new MutationObserver(drain).observe(chips,{childList:true});
  button('Browse places','explore',()=>listSheet(''));
  button('Show all map pins','explore',()=>{mapFilter=false;collectionBack=null;setSearchIds(null);pinEls.forEach(el=>el.classList.remove('collection-pin'));say('Showing all enabled categories.');});
  hooks.showCollection=(placeIds,back)=>{mapFilter=true;collectionBack=back;setSearchIds(new Set(placeIds));pinEls.forEach((el,id)=>el.classList.toggle('collection-pin',placeIds.includes(id)));};
  button('Save for offline','experience',offlineSheet);
  button(LITE?'Use full detail':'Use lightweight mode','experience',()=>{const q=new URLSearchParams(location.search);q.set('lite',LITE?'0':'1');try{localStorage.setItem('wally-lite',LITE?'0':'1');}catch{}location.search=q.toString();});
  const weekend=document.getElementById('myWeekend');weekend.onclick=()=>{closeMenus();tripSheet();};
  function updateCount(){weekend.textContent=trip.stops.length?`My weekend · ${trip.stops.length}`:'My weekend';marks();}
  function savePlace(id){if(trip.stops.includes(id)){trip.stops=trip.stops.filter(x=>x!==id);persist();updateCount();return false;}if(trip.stops.length>=30){say('Your weekend holds up to 30 places. Remove one before adding another.');return false;}trip.stops.push(id);persist();updateCount();return true;}
  function addStops(stops){const before=trip.stops.length;trip=cleanTrip({...trip,stops:[...trip.stops,...stops]},ids);persist();updateCount();say(`${trip.stops.length-before} places added to your weekend.${trip.stops.length===30?' Maximum 30 places.':''}`);}
  hooks.addStops=addStops;
  hooks.place = p => {
    const acts=panel.querySelector('.acts'); const b=document.createElement('button');b.className='btn';b.id='savePlace';b.textContent=trip.stops.includes(p.id)?'Saved · remove':'Save to weekend';b.setAttribute('aria-pressed',String(trip.stops.includes(p.id)));acts.append(b);b.onclick=()=>{savePlace(p.id);b.textContent=trip.stops.includes(p.id)?'Saved · remove':'Save to weekend';b.setAttribute('aria-pressed',String(trip.stops.includes(p.id)));};
    const detail=document.createElement('div');detail.className='source-note';
    detail.innerHTML = p.sources?.length ? `Details checked ${esc(p.checked || '')} against ${p.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name || 'source')}</a>`).join(', ')}. ${esc(p.checkedNote || 'Hours and seasonal access can change.')}` : 'Public map data; details have not been individually checked.';
    if(p.notice){const n=document.createElement('p');n.className='notice';n.textContent=p.notice;panel.querySelector('h2').after(n);}
    acts.before(detail);
    if(p.gallery){const a=document.createElement('a');a.className='btn';a.textContent='Official photo gallery';a.href=p.gallery;a.target='_blank';a.rel='noopener';acts.append(a);}
    const phone=(p.facts||[]).find(f=>f[0]==='Phone')?.[1];if(phone){const a=document.createElement('a');a.className='btn';a.textContent='Call';a.href='tel:'+phone.replace(/[^+0-9]/g,'');acts.append(a);}
    const report=document.createElement('button');report.className='lnk';report.textContent='Report a problem';report.id='reportProblem';report.onclick=()=>reportSheet(p);panel.append(report);
    if(mapFilter){const back=document.createElement('button');back.className='btn';back.textContent=collectionBack?'Back to collection':'Back to results';back.onclick=()=>collectionBack?collectionBack():listSheet(searchText);acts.append(back);}
  };
  function reportSheet(p){openSheet('Help improve the map',`Report: ${p.name}`,`<form id="reportForm"><label for="reportKind">What needs fixing?</label><select id="reportKind"><option>Wrong location</option><option>Closed or moved</option><option>Incorrect hours</option><option>Access or docking</option><option>Other</option></select><p><label for="reportNote">Details</label><textarea id="reportNote" rows="4" required maxlength="1800" style="width:100%"></textarea></p><button class="btn pri" type="submit">Open email to send</button><p class="fine">Opens your email app addressed to info@wallymap.com. Review and send it there. Nothing is submitted automatically.</p><a href="mailto:info@wallymap.com">info@wallymap.com</a></form>`);panel.querySelector('form').onsubmit=e=>{e.preventDefault();const note=panel.querySelector('#reportNote').value.trim();if(!note)return;location.href=`mailto:info@wallymap.com?subject=${encodeURIComponent('WallyMap correction: '+p.name)}&body=${encodeURIComponent(panel.querySelector('#reportKind').value+'\n'+note+'\n\nhttps://wallymap.com/?p='+encodeURIComponent(p.id))}`;};}
  const distance = (p,origin) => origin ? `${(Math.hypot(p.x-origin[0],p.z-origin[1])/1609.34).toFixed(1)} mi` : '';
  const town = p => (p.facts || []).find(f=>f[0]==='Address')?.[1]?.split(',').slice(1).join(',').trim() || '';
  hooks.searchDetail = p => [p.kind,town(p),distance(p,getOrigin())].filter(Boolean).join(' · ');
  hooks.searchList = query => listSheet(query);
  function listSheet(query=searchText){
    searchText=query; mapFilter=true;collectionBack=null;pinEls.forEach(el=>el.classList.remove('collection-pin'));const origin=getOrigin();
    let entries=searchEntries(D.pois.map(p=>({n:p.name,kind:'Place',p})),query,{cats:CATS,origin,hidden}).filter(e=>!category||e.p.cat===category);
    if(sort==='name')entries.sort((a,b)=>a.n.localeCompare(b.n));if(sort==='distance')entries.sort((a,b)=>a.distance-b.distance);
    setSearchIds(new Set(entries.map(e=>e.p.id)));
    openSheet('Explore', query?`Results for “${query}”`:'Browse places',`<form id="listSearch"><label for="listQuery">Name, food, activity or town</label><input id="listQuery" type="search" value="${esc(query)}" style="width:100%"><button class="btn" type="submit">Search</button></form><div class="filter-row"><label>Category <select id="listCategory"><option value="">All visible categories</option>${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${k===category?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label><label>Sort <select id="listSort"><option value="relevance" ${sort==='relevance'?'selected':''}>Best match</option><option value="distance" ${sort==='distance'?'selected':''}>Distance</option><option value="name" ${sort==='name'?'selected':''}>Name</option></select></label></div><p class="source-note">${entries.length} places · distances are straight-line from ${c.hasLocation()?'your location':'the map centre'}, not travel distances. Map pins match this list.</p><button class="btn" id="clearMapFilter">Show all pins</button><div>${entries.length?entries.map(e=>`<div class="visitor-row"><h3><button data-poi="${esc(e.p.id)}">${esc(e.n)}</button></h3><small>${esc(hooks.searchDetail(e.p))}</small>${e.p.notice?`<small>${esc(e.p.notice)}</small>`:''}</div>`).join(''):'<p>No matches. Try another word or enable more categories in Explore.</p>'}</div>`);
    panel.querySelector('#listSearch').onsubmit=e=>{e.preventDefault();listSheet(panel.querySelector('#listQuery').value.trim());};
    panel.querySelector('#listCategory').onchange=e=>{category=e.target.value;listSheet();};panel.querySelector('#listSort').onchange=e=>{sort=e.target.value;listSheet();};
    panel.querySelector('#clearMapFilter').onclick=()=>{mapFilter=false;setSearchIds(null);pinEls.forEach(el=>el.classList.remove('collection-pin'));c.closePanel();say('All enabled categories are back on the map.');};
  }
  hooks.categoryChanged=()=>{if(mapFilter && panel.querySelector('#listSearch'))listSheet();};
  function tripSheet(useShared=false){
    const t=useShared&&shared?shared:trip;
    openSheet(useShared?'Shared collection':'Saved on this device',t.title,`${useShared?'<p>Preview this shared weekend. Your saved places have not changed.</p><button class="btn pri" id="importTrip">Add these places to my weekend</button>':`<label for="tripTitle">Weekend name</label><input class="trip-title" id="tripTitle" maxlength="80" value="${esc(t.title)}">`}<p class="source-note">${t.stops.length}/30 places. No account needed. A shared link contains the title and places in this collection.</p>${t.stops.map((id,i)=>{const p=byId.get(id);return `<div class="visitor-row"><h3><button data-poi="${esc(id)}">${i+1}. ${esc(p.name)}</button></h3><small>${esc(town(p))}</small>${useShared?'':`<div class="acts"><button class="btn" data-up="${i}" ${i===0?'disabled':''} aria-label="Move ${esc(p.name)} up">↑</button><button class="btn" data-down="${i}" ${i===t.stops.length-1?'disabled':''} aria-label="Move ${esc(p.name)} down">↓</button><button class="btn" data-remove="${esc(id)}">Remove</button></div>`}</div>`;}).join('')||'<p>Open a place and choose “Save to weekend”, or start with a day plan or the beer & wine trail.</p>'}<div class="acts"><button class="btn" id="tripShare" ${t.stops.length?'':'disabled'}>Share weekend</button><button class="btn" id="tripMap" ${t.stops.length?'':'disabled'}>Show these places</button><button class="btn" id="tripBrowse">Browse places</button></div>`);
    const title=panel.querySelector('#tripTitle');if(title)title.onchange=()=>{trip.title=title.value.trim()||'My lake weekend';persist();};
    panel.querySelector('#tripShare').onclick=()=>share(t.title,'?trip='+encodeURIComponent(JSON.stringify(t)));
    panel.querySelector('#tripMap').onclick=()=>{hooks.showCollection(t.stops,()=>tripSheet(useShared));const ps=t.stops.map(id=>byId.get(id)),x=ps.reduce((s,p)=>s+p.x,0)/ps.length,z=ps.reduce((s,p)=>s+p.z,0)/ps.length;flyTo(x,z,Math.max(2500,...ps.map(p=>Math.hypot(p.x-x,p.z-z)*3)));say('Showing this weekend’s places. Browse places to reset.');};
    panel.querySelector('#tripBrowse').onclick=()=>listSheet('');
    panel.querySelector('#importTrip')?.addEventListener('click',()=>{addStops(t.stops);tripSheet();});
    panel.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{trip.stops=trip.stops.filter(id=>id!==b.dataset.remove);persist();updateCount();tripSheet();});
    panel.querySelectorAll('[data-up],[data-down]').forEach(b=>b.onclick=()=>{const i=+(b.dataset.up??b.dataset.down),j=i+(b.hasAttribute('data-up')?-1:1);[trip.stops[i],trip.stops[j]]=[trip.stops[j],trip.stops[i]];persist();tripSheet();});
  }
  let offlineState={text:'Not downloaded yet.',done:0,total:0}, downloading=false;
  const connection=document.getElementById('connection');
  function network(){document.body.classList.toggle('is-offline',!navigator.onLine);connection.hidden=navigator.onLine;connection.textContent='Offline · showing saved map data. Weather, traffic and river conditions cannot refresh.';}network();addEventListener('online',network);addEventListener('offline',network);
  function paintOffline(){const s=panel.querySelector('#offlineStatus');if(s)s.textContent=offlineState.text;const p=panel.querySelector('#offlineProgress');if(p){p.max=offlineState.total||1;p.value=offlineState.done;}const b=panel.querySelector('#offlineStart');if(b)b.disabled=downloading;}
  async function workerMessage(type){const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Offline service is unavailable. Reload this page and try again.')),10000))]);const worker=registration.active;return new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>reject(new Error('The download service did not respond. Reload and try again.')),15000);channel.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};worker.postMessage({type},[channel.port2]);});}
  async function offlineSheet(){
    openSheet('Weak signal', 'Save for offline', `<p>Download the map, all building tiles, place details and guides before leaving Wi-Fi. Your saved weekend stays on this device.</p><p class="source-note">Live weather, traffic, river readings, external websites and external photos require a connection. Browser storage can be cleared by your device.</p><p id="offlineStatus" role="status">${esc(offlineState.text)}</p><progress id="offlineProgress" value="${offlineState.done}" max="${offlineState.total||1}"></progress><div class="acts"><button class="btn pri" id="offlineStart">${downloading?'Downloading…':'Download / update map'}</button></div><p class="fine">Keep this page open until “Ready offline” appears. An interrupted or incomplete download can be retried.</p>`);
    panel.querySelector('#offlineStart').onclick=downloadOffline;paintOffline();
    if(!('serviceWorker' in navigator)){offlineState.text='Offline saving is not supported in this browser. Try Safari or Chrome.';paintOffline();panel.querySelector('#offlineStart').disabled=true;return;}
    try {const status=await workerMessage('OFFLINE_STATUS');if(!downloading){if(status.complete){offlineState.done=status.total;offlineState.total=status.total;}offlineState.text=status.complete?`Ready offline · saved ${new Date(status.savedAt).toLocaleString()} · ${(status.bytes/1048576).toFixed(1)} MB. Update while online for current details.`:'No complete download yet.';paintOffline();}}catch(e){offlineState.text=e.message;paintOffline();}
  }
  async function downloadOffline(){if(downloading)return;if(!navigator.onLine){offlineState.text='Connect to the internet to download the map.';paintOffline();return;}downloading=true;offlineState={text:'Starting download…',done:0,total:0};paintOffline();try{const r=await workerMessage('DOWNLOAD_OFFLINE');if(r.error)throw new Error(r.error);}catch(e){downloading=false;offlineState.text=e.message;paintOffline();}}
  navigator.serviceWorker?.addEventListener('message',e=>{if(e.data.type!=='OFFLINE_PROGRESS')return;const d=e.data;offlineState={done:d.done,total:d.total,text:d.error?`Download incomplete: ${d.error}. Retry when connected.`:d.complete?`Ready offline · ${d.total} files saved. External conditions still need internet.`:`Downloading ${d.done} of ${d.total} files…`};if(d.complete||d.error)downloading=false;paintOffline();});
  updateCount(); if(shared)tripSheet(true);if(Q.has('weekend'))tripSheet();if(Q.has('offline'))offlineSheet();
  return {tripSheet};
}
