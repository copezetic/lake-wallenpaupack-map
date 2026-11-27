/* Lake Wallenpaupack map — town guides, homes for sale, sponsored places, trails, boating, public access, day plans, the business pages, opening hours and the overview tour.
   Everything shown comes from the map data or from the hand-kept JSON files beside this one; nothing is made up here.
   © 2026 DeWitt Hutchins. All rights reserved. */
const Q = new URLSearchParams(location.search);
const DEMO = Q.has('demo');
const TODAY = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York'}).format(new Date());
const getJSON = async f => { try { const r = await fetch(f, {cache: 'no-cache'}); return r.ok ? await r.json() : null; } catch(e){ return null; } };

/* ---------- opening hours: the simple OpenStreetMap forms only; anything else is left unsaid ---------- */
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
function parseHours(s){
  if (!s) return null; s = s.trim();
  if (s === '24/7') return DAYS.map(() => [[0, 1440]]);
  const week = DAYS.map(() => null);
  for (const rule of s.split(';').map(r => r.trim()).filter(Boolean)){
    const m = rule.match(/^((?:(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?,?)+)?\s*(off|closed|(?:\d{1,2}:\d{2}-\d{1,2}:\d{2},?\s*)+)$/);
    if (!m) return null;
    let days = [];
    if (m[1]) for (const part of m[1].split(',').filter(Boolean)){ const [a, b] = part.split('-').map(d => DAYS.indexOf(d));
      if (b === undefined) days.push(a); else for (let d = a; ; d = (d + 1) % 7){ days.push(d); if (d === b) break; } }
    else days = [0, 1, 2, 3, 4, 5, 6];
    const spans = /off|closed/.test(m[2]) ? [] : m[2].split(',').map(t => t.trim()).filter(Boolean).map(t => { const [a, b] = t.split('-').map(x => { const [h, mi] = x.split(':').map(Number); return h * 60 + mi; }); return [a, b <= a ? b + 1440 : b]; });
    for (const d of days) week[d] = spans;
  }
  return week;
}
const clock = m => { m %= 1440; const h = Math.floor(m / 60), mi = m % 60; return `${h % 12 || 12}${mi ? ':' + String(mi).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`; };
export function openNow(p){                    // {open, text} or null when the hours are unknown or not understood
  const h = p.facts && p.facts.find(f => f[0] === 'Hours'); const week = h && parseHours(h[1]); if (!week) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'}).formatToParts(new Date()).map(x => [x.type, x.value]));
  const d = DAYS.indexOf(parts.weekday.slice(0, 2)), now = +parts.hour * 60 + +parts.minute;
  for (const [day, t] of [[d, now], [(d + 6) % 7, now + 1440]]) for (const [a, b] of week[day] || []) if (t >= a && t < b) return {open: true, text: b - a >= 1440 ? 'Open now · 24 hours' : `Open now · until ${clock(b)}`};
  const later = (week[d] || []).filter(([a]) => a > now).sort((x, y) => x[0] - y[0])[0];
  return {open: false, text: later ? `Closed now · opens ${clock(later[0])}` : 'Closed now'};
}

export async function initExtras(c){
  const {THREE, scene, D, M, Y, openSheet, openPlace, flyTo, esc, panel, chips, items, pinEls, addLabel, place, controls, camera, say, share, CATS, terrain, canvas} = c;
  const toXZ = (lat, lon) => [(lon - M.lon0) * M.kx, -(lat - M.lat0) * M.kz];
  const css = document.createElement('style');
  css.textContent = `#panel .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 10px}
#panel .tabs button{font:700 11.5px var(--sc);letter-spacing:.13em;padding:7px 11px 6px;border:1px solid var(--ink);background:none;color:var(--ink);cursor:pointer}
#panel .tabs button[aria-pressed="true"]{background:var(--ink);color:var(--card)}
#panel .plist button .sp{font:700 10px var(--sc);letter-spacing:.14em;color:#7a3b2e;border:1px solid #7a3b2e;padding:1px 5px 0;margin-left:7px}
#panel .gi{padding:8px 0;border-bottom:1px solid rgba(141,154,151,.55)}#panel .gi h3{margin:0;font:600 18px var(--serif)}
#panel .gi h3 button{all:unset;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(122,59,46,.5);text-underline-offset:3px}
#panel .gi p{margin:2px 0 0;font-size:15.5px;line-height:1.32}#panel .gi a{color:#7a3b2e}
.pin.feat .tag{font-weight:700;border-width:2px;border-color:#7a3b2e;padding:2px 10px 3px;font-size:16px}.pin.feat .dot{width:12px;height:12px;border-color:#7a3b2e}.pin.feat .stem{height:22px;background:#7a3b2e}
.pin.sale .tag{background:#7a3b2e;color:var(--card);border-color:#7a3b2e;font-weight:700;font-size:13.5px}.pin.sale .stem{height:18px;background:#7a3b2e}.pin.sale .dot{background:#7a3b2e}
body.tour header .tools,body.tour #chips,body.tour #zoom,body.tour #locate,body.tour #compass,body.tour #hint,body.tour #panel,body.tour #credit .long,body.tour #bLegal{display:none!important}
.lb.pk{font:700 10.5px var(--sc);letter-spacing:.12em;color:var(--ink);background:rgba(247,242,230,.92);border:1px solid var(--ink);padding:2px 6px 1px;pointer-events:none}.lb.pk.hm{border-color:#5a4a8c;color:#3d2f6b;font-style:italic;letter-spacing:.04em;font-family:var(--serif);font-size:12.5px}.measuring .pin{pointer-events:none}.lb.mdot{width:10px;height:10px;border-radius:50%;background:#b0351f;border:2px solid #fff;pointer-events:none}
.lb.pk.an{font:italic 600 13px var(--serif);letter-spacing:0;border-color:#7a3b2e;color:#5a2a20}
#tourCap{position:fixed;left:0;right:0;bottom:11%;z-index:8;text-align:center;pointer-events:none;opacity:0;transition:opacity .9s}
#tourCap.on{opacity:1}@media (orientation:portrait){#tourCap{bottom:17%}}#tourCap b{display:inline-block;max-width:88vw;font:600 clamp(30px,4.6vw,64px)/1.05 var(--serif);color:var(--ink);background:rgba(247,242,230,.9);padding:.18em .5em .22em;box-shadow:6px 6px 0 rgba(34,48,58,.16);border:1px solid var(--ink)}
#tourCap span{display:block;margin:.7em auto 0;width:fit-content;max-width:86vw;font:700 clamp(12px,1.25vw,17px) var(--sc);letter-spacing:.16em;color:var(--card);background:var(--ink);padding:.55em 1em .45em}`;
  document.head.appendChild(css);
  const addChip = (label, fn, cls = '') => { const b = document.createElement('button'); b.className = 'chip sky ' + cls; b.textContent = label; b.onclick = fn; chips.insertBefore(b, chips.querySelector('.chip:not(.sky)')); return b; };
  const itemOf = p => items.find(it => it.poi === p);

  /* a guide sheet: sections of short entries kept in a JSON file, each with its own source */
  function guide(F, kick, title, extra = ''){
    const list = [];
    const html = (F.intro ? `<p>${esc(F.intro)}</p>` : '') + extra + (F.sections || []).map(s => `<div class="sec">${esc(s.title)}</div>${s.text ? `<p>${esc(s.text)}</p>` : ''}` +
      (s.items || []).map(it => { const go = it.poi || it.lat != null; if (go) list.push(it);
        return `<div class="gi"><h3>${go ? `<button data-g="${list.length - 1}">${esc(it.n)}</button>` : esc(it.n)}</h3>${it.note ? `<p>${esc(it.note)}</p>` : ''}${it.url ? `<p><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.link || 'More')}</a></p>` : ''}</div>`; }).join('')).join('') +
      `<p class="fine">${esc(F.fine || '')}${F.updated ? ' Checked ' + esc(F.updated) + '.' : ''}</p>` +
      (F.sources ? `<p class="fine">Sources: ${F.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.n)}</a>`).join(' · ')}</p>` : '');
    openSheet(kick, title, html);
    panel.querySelectorAll('button[data-g]').forEach(b => b.onclick = () => { const it = list[+b.dataset.g], p = it.poi && D.pois.find(p => p.id === it.poi);
      if (p) return openPlace(p); const [x, z] = toXZ(it.lat, it.lon); flyTo(x, z, it.d || 1800); });
  }

  /* ---------- sponsored places: a paid pin is bigger, always shown, listed first, and always marked ---------- */
  const SP = await getJSON('sponsors.json');
  for (const s of (SP && SP.sponsors) || []){
    if ((s.until && s.until < TODAY) || (s.demo && !DEMO)) continue;
    let p = D.pois.find(p => p.id === s.poi);
    if (!p && s.add){                              // a sponsor that is not in the public map data gets its own pin
      const [x, z] = toXZ(s.add.lat, s.add.lon); p = {id: s.poi, name: s.add.name, cat: s.add.cat || 'shops', kind: s.add.kind || '', x, z, dlat: s.add.lat, dlon: s.add.lon, facts: s.add.facts};
      const el = document.createElement('button'); el.className = 'lb pin'; el.style.setProperty('--c', CATS[p.cat].c); el.innerHTML = `<span class="tag"></span><span class="stem"></span><span class="dot"></span>`;
      el.firstChild.textContent = p.name; el.addEventListener('click', e => { e.stopPropagation(); openPlace(p); }); pinEls.set(p.id, el); addLabel(el, x, z, 6).poi = p; D.pois.push(p);
    }
    if (!p) continue;
    p.sponsor = s; if (s.blurb) p.blurb = s.blurb; if (s.photo){ p.photo = s.photo; p.photoCredit = s.photoCredit; } if (s.url) p.url = s.url;
    const el = pinEls.get(p.id), it = itemOf(p); if (el){ el.classList.remove('minor'); el.classList.add('feat'); } if (it){ it.maxD = 0; it.w = 0; } p.major = true;
  }

  /* ---------- town guides ---------- */
  const TOWNS = [['Honesdale', 2300], ['Hawley', 1900], ['Greentown', 2600]].map(([n, r]) => { const t = D.towns.find(t => t.n === n); return t && {n, r, x: t.x, z: t.z}; }).filter(Boolean);
  const inTown = (t, p) => { const d = Math.hypot(p.x - t.x, p.z - t.z); if (d < t.r) return true;
    const a = p.facts && p.facts.find(f => f[0] === 'Address'); return !!a && d < t.r * 2.2 && a[1].endsWith(', ' + t.n); };
  const ORDER = ['food', 'shops', 'stay', 'nature', 'water'];
  function townSheet(name){
    const t = TOWNS.find(t => t.n === name) || TOWNS[0]; if (!t) return;
    const here = D.pois.filter(p => inTown(t, p)).sort((a, b) => a.name.localeCompare(b.name)), sp = here.filter(p => p.sponsor);
    const row = p => { const o = openNow(p); return `<button data-poi="${esc(p.id)}">${esc(p.name)}<small>${esc(p.kind || '')}${o && o.open ? ' · open now' : ''}</small>${p.sponsor ? `<span class="sp">Sponsored${p.sponsor.offer ? ' · offer' : ''}</span>` : ''}</button>`; };
    openSheet('Town guide', t.n, `<div class="tabs">${TOWNS.map(o => `<button data-town="${esc(o.n)}" aria-pressed="${o === t}">${esc(o.n)}</button>`).join('')}</div>
      <p>${here.length} places in and around ${esc(t.n)}. Tap one to see it on the map.</p>` +
      (sp.length ? `<div class="sec">Sponsored</div><div class="plist">${sp.map(row).join('')}</div>` : '') +
      ORDER.map(k => { const l = here.filter(p => p.cat === k); return l.length ? `<div class="sec">${esc(CATS[k].label)} · ${l.length}</div><div class="plist">${l.map(row).join('')}</div>` : ''; }).join('') +
      `<p class="fine">From public map data; nobody has visited or called each place. Sponsored places have paid to be listed first and are always marked.</p>
       <button class="wide" id="townShare">Share this guide</button>`);
    panel.querySelectorAll('button[data-town]').forEach(b => b.onclick = () => townSheet(b.dataset.town));
    panel.querySelector('#townShare').onclick = () => share(t.n, '?town=' + encodeURIComponent(t.n.toLowerCase()));
    flyTo(t.x, t.z, 4200);
  }
  if (TOWNS.length) addChip('Towns', () => townSheet(TOWNS[0].n));

  /* ---------- homes for sale and open houses, for agents with a current subscription ---------- */
  const [LS, AG] = await Promise.all([getJSON('listings.json'), getJSON('agents.json')]);
  const fmtDay = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'});
  const homes = ((LS && LS.listings) || []).filter(l => { const a = AG && AG.agents && AG.agents[l.ag];
    return a && !(a.until && a.until < TODAY) && !(l.demo && !DEMO) && !(l.until && l.until < TODAY) && l.lat != null; });
  for (const l of homes){ l.agent = AG.agents[l.ag]; [l.x, l.z] = toXZ(l.lat, l.lon); l.opens = (l.open || []).filter(o => o.d >= TODAY).sort((a, b) => a.d.localeCompare(b.d)); }
  const linkOf = l => `?home=${l.lat},${l.lon}&t=${encodeURIComponent(l.t)}&ag=${encodeURIComponent(l.ag)}`;
  function homeSheet(l){
    const a = l.agent;
    openSheet(l.opens.length ? 'Open house' : 'Home for sale', l.t,
      (l.price ? `<p style="font:600 22px var(--serif);margin:0 0 6px">${esc(l.price)}</p>` : '') + (l.note ? `<p>${esc(l.note)}</p>` : '') +
      (l.opens.length ? `<div class="sec">Open house</div>${l.opens.map(o => `<p style="margin:3px 0"><b>${esc(fmtDay(o.d))}</b>${o.time ? ' · ' + esc(o.time) : ''}</p>`).join('')}` : '') +
      `<div class="sec">Presented by</div><p><b>${esc(a.name)}</b>${a.firm ? '<br>' + esc(a.firm) : ''}${a.phone ? '<br>' + esc(a.phone) : ''}</p>
       <div class="acts"><a class="btn pri" href="${esc(linkOf(l))}">What's nearby</a>${l.url ? `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">Listing</a>` : ''}<button class="btn" id="hShare">Share</button></div>
       <p class="fine">Shown for a subscribing agent. Details come from the agent; confirm everything with them. Position is approximate.</p>`);
    panel.querySelector('#hShare').onclick = () => share(l.t, linkOf(l));
    flyTo(l.x, l.z, 1700);
  }
  if (!Q.has('home')) for (const l of homes){
    const el = document.createElement('button'); el.className = 'lb pin sale'; el.innerHTML = `<span class="tag"></span><span class="stem"></span><span class="dot"></span>`;
    el.firstChild.textContent = l.opens.length ? 'Open house' : 'For sale'; el.onclick = e => { e.stopPropagation(); homeSheet(l); };
    const it = addLabel(el, l.x, l.z, 6); it.ring = true; it.maxD = 26000;
  }
  function homesSheet(){
    const open = homes.filter(l => l.opens.length).sort((a, b) => a.opens[0].d.localeCompare(b.opens[0].d)), rest = homes.filter(l => !l.opens.length);
    const row = (l, i) => `<button data-h="${i}">${esc(l.t)}<small>${l.opens.length ? esc(fmtDay(l.opens[0].d)) + (l.opens[0].time ? ' · ' + esc(l.opens[0].time) : '') : esc(l.price || '')}</small></button>`;
    const all = [...open, ...rest];
    openSheet('Homes', 'Open houses and homes for sale', (open.length ? `<div class="sec">Open houses</div><div class="plist">${open.map((l, i) => row(l, i)).join('')}</div>` : '') +
      (rest.length ? `<div class="sec">For sale</div><div class="plist">${rest.map((l, i) => row(l, open.length + i)).join('')}</div>` : '') +
      `<p class="fine">Only homes listed by subscribing agents appear here; this is not every home for sale around the lake.</p>`);
    panel.querySelectorAll('button[data-h]').forEach(b => b.onclick = () => homeSheet(all[+b.dataset.h]));
  }
  if (homes.length) addChip(homes.some(l => l.opens.length) ? 'Open houses' : 'Homes for sale', homesSheet, 'fx');

  /* ---------- trails ---------- */
  const OUT = await getJSON('outdoors.json');
  if (D.trails && D.trails.length){
    const by = new Map();
    for (const t of D.trails){ const g = by.get(t.n) || {n: t.n, len: 0, pts: []}; for (let i = 1; i < t.p.length; i++) g.len += Math.hypot(t.p[i][0] - t.p[i-1][0], t.p[i][1] - t.p[i-1][1]); g.pts.push(...t.p); by.set(t.n, g); }
    const list = [...by.values()].filter(g => g.len > 150).sort((a, b) => a.n.localeCompare(b.n));
    addChip('Trails', () => {
      const html = `<div class="sec">Trails on the map · ${list.length}</div><p>Drawn as dotted brown lines. Tap a name to go there.</p><div class="plist">${list.map((g, i) => `<button data-t="${i}">${esc(g.n)}<small>${(g.len / 1609.34).toFixed(1)} mi mapped</small></button>`).join('')}</div>
        <p class="fine">Trail lines come from OpenStreetMap volunteers. Some are inside private communities or preserves with their own rules, lengths are only what has been mapped, and conditions change: check with the land's owner before you go.</p>`;
      if (OUT) guide(OUT, 'Outdoors', 'Trails and winter', ''); else openSheet('Outdoors', 'Trails', '');
      panel.insertAdjacentHTML('beforeend', html);
      panel.querySelectorAll('button[data-t]').forEach(b => b.onclick = () => { const g = list[+b.dataset.t], m = g.pts[Math.floor(g.pts.length / 2)]; flyTo(m[0], m[1], 2200); });
    });
  }

  /* ---------- boating: the rules, fuel and pump-outs, and the no-wake band along the shore ---------- */
  const BO = await getJSON('boating.json');
  const DINE = (d => d && (d.sections || []).some(s => (s.items || []).length) ? d : null)(await getJSON('dine.json')), dineSheet = () => guide(DINE, 'On the water', 'Dock and dine');
  if (DINE && Q.has('dine')) setTimeout(dineSheet, 800);
  /* measuring a trip: tap points along the way; straight lines between taps, so follow the channel with a few taps */
  const measure = (() => {
    const pts = [], tags = [], ray = new THREE.Raycaster(); let on = false, line = null, dn = null;
    const mat = new THREE.LineBasicMaterial({color: '#b0351f', depthTest: false, transparent: true});
    const total = () => pts.reduce((a, q, i) => i ? a + Math.hypot(q.x - pts[i-1].x, q.z - pts[i-1].z) : 0, 0);
    const draw = () => { if (line){ scene.remove(line); line.geometry.dispose(); line = null; }
      if (pts.length > 1){ line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(q => new THREE.Vector3(q.x, q.y + 3, q.z))), mat); line.renderOrder = 20; line.frustumCulled = false; scene.add(line); } };
    const dot = q => { const el = document.createElement('div'); el.className = 'lb mdot'; const it = addLabel(el, q.x, q.z, 3, 'center'); tags.push(it); };
    const undot = () => { const it = tags.pop(); if (it){ it.el.remove(); const i = items.indexOf(it); if (i >= 0) items.splice(i, 1); } };
    const sheet = () => { const m = total(), mi = m / 1609.34, min = v => Math.max(1, Math.round(mi / v * 60));
      openSheet('On the water', 'Measure a trip', `<p>${pts.length ? '' : 'Tap the map where you start, then tap along your way. '}Each tap adds a straight leg, so a few taps will follow the channel.</p>
        <div class="big" style="font:600 30px var(--serif);margin:4px 0">${pts.length > 1 ? (mi < .2 ? Math.round(m * 3.28084) + ' ft' : mi.toFixed(mi < 10 ? 2 : 1) + ' mi') : '—'}</div>
        ${pts.length > 1 && mi >= .2 ? `<p>About ${min(25)} min at 25 mph · ${min(10)} min at 10 mph · ${min(4)} min paddling at 4 mph</p>` : ''}
        <div class="acts"><button class="btn" id="mUndo">Undo</button><button class="btn" id="mClear">Clear</button><button class="btn pri" id="mDone">Done</button></div>
        <p class="fine">A straight-line estimate on this map, not a chart: it ignores no-wake areas, shallows and other boats.</p>`);
      panel.querySelector('#mUndo').onclick = () => { pts.pop(); undot(); draw(); sheet(); };
      panel.querySelector('#mClear').onclick = () => { pts.length = 0; while (tags.length) undot(); draw(); sheet(); };
      panel.querySelector('#mDone').onclick = () => { on = false; document.body.classList.remove('measuring'); pts.length = 0; while (tags.length) undot(); draw(); panel.querySelector('.x').click(); }; };
    if (canvas && terrain){ canvas.addEventListener('pointerdown', e => dn = [e.clientX, e.clientY]);
      canvas.addEventListener('pointerup', e => { if (!on || !dn || Math.hypot(e.clientX - dn[0], e.clientY - dn[1]) > 6) return;
        const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
        const hit = ray.intersectObject(terrain, true)[0]; if (!hit) return; pts.push(hit.point.clone()); dot(hit.point); draw(); sheet(); }); }
    return {start(){ on = true; document.body.classList.add('measuring'); sheet(); }};
  })();
  if (Q.has('measure')) setTimeout(() => measure.start(), 800);
  if (BO){
    let band = null;
    function makeBand(){
      const lake = D.water.filter(w => w.n === 'Lake Wallenpaupack'); if (!lake.length) return null;
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const w of lake) for (const q of w.o){ x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
      const S = 4096 / Math.max(x1 - x0, z1 - z0), cv = document.createElement('canvas'); cv.width = Math.ceil((x1 - x0) * S); cv.height = Math.ceil((z1 - z0) * S);
      const g = cv.getContext('2d'), ring = r => { r.forEach((q, i) => i ? g.lineTo((q[0] - x0) * S, (q[1] - z0) * S) : g.moveTo((q[0] - x0) * S, (q[1] - z0) * S)); g.closePath(); };
      g.beginPath(); for (const w of lake){ ring(w.o); w.h.forEach(ring); } g.save(); g.clip('evenodd');
      g.lineJoin = 'round'; g.strokeStyle = 'rgba(196,108,38,.62)'; g.lineWidth = 2 * (BO.bandFeet || 100) * .3048 * S; g.stroke(); g.restore();
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const lvl = Math.min(...lake.map(w => Y(w.o[0][0], w.o[0][1]))) + 1.2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4}));
      m.position.set((x0 + x1) / 2, lvl, (z0 + z1) / 2); m.renderOrder = 3; m.visible = false; scene.add(m); return m;
    }
    const chip = addChip('Boating', () => {
      guide(BO, 'On the water', 'Boating', `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px">${BO.bandFeet ? '<button class="wide" id="bandBtn" style="margin:0"></button>' : ''}<button class="wide" id="measBtn" style="margin:0">Measure a trip</button>${DINE ? '<button class="wide" id="dineBtn" style="margin:0">Dock and dine</button>' : ''}</div>`);
      panel.querySelector('#measBtn').onclick = () => measure.start(); const db = panel.querySelector('#dineBtn'); if (db) db.onclick = dineSheet;
      const b = panel.querySelector('#bandBtn'); if (!b) return;
      const label = () => b.textContent = band && band.visible ? 'Hide the no-wake band' : `Show the ${BO.bandFeet}-foot no-wake band`;
      label(); b.onclick = () => { band = band || makeBand(); if (!band) return; band.visible = !band.visible; chip.classList.toggle('fx', band.visible); label();
        if (band.visible) say(`Orange band: within ${BO.bandFeet} feet of shore. An illustration, not a chart.`); };
    });
    if (Q.has('boating')) setTimeout(() => chip.click(), 800);
  }

  /* ---------- public access, and eating by boat: both are guide sheets kept in JSON, every entry with its source ---------- */
  for (const [file, label, kick, title, q] of [['access.json', 'Public access', 'Open to everyone', 'Public access', 'access']]){
    const F = await getJSON(file); if (!F || !(F.sections || []).some(s => (s.items || []).length)) continue;
    const chip = addChip(label, () => guide(F, kick, title));
    if (Q.has(q)) setTimeout(() => chip.click(), 800);
  }

  /* ---------- the old survey: the earliest government maps of the lake, laid over the model (built by data/build_historic.py) ---------- */
  const HI = await getJSON('historic.json');
  if (HI){
    let old = null, op = .9;
    const make = () => {
      const [x0, z0] = toXZ(HI.N, HI.W), [x1, z1] = toXZ(HI.S, HI.E), g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 170, 205).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
      const P = g.attributes.position; for (let i = 0; i < P.count; i++) P.setY(i, Y(P.getX(i), P.getZ(i)) + 4);
      const tex = new THREE.TextureLoader().load('historic.jpg', () => say('1928 map loaded.'), undefined, () => say('The old map could not be loaded.')); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({map: tex, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6}));
      m.renderOrder = 2; m.visible = false; scene.add(m); return m;
    };
    const MK = await getJSON('markers.json'); let pinned = false;
    const histSheet = auto => {
      const ms = (MK && MK.markers) || [];
      openSheet('History', 'The lake when it was new',
        `<p>The dam at Wilsonville was finished in 1926. These are the first government survey maps made afterwards: the western sheet was surveyed in 1927–28 and the eastern in 1935, when the lake was a few years old and most of today's communities were still farms and woods.</p>
         <button class="wide" id="oldBtn" style="margin:0 0 10px"></button>
         <label style="display:block;font:700 11px var(--sc);letter-spacing:.13em">Old map ⟷ today<input id="oldOp" type="range" min="0" max="100" value="${Math.round(op * 100)}" style="display:block;width:100%;margin-top:6px"></label>
         <p class="fine">No survey of the valley before the flooding exists in this collection, so the farms and the village of Wilsonville under the water are not shown. The two sheets were printed in different colours and meet down the middle of the lake. They cover the lake and south; Honesdale is off the top.</p>` +
        (ms.length ? `<div class="sec">State historical markers · ${ms.length}</div><div class="plist">${ms.map((m, i) => `<button data-mk="${i}">${esc(m.n)}<small>${m.year ? 'Dedicated ' + esc(m.year) : 'Marker'}${m.missing ? ' · may no longer be standing' : ''}</small></button>`).join('')}</div>
         <p class="fine">Markers: Pennsylvania Historical and Museum Commission, public-domain data. Positions come from street addresses and are approximate; read the marker itself for its story.</p>` : '') +
        `<p class="fine">Maps: U.S. Geological Survey, Historical Topographic Map Collection (Ariel, Pa., surveyed 1927–28; Hawley, Pa., 1935 edition).</p>`);
      const b = panel.querySelector('#oldBtn'), r = panel.querySelector('#oldOp');
      const label = () => b.textContent = old && old.visible ? 'Hide the old map' : 'Show the old map';
      const toggle = on => { old = old || make(); old.visible = on; chip.classList.toggle('fx', on); label(); };
      b.onclick = () => toggle(!(old && old.visible)); r.oninput = () => { op = r.value / 100; if (old) old.material.opacity = op; };
      if (auto && !(old && old.visible)) toggle(true); else label();
      if (!pinned){ pinned = true; for (const m of ms){ const [x, z] = toXZ(m.lat, m.lon), el = document.createElement('div'); el.className = 'lb pk hm'; el.textContent = m.n; addLabel(el, x, z, 7, 'center').maxD = 7000; } }
      panel.querySelectorAll('button[data-mk]').forEach(bt => bt.onclick = () => { const m = ms[+bt.dataset.mk], [x, z] = toXZ(m.lat, m.lon); flyTo(x, z, 1300); });
    };
    const chip = addChip('History', () => histSheet(false));
    if (Q.has('history')) setTimeout(() => histSheet(false), 800);
    if (Q.has('old')) setTimeout(() => histSheet(true), 800);
  }

  /* ---------- a closer look at one place: its paths, buildings and facilities from open map data, and, for an animal park, figures of the animals it says it keeps ---------- */
  const PK = await getJSON('parks.json');
  for (const pk of (PK && PK.parks) || []){
    const poi = D.pois.find(p => p.id === pk.poi); if (!poi) continue;
    const xz = ll => toXZ(ll[0], ll[1]), bnd = pk.boundary.map(xz);
    const inRing = (r, x, z) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++){ const a = r[i], b = r[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    const roofs = (pk.buildings || []).map(r => r.map(xz)), within = (x, z) => inRing(bnd, x, z) && !roofs.some(r => inRing(r, x, z) || r.some(q => Math.hypot(q[0] - x, q[1] - z) < 5));
    const mat = new Map(), M3 = col => mat.get(col) || mat.set(col, new THREE.MeshLambertMaterial({color: col})).get(col);
    const bx = (w, h, d, col, x, y, z, rz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M3(col)); m.position.set(x, y, z); m.rotation.z = rz; return m; };
    const quad = (o = {}) => { const {L = 1.8, H = .8, W = .6, leg = 1, neck = .8, na = -.6, col = '#a9794f', lcol = col, head = .6, tail = .4, mane, ears, hump} = o, g = new THREE.Group(), top = leg + H;
      g.add(bx(L, H, W, col, 0, leg + H / 2, 0)); for (const [x, z] of [[.38, .3], [.38, -.3], [-.38, .3], [-.38, -.3]]) g.add(bx(L * .1 + .06, leg, W * .26, lcol, x * L, leg / 2, z * W));
      const nx = L / 2 - .1 - Math.sin(na) * neck / 2, ny = top - .15 + Math.cos(na) * neck / 2; g.add(bx(H * .46, neck, W * .62, col, nx, ny, 0, na));
      const hx = L / 2 - .1 - Math.sin(na) * neck + head * .3, hy = top - .15 + Math.cos(na) * neck; g.add(bx(head, head * .58, W * .7, col, hx, hy, 0));
      if (mane) g.add(bx(head * .9, head * 1.25, W * 1.25, mane, hx - head * .55, hy - .05, 0)); if (ears) for (const sd of [1, -1]) g.add(bx(.1, ears, .16, col, hx - head * .3, hy + head * .3 + ears / 2, sd * W * .3));
      if (hump) g.add(bx(L * .4, hump, W * .7, col, 0, top + hump / 2, 0)); if (tail) g.add(bx(.1, tail, .1, lcol, -L / 2 - .04, top - tail / 2, 0)); return g; };
    const FIG = {                                                      // simple block figures; only for animals the park itself lists
      giraffe: () => quad({L: 2.2, H: 1, W: .7, leg: 1.9, neck: 2.3, na: -.35, col: '#d7a34a', lcol: '#c08f3c', head: .6, ears: .22, tail: .9}),
      lion: () => quad({L: 2, H: .8, W: .7, leg: .75, neck: .5, col: '#c9a25a', mane: '#8a5a2b', head: .55, tail: .9}),
      tiger: () => quad({L: 2.1, H: .8, W: .7, leg: .75, neck: .45, col: '#d9822b', lcol: '#2a2522', head: .55, tail: 1}),
      leopard: () => quad({L: 1.6, H: .6, W: .5, leg: .6, neck: .4, col: '#d2ab5c', head: .45, tail: .9}),
      snowleopard: () => quad({L: 1.6, H: .6, W: .5, leg: .6, neck: .4, col: '#d8d4c8', head: .45, tail: 1.1}),
      bear: () => quad({L: 2, H: 1.1, W: 1, leg: .7, neck: .4, na: -1.1, col: '#2a2522', head: .7, tail: 0, ears: .18}),
      wolf: () => quad({L: 1.4, H: .55, W: .42, leg: .7, neck: .45, col: '#8d8a84', head: .45, tail: .6, ears: .16}),
      fox: () => quad({L: .9, H: .35, W: .3, leg: .4, neck: .3, col: '#c8642c', head: .32, tail: .55, ears: .14}),
      camel: () => quad({L: 2.3, H: .9, W: .7, leg: 1.4, neck: 1.3, na: -.3, col: '#c2a06a', head: .55, tail: .5, hump: .45}),
      llama: () => quad({L: 1.5, H: .7, W: .5, leg: .9, neck: 1, na: -.15, col: '#e4dccb', head: .4, tail: .2, ears: .2}),
      alpaca: () => quad({L: 1.3, H: .7, W: .5, leg: .7, neck: .8, na: -.15, col: '#b08a62', head: .38, tail: .2, ears: .16}),
      deer: () => quad({L: 1.6, H: .65, W: .5, leg: .95, neck: .8, col: '#a9794f', head: .5, tail: .25, ears: .2}),
      goat: () => quad({L: 1, H: .5, W: .4, leg: .5, neck: .4, col: '#e9e2d2', head: .35, tail: .15, ears: .14}),
      sheep: () => quad({L: 1.1, H: .65, W: .6, leg: .45, neck: .3, col: '#efe9dc', lcol: '#3a3531', head: .35, tail: 0}),
      pig: () => quad({L: 1.2, H: .6, W: .55, leg: .3, neck: .2, na: -1.3, col: '#d9a59a', head: .4, tail: .15}),
      donkey: () => quad({L: 1.5, H: .65, W: .5, leg: .85, neck: .7, col: '#8f8780', head: .5, tail: .6, ears: .3}),
      zebra: () => quad({L: 1.9, H: .8, W: .6, leg: 1, neck: .8, col: '#eeeae0', lcol: '#2a2522', head: .55, tail: .6, mane: '#2a2522'}),
      capybara: () => quad({L: 1.1, H: .55, W: .5, leg: .3, neck: .2, na: -1.2, col: '#8a6a45', head: .42, tail: 0}),
      porcupine: () => quad({L: .8, H: .5, W: .5, leg: .2, neck: .15, na: -1.3, col: '#4a4038', head: .28, tail: .3}),
      otter: () => quad({L: .9, H: .25, W: .25, leg: .15, neck: .25, col: '#5a4332', head: .25, tail: .5}),
      alligator: () => { const g = new THREE.Group(), C = '#4d5a3a'; g.add(bx(1.8, .3, .6, C, 0, .25, 0), bx(1.4, .18, .3, C, -1.5, .2, 0), bx(.9, .2, .4, C, 1.3, .22, 0)); return g; },
      tortoise: () => { const g = new THREE.Group(); const sh = new THREE.Mesh(new THREE.SphereGeometry(.55, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M3('#6b5a3a')); sh.position.y = .15; g.add(sh, bx(.3, .2, .22, '#8a8053', .62, .25, 0)); return g; },
      monkey: (col = '#6b4a2e') => { const g = new THREE.Group(); g.add(bx(.4, .6, .35, col, 0, .55, 0), bx(.32, .3, .3, col, .05, 1.02, 0), bx(.16, .16, .2, '#e2c9a8', .2, 1, 0), bx(.12, .5, .1, col, .02, .4, .22), bx(.12, .5, .1, col, .02, .4, -.22), bx(.08, .08, .7, col, -.2, .3, 0), bx(.08, .7, .08, col, -.28, .5, 0)); return g; },
      lemur: () => { const g = FIG.monkey('#8d8a84'); g.add(bx(.1, 1, .1, '#2a2522', -.32, .95, 0)); return g; },
      kangaroo: () => { const g = new THREE.Group(), C = '#b58a5c'; g.add(bx(.5, 1, .45, C, 0, .9, 0, -.3), bx(.3, .3, .26, C, .3, 1.55, 0), bx(.08, .3, .1, C, .25, 1.82, .1), bx(.08, .3, .1, C, .25, 1.82, -.1), bx(.5, .14, .14, C, .2, .08, .2), bx(.5, .14, .14, C, .2, .08, -.2), bx(1.1, .16, .16, C, -.75, .3, 0, .35)); return g; },
      bird: (col = '#c8452c', wing = '#33506f') => { const g = new THREE.Group(); g.add(bx(.1, 1.4, .1, '#7d5a3c', 0, .7, 0), bx(.7, .07, .07, '#7d5a3c', 0, 1.4, 0), bx(.25, .42, .25, col, 0, 1.68, 0), bx(.2, .2, .2, col, .06, 1.98, 0), bx(.14, .08, .08, '#e7dcc3', .2, 1.96, 0), bx(.08, .4, .28, wing, -.12, 1.62, 0), bx(.08, .5, .1, wing, -.14, 1.3, 0, .25)); return g; },
      owl: () => FIG.bird('#8a6a45', '#5a4332'), eagle: () => FIG.bird('#4a3a2a', '#2a2522'), macaw: () => FIG.bird('#c8452c', '#33506f'), parrot: () => FIG.bird('#5c8a3a', '#e0a52c'),
      emu: () => { const g = new THREE.Group(), C = '#5a4a3a'; g.add(bx(.9, .7, .6, C, 0, 1.25, 0), bx(.1, .9, .1, '#8a8053', .1, .45, .15), bx(.1, .9, .1, '#8a8053', .1, .45, -.15), bx(.14, .9, .14, C, .5, 1.95, 0, -.2), bx(.26, .16, .16, C, .66, 2.4, 0)); return g; },
      peacock: () => { const g = FIG.bird('#2f6f8c', '#3f7f5a'); g.children.slice(0, 2).forEach(m => m.visible = false); g.children.slice(2).forEach(m => m.position.y -= 1.1); g.add(bx(.08, 1, 1.2, '#3f7f5a', -.4, .9, 0, .3)); return g; }
    };
    let grp = null;
    const build = () => {
      grp = new THREE.Group();
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of bnd){ x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      x0 -= 15; x1 += 15; z0 -= 15; z1 += 15;
      const S = Math.min(6, 4096 / Math.max(x1 - x0, z1 - z0)), cv = document.createElement('canvas'); cv.width = Math.ceil((x1 - x0) * S); cv.height = Math.ceil((z1 - z0) * S);
      const g = cv.getContext('2d'), tr = ll => { const [x, z] = xz(ll); return [(x - x0) * S, (z - z0) * S]; }, trace = (pts, close) => { g.beginPath(); pts.forEach((ll, i) => { const [a, b] = tr(ll); i ? g.lineTo(a, b) : g.moveTo(a, b); }); if (close) g.closePath(); };
      g.lineJoin = g.lineCap = 'round';
      trace(pk.boundary, true); g.fillStyle = 'rgba(214,224,180,.5)'; g.fill();
      for (const r of pk.parking || []){ trace(r, true); g.fillStyle = '#d9d2c2'; g.fill(); }
      for (const r of pk.fairways || []){ trace(r, true); g.fillStyle = '#b9d08a'; g.fill(); }
      for (const r of pk.greens || []){ trace(r, true); g.fillStyle = '#8fc070'; g.fill(); g.strokeStyle = '#5c8a4a'; g.lineWidth = Math.max(1, .3 * S); g.stroke(); }
      for (const r of pk.tees || []){ trace(r, true); g.fillStyle = '#7fae62'; g.fill(); }
      for (const r of pk.bunkers || []){ trace(r, true); g.fillStyle = '#efe3bd'; g.fill(); }
      for (const r of pk.ponds || []){ trace(r, true); g.fillStyle = '#9fbcc0'; g.fill(); }
      for (const r of pk.pitches || []){ trace(r, true); g.fillStyle = 'rgba(190,170,120,.55)'; g.fill(); g.strokeStyle = '#8a7350'; g.lineWidth = Math.max(1, .25 * S); g.stroke(); }
      for (const l of pk.holes || []){ trace(l); g.setLineDash([3 * S, 3 * S]); g.strokeStyle = 'rgba(60,80,50,.6)'; g.lineWidth = Math.max(1, .5 * S); g.stroke(); g.setLineDash([]); }
      for (const l of pk.piers || []){ trace(l); g.strokeStyle = '#8a7350'; g.lineWidth = 2.4 * S; g.stroke(); }
      for (const l of pk.drives || []){ trace(l); g.strokeStyle = '#e6dfcf'; g.lineWidth = 4.5 * S; g.stroke(); }
      for (const l of pk.paths || []){ trace(l); g.strokeStyle = '#8a7350'; g.lineWidth = 3.6 * S; g.stroke(); g.strokeStyle = '#ecdcb4'; g.lineWidth = 2.8 * S; g.stroke(); }
      for (const r of pk.buildings || []){ trace(r, true); g.fillStyle = '#b9a98c'; g.fill(); g.strokeStyle = '#5a4a3a'; g.lineWidth = Math.max(1, .35 * S); g.stroke(); }
      trace(pk.boundary, true); g.setLineDash([5 * S, 4 * S]); g.strokeStyle = '#7a3b2e'; g.lineWidth = 1.1 * S; g.stroke(); g.setLineDash([]);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 60, 60).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, 0, (z0 + z1) / 2), P = geo.attributes.position;
      for (let i = 0; i < P.count; i++) P.setY(i, Y(P.getX(i), P.getZ(i)) + .7);
      const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5})); plane.renderOrder = 3; grp.add(plane);
      grp.add(new THREE.HemisphereLight('#ffffff', '#8a8370', 2.4));
      const tag = (text, x, z, cls, lift) => { const el = document.createElement('div'); el.className = 'lb pk ' + cls; el.textContent = text; const it = addLabel(el, x, z, lift, 'center'); it.maxD = cls === 'an' ? 1100 : pk.labelD || 2600; return it; };
      for (const q of pk.pts || []){ const [x, z] = xz(q.ll); tag(q.n, x, z, 'fa', 5); }
      /* the figures stand beside the footpaths, evenly spaced: decoration, not a plan of the enclosures */
      const segs = []; let total = 0; for (const l of pk.paths || []){ const q = l.map(xz); for (let i = 1; i < q.length; i++){ const d = Math.hypot(q[i][0] - q[i-1][0], q[i][1] - q[i-1][1]); segs.push([q[i-1], q[i], d]); total += d; } }
      const figs = (pk.figures || []).filter(f => FIG[f.fig]); const SC = pk.figScale || 2.6;
      figs.forEach((f, i) => { let t = (i + .5) / figs.length * total, sg = segs[0]; for (const s2 of segs){ if (t <= s2[2]){ sg = s2; break; } t -= s2[2]; }
        const k = sg[2] ? t / sg[2] : 0, dx = (sg[1][0] - sg[0][0]) / (sg[2] || 1), dz = (sg[1][1] - sg[0][1]) / (sg[2] || 1); let side = i % 2 ? 1 : -1, off = 8 + SC * 1.5;
        let x = sg[0][0] + (sg[1][0] - sg[0][0]) * k - dz * side * off, z = sg[0][1] + (sg[1][1] - sg[0][1]) * k + dx * side * off;
        if (!within(x, z)){ side = -side; x = sg[0][0] + (sg[1][0] - sg[0][0]) * k - dz * side * off; z = sg[0][1] + (sg[1][1] - sg[0][1]) * k + dx * side * off; }
        const m = FIG[f.fig](); m.scale.setScalar(SC); m.position.set(x, Y(x, z) + .8, z); m.rotation.y = Math.atan2(dz * side, -dx * side) + Math.PI / 2 + (i * 2.4 % 1.2 - .6); grp.add(m);
        tag(f.n, x, z, 'an', SC * (f.tall || 2.4) + 3); });
      scene.add(grp);
    };
    const parkSheet = () => {
      if (!grp) build();
      const A = pk.animals || [];
      openSheet(pk.kick || 'A closer look', poi.name,
        (pk.intro ? `<p>${esc(pk.intro)}</p>` : '') + (pk.lines || []).map(l => `<p>${esc(l)}</p>`).join('') +
        (A.length ? `<div class="sec">Animals the park lists</div>` + A.map(gp => `<p style="margin:6px 0 0"><b>${esc(gp.t)}</b><br>${esc(gp.list.join(' · '))}</p>`).join('') : '') +
        (pk.things && pk.things.length ? `<div class="sec">Things to do</div>` + pk.things.map(t => `<div class="gi"><h3>${esc(t.n)}</h3><p>${esc(t.note || '')}</p></div>`).join('') : '') +
        (pk.visit ? `<div class="sec">Visiting</div><p>${esc(pk.visit)}</p>` : '') +
        `<div class="acts">${pk.url ? `<a class="btn pri" href="${esc(pk.url)}" target="_blank" rel="noopener">Website</a>` : ''}<button class="btn" id="pkPlace">Directions</button><button class="btn" id="pkShare">Share</button></div>
         <p class="fine">${esc(pk.fine || '')}${pk.updated ? ' Checked ' + esc(pk.updated) + '.' : ''}</p>`);
      panel.querySelector('#pkPlace').onclick = () => openPlace(poi); panel.querySelector('#pkShare').onclick = () => share(poi.name, '?park=' + encodeURIComponent(pk.id));
      const c0 = bnd.reduce((a, q) => [a[0] + q[0] / bnd.length, a[1] + q[1] / bnd.length], [0, 0]), at = pk.focus ? xz(pk.focus) : c0; flyTo(at[0], at[1], pk.viewD || 520);
    };
    poi.park = pk; if (c.hooks) (c.hooks.parks = c.hooks.parks || {})[poi.id] = parkSheet;
    if (Q.get('park') === pk.id) setTimeout(parkSheet, 900);
  }

  /* ---------- essentials and getting here (built by data/fetch_essentials.py from OpenStreetMap) ---------- */
  const ES = await getJSON('essentials.json');
  if (ES && ((ES.groups || []).some(g => g.items.length) || (ES.here || []).length)){
    const GOT = (ES.groups || []).some(g => g.items.length);
    const ONE = {'Hospital and urgent care': 'Clinic', 'Pharmacy': 'Pharmacy', 'Groceries': 'Supermarket', 'Gas': 'Gas station', 'EV charging': 'EV charger', 'ATM and banks': 'ATM', 'Public restrooms': 'Restroom'};
    let pinned = false; const flat = [];
    const essSheet = () => {
      flat.length = 0; const hrs = m => { m = Math.round(m / 5) * 5; return m < 60 ? m + ' min' : `${Math.floor(m / 60)} h${m % 60 ? ' ' + m % 60 + ' min' : ''}`; };
      openSheet('Practical', GOT ? 'Essentials' : 'Getting here', (ES.groups.filter(g => g.items.length).map(g => `<div class="sec">${esc(g.t)} · ${g.items.length}</div><div class="plist">${g.items.map(it => { flat.push(it);
          return `<button data-e="${flat.length - 1}">${esc(it.n || ONE[g.t] || g.t)}${it.er ? ' · emergency room' : ''}<small>${esc([it.a, it.h].filter(Boolean).join(' · '))}</small></button>`; }).join('')}</div>`).join('')) +
        (ES.here && ES.here.length ? `<div class="sec">Getting here</div>${ES.here.map(h => `<p style="margin:3px 0"><b>${esc(h.n)}</b> · ${h.mi} miles · about ${hrs(h.min)}</p>`).join('')}<p class="fine">Driving to the visitors center by the dam, worked out from OpenStreetMap roads with no traffic or stops. Allow more on summer weekends.</p>` : '') +
        (!GOT ? '' : `<p class="fine">In an emergency call 911. Places come from OpenStreetMap volunteers and may be out of date or missing: phone ahead for anything urgent.${ES.updated ? ' Gathered ' + esc(ES.updated) + '.' : ''}</p>`));
      panel.querySelectorAll('button[data-e]').forEach(b => b.onclick = () => { const it = flat[+b.dataset.e], [x, z] = toXZ(it.lat, it.lon); flyTo(x, z, 1300); });
      if (!pinned){ pinned = true; for (const g of ES.groups) for (const it of g.items){ const [x, z] = toXZ(it.lat, it.lon), el = document.createElement('div'); el.className = 'lb pk fa'; el.textContent = it.n || ONE[g.t] || g.t; addLabel(el, x, z, 6, 'center').maxD = 4200; } }
    };
    addChip(GOT ? 'Essentials' : 'Getting here', essSheet); if (Q.has('essentials')) setTimeout(essSheet, 800);
  }

  /* ---------- find by: a few things you can tell from the map itself, plus whatever owners have told us (tags.json) ---------- */
  { const TG = (await getJSON('tags.json')) || {}, lake = D.water.filter(w => w.n === 'Lake Wallenpaupack').map(w => w.o);
    const seg = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p.x - a[0] - t * dx, p.z - a[1] - t * dz); };
    const shore = p => { let d = 1e9; for (const r of lake) for (let i = 1; i < r.length; i++){ if (Math.abs(r[i][0] - p.x) > 600 && Math.abs(r[i-1][0] - p.x) > 600) continue; d = Math.min(d, seg(p, r[i-1], r[i])); } return d; };
    const boat = new Set(DINE ? DINE.sections.flatMap(s => (s.items || []).map(i => i.poi)) : []);
    const sets = [
      {id: 'lake', label: 'On the lake', why: 'Places to eat, drink or stay within about 300 feet of the lake shore, measured on this map. Being near the water is not the same as having a view or a dock.', list: () => D.pois.filter(p => (p.cat === 'food' || p.cat === 'stay') && shore(p) < 92)},
      {id: 'boat', label: 'Arrive by boat', why: 'Places that say customers can come by boat. Call ahead about docking.', list: () => D.pois.filter(p => boat.has(p.id))},
      {id: 'open', label: 'Open now', why: 'Only places whose hours are on the map; most have not told us theirs yet.', list: () => D.pois.filter(p => { const o = openNow(p); return o && o.open; })},
      ...Object.entries(TG.tags || {}).map(([id, t]) => ({id, label: t.label, why: t.why || 'Told to us by the owners.', list: () => D.pois.filter(p => (TG.places && TG.places[p.id] || []).includes(id))}))];
    const findSheet = id => { const lists = sets.map(t => ({...t, got: t.list().sort((a, b) => a.name.localeCompare(b.name))})).filter(t => t.got.length || t.id === 'open'), t = lists.find(t => t.id === id) || lists[0]; if (!t) return;
      openSheet('Find by', t.label, `<div class="tabs">${lists.map(o => `<button data-tag="${esc(o.id)}" aria-pressed="${o === t}">${esc(o.label)}</button>`).join('')}</div><p>${esc(t.why)}</p>` +
        (t.got.length ? `<div class="plist">${t.got.map(p => `<button data-poi="${esc(p.id)}">${esc(p.name)}<small>${esc(p.kind || '')}</small></button>`).join('')}</div>` : '<p><b>None right now.</b></p>') +
        `<p class="fine">Run a place? Use 'Claim or correct' on its pin to add dog friendly, kid friendly, open late and more.</p>`);
      panel.querySelectorAll('button[data-tag]').forEach(b => b.onclick = () => findSheet(b.dataset.tag)); };
    addChip('Find by…', () => findSheet()); if (Q.has('find')) setTimeout(() => findSheet(Q.get('find')), 800);
  }

  /* ---------- day plans: the publisher's own picks; hidden until plans.json says approved (preview with ?plans=preview) ---------- */
  const PL = await getJSON('plans.json');
  if (PL && (PL.plans || []).length && (PL.approved || Q.get('plans') === 'preview' || PL.plans.some(p => p.id === Q.get('plan') && PL.approved))){
    const planSheet = id => {
      const pl = PL.plans.find(p => p.id === id) || PL.plans[0], stops = pl.stops.map(s => ({...s, p: D.pois.find(p => p.id === s.poi)})).filter(s => s.p);
      openSheet('Day plans', pl.title, `<div class="tabs">${PL.plans.map(o => `<button data-plan="${esc(o.id)}" aria-pressed="${o === pl}">${esc(o.short || o.title)}</button>`).join('')}</div>` +
        (PL.approved ? '' : '<p class="fine" style="margin:0 0 8px">Draft for review: not shown to the public yet.</p>') + (pl.intro ? `<p>${esc(pl.intro)}</p>` : '') +
        stops.map((s, i) => `<div class="gi"><h3><button data-poi="${esc(s.p.id)}">${i + 1}. ${esc(s.p.name)}</button></h3><p>${esc(s.note || s.p.kind || '')}</p></div>`).join('') +
        `<p class="fine">${esc(PL.fine || '')}</p><button class="wide" id="planShare">Share this plan</button>`);
      panel.querySelectorAll('button[data-plan]').forEach(b => b.onclick = () => planSheet(b.dataset.plan));
      panel.querySelector('#planShare').onclick = () => share(pl.title, '?plan=' + encodeURIComponent(pl.id));
      if (stops.length){ const x = stops.reduce((a, s) => a + s.p.x, 0) / stops.length, z = stops.reduce((a, s) => a + s.p.z, 0) / stops.length;
        flyTo(x, z, Math.max(3500, 2.6 * Math.max(...stops.map(s => Math.hypot(s.p.x - x, s.p.z - z))))); }
    };
    addChip('Day plans', () => planSheet());
    if (Q.has('plan') || Q.get('plans') === 'preview') setTimeout(() => planSheet(Q.get('plan')), 800);
  }

  /* ---------- for businesses: what a listing is, claiming or correcting one, and a printable QR card ---------- */
  const BZ = (await getJSON('business.json')) || {}, CT = (DEMO ? BZ.demo : BZ.contact) || {};
  const here = location.origin + location.pathname;
  const cardLink = p => `card.html?p=${encodeURIComponent(p.id)}&n=${encodeURIComponent(p.name)}`;
  function bizSheet(){
    const mail = CT.email ? `<a class="btn pri" href="mailto:${esc(CT.email)}?subject=${encodeURIComponent('Lake Wallenpaupack map: featured pin')}">Email ${esc(CT.email)}</a>` : '';
    const form = CT.form ? `<a class="btn pri" href="${esc(CT.form)}" target="_blank" rel="noopener">Get in touch</a>` : '';
    openSheet('For businesses', BZ.title || 'Put your business on the map',
      (BZ.intro ? `<p>${esc(BZ.intro)}</p>` : '') +
      `<div class="sec">Your free listing</div><p>${esc(BZ.free || '')}</p>
       <div class="sec">A featured pin</div><ul style="margin:4px 0 0;padding-left:20px;font-size:16px;line-height:1.4">${(BZ.featured || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>` +
      (CT.price ? `<p style="font:600 20px var(--serif);margin:10px 0 0">${esc(CT.price)}</p>` : '') +
      `<div class="acts">${mail}${form}<a class="btn" href="?demo&town=hawley">See a sample</a><a class="btn" href="?tour&wx=clear&day">Watch the tour</a></div>` +
      (mail || form ? '' : `<p><b>${esc(BZ.soon || 'Enquiries open soon.')}</b></p>`) +
      `<div class="sec">Free tools</div><div class="acts"><a class="btn" href="?host">Guest link for rental hosts</a><button class="btn" id="bzEmbed">Map for your website</button></div>` +
      (DEMO ? '<p class="fine">Sample view: the contact and price shown here are placeholders.</p>' : '') +
      `<p class="fine">${esc(BZ.fine || '')}</p>`);
    panel.querySelector('#bzEmbed').onclick = () => embedSheet(null);
  }
  function embedSheet(p){                                // a small copy of the map for a business's own website
    const src = `${here}?embed${p ? '&p=' + encodeURIComponent(p.id) : ''}`, code = `<iframe src="${src}" title="Map of Lake Wallenpaupack" width="100%" height="420" style="border:1px solid #22303a" loading="lazy"></iframe>`;
    openSheet('For your website', p ? p.name : 'The lake map', `<p>Paste this into your website where you want the map to appear${p ? ', centred on your pin' : ''}. It is free, and visitors can open the full map from it.</p>
      <textarea id="emCode" rows="5" readonly style="width:100%;box-sizing:border-box;font:13px ui-monospace,Menlo,monospace;padding:8px;border:1px solid var(--ink);background:#fffdf6;color:var(--ink)">${esc(code)}</textarea>
      <div class="acts"><button class="btn pri" id="emCopy">Copy the code</button><a class="btn" href="${esc(src)}" target="_blank" rel="noopener">Preview</a></div>
      <p class="fine">Most site builders have an "embed" or "HTML" block for this. The map may not be altered, and its credit line must stay visible.</p>`);
    panel.querySelector('#emCopy').onclick = () => navigator.clipboard ? navigator.clipboard.writeText(code).then(() => say('Code copied.'), () => say('Could not copy.')) : panel.querySelector('#emCode').select();
  }
  function claimSheet(p){
    const f = (id, label, ph = '', type = 'text') => `<label style="display:block;margin:8px 0 0;font:700 11px var(--sc);letter-spacing:.13em">${label}<input id="cl_${id}" type="${type}" placeholder="${esc(ph)}" style="display:block;width:100%;box-sizing:border-box;margin-top:3px;font:500 16px var(--serif);padding:7px 8px;border:1px solid var(--ink);background:#fffdf6;color:var(--ink)"></label>`;
    const tick = (id, label) => `<label style="display:block;margin:6px 0 0;font-size:15.5px"><input id="cl_${id}" type="checkbox"> ${label}</label>`;
    openSheet('Claim or correct', p.name,
      `<p>Run or own this place? Tell us what is right. Nothing is published until it has been checked.</p>` +
      f('who', 'Your name and role', 'Pat Smith, owner') + f('reach', 'Phone or email', '') + f('site', 'Website', 'https://') + f('resv', 'Reservations link (OpenTable, Resy, your own)', 'https://') + f('order', 'Online ordering or delivery link', 'https://') +
      `<label style="display:block;margin:8px 0 0;font:700 11px var(--sc);letter-spacing:.13em">Opening hours<textarea id="cl_hours" rows="3" placeholder="Mon–Thu 11–9, Fri–Sat 11–10, closed Sun; closed January" style="display:block;width:100%;box-sizing:border-box;margin-top:3px;font:500 16px var(--serif);padding:7px 8px;border:1px solid var(--ink);background:#fffdf6;color:var(--ink)"></textarea></label>` +
      tick('dock', 'Customers can arrive by boat') + tick('fuel', 'Fuel dock') + tick('pump', 'Pump-out') + tick('dog', 'Dog friendly') + tick('kid', 'Good for kids') + tick('late', 'Open after 9 pm') + tick('gone', 'This place has closed or moved') + tick('feat', 'Tell me about a featured pin') +
      `<label style="display:block;margin:8px 0 0;font:700 11px var(--sc);letter-spacing:.13em">Anything else<textarea id="cl_note" rows="2" style="display:block;width:100%;box-sizing:border-box;margin-top:3px;font:500 16px var(--serif);padding:7px 8px;border:1px solid var(--ink);background:#fffdf6;color:var(--ink)"></textarea></label>
       <div class="acts">${CT.email ? '<button class="btn pri" id="clSend">Send by email</button>' : CT.form ? '<button class="btn pri" id="clSend">Copy and open the form</button>' : ''}<button class="btn" id="clCopy">Copy the details</button><a class="btn" href="${esc(cardLink(p))}" target="_blank" rel="noopener">Print a QR card</a><button class="btn" id="clEmbed">Map for your website</button></div>` +
      (CT.email || CT.form ? '' : `<p><b>${esc(BZ.soon || 'Sending opens soon.')}</b> You can copy your details for now.</p>`) +
      `<p class="fine">${CT.email ? 'Send opens your own email app with the details filled in; attach a photo there if you would like one shown. ' : ''}Only send a photo you took or have the right to share.</p>`);
    const v = id => panel.querySelector('#cl_' + id), text = () => [`Place: ${p.name} (${p.kind || ''})`, `Map link: ${here}?p=${p.id}`, `From: ${v('who').value}`, `Reach me at: ${v('reach').value}`, `Website: ${v('site').value}`, `Reservations link: ${v('resv').value}`, `Ordering link: ${v('order').value}`, `Hours: ${v('hours').value}`,
      `Arrive by boat: ${v('dock').checked ? 'yes' : '-'}`, `Fuel dock: ${v('fuel').checked ? 'yes' : '-'}`, `Pump-out: ${v('pump').checked ? 'yes' : '-'}`, `Dog friendly: ${v('dog').checked ? 'yes' : '-'}`, `Good for kids: ${v('kid').checked ? 'yes' : '-'}`, `Open after 9 pm: ${v('late').checked ? 'yes' : '-'}`, `Closed or moved: ${v('gone').checked ? 'yes' : '-'}`, `Featured pin: ${v('feat').checked ? 'please tell me more' : '-'}`, `Notes: ${v('note').value}`].join('\n');
    const copy = () => navigator.clipboard ? navigator.clipboard.writeText(text()).then(() => say('Details copied.'), () => say('Could not copy.')) : say('Could not copy.');
    panel.querySelector('#clCopy').onclick = copy; panel.querySelector('#clEmbed').onclick = () => embedSheet(p);
    const send = panel.querySelector('#clSend'); if (send) send.onclick = () => { if (!v('who').value.trim() || !v('reach').value.trim()) return say('Please add your name and how to reach you.');
      if (CT.email) location.href = `mailto:${CT.email}?subject=${encodeURIComponent('Lake Wallenpaupack map: ' + p.name)}&body=${encodeURIComponent(text())}`; else { copy(); open(CT.form, '_blank', 'noopener'); } };
  }
  if (c.hooks){ c.hooks.claim = claimSheet; c.hooks.biz = bizSheet; }
  if (Q.has('business')) setTimeout(bizSheet, 800);
  if (BZ.counter && BZ.counter.goatcounter && !DEMO && !Q.has('tour')){     // visitor counting stays off until a site code is set in business.json
    const sc = document.createElement('script'); sc.async = true; sc.src = 'https://gc.zgo.at/count.js'; sc.dataset.goatcounter = `https://${BZ.counter.goatcounter}.goatcounter.com/count`; document.head.appendChild(sc);
  }

  /* ---------- eating out: real booking and ordering links where the owner has given them (links.json), otherwise a search of the usual apps ---------- */
  const LK = ((await getJSON('links.json')) || {}).places || {};
  if (c.hooks) c.hooks.food = p => {
    const k = LK[p.id] || {}, ph = (p.facts || []).find(f => f[0] === 'Phone'), town = ((p.facts || []).find(f => f[0] === 'Address') || ['', ''])[1].split(', ').pop(), q = encodeURIComponent(p.name), qt = encodeURIComponent(p.name + (town ? ' ' + town + ' PA' : ''));
    const a = (href, label, pri) => `<a class="btn${pri ? ' pri' : ''}" href="${esc(href)}" target="_blank" rel="noopener" style="flex:0 1 auto">${label}</a>`;
    const own = (k.reserve ? a(k.reserve, 'Reserve a table', 1) : '') + (k.order ? a(k.order, 'Order online', !k.reserve) : '');
    return `<div class="sec" style="margin-top:10px">Book or order</div><div class="acts" style="margin-top:6px">${own}${ph ? `<a class="btn" href="tel:${esc(ph[1].replace(/[^0-9+]/g, ''))}" style="flex:0 1 auto">Call</a>` : ''}</div>
      <p class="fine" style="margin:6px 0 2px">${own ? 'Or look' : 'Look'} for it on ${k.reserve ? '' : `<a href="https://www.opentable.com/s?term=${qt}" target="_blank" rel="noopener">OpenTable</a> · `}<a href="https://www.doordash.com/search/store/${q}/" target="_blank" rel="noopener">DoorDash</a> · <a href="https://www.ubereats.com/search?q=${q}" target="_blank" rel="noopener">Uber Eats</a> · <a href="https://www.grubhub.com/search?queryText=${q}" target="_blank" rel="noopener">Grubhub</a>. These search each service by name; we don't know which ones this place uses.</p>`; };
  { const open = panel.classList.contains('open') && D.pois.find(p => p.cat === 'food' && pinEls.get(p.id) && pinEls.get(p.id).classList.contains('sel')); if (open && !panel.querySelector('#clSend, #cl_who')) openPlace(open); }   // a card opened from a link before this loaded gets its buttons now

  /* ---------- waterfalls: a pin and a small moving cascade where the creek drops (falls.json) ---------- */
  const added = new Set(((SP && SP.sponsors) || []).filter(s => s.add).map(s => s.poi));
  const FL = await getJSON('falls.json'), flows = [];
  for (const f of (FL && FL.falls) || []){
    const [x, z] = toXZ(f.lat, f.lon), p = {id: f.id, name: f.n, cat: 'nature', kind: 'Waterfall', x, z, dlat: f.lat, dlon: f.lon, blurb: f.blurb, facts: f.facts, url: f.url, urlLabel: f.urlLabel, major: true};
    const el = document.createElement('button'); el.className = 'lb pin'; el.style.setProperty('--c', CATS.nature.c); el.innerHTML = `<span class="tag"></span><span class="stem"></span><span class="dot"></span>`;
    el.firstChild.textContent = p.name; el.addEventListener('click', e => { e.stopPropagation(); openPlace(p); }); pinEls.set(p.id, el); addLabel(el, x, z, 14).poi = p; D.pois.push(p); added.add(p.id);
    /* the cascade: the creek's line through the falls, stepped down in three drops and painted with running white water */
    const pts = f.line.map(q => toXZ(q[0], q[1])), cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i-1] + Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]));
    const L = cum[cum.length - 1], at = d => { let i = 1; while (i < pts.length - 1 && cum[i] < d) i++; const k = (d - cum[i-1]) / (cum[i] - cum[i-1] || 1); return [pts[i-1][0] + (pts[i][0] - pts[i-1][0]) * k, pts[i-1][1] + (pts[i][1] - pts[i-1][1]) * k]; };
    const prof = [[0, 11], [.3, 11], [.33, 7], [.5, 7], [.53, 3.6], [.68, 3.6], [.71, 1], [1, 1]], W = f.width || 13, pos = [], uv = [], idx = [];
    prof.forEach(([t, lift], i) => { const a = at(Math.max(0, t * L - 1)), b = at(Math.min(L, t * L + 1)), c0 = at(t * L), dx = b[0] - a[0], dz = b[1] - a[1], n = Math.hypot(dx, dz) || 1, ox = -dz / n * W / 2, oz = dx / n * W / 2;
      const y = Y(c0[0], c0[1]) + lift; pos.push(c0[0] + ox, y, c0[1] + oz, c0[0] - ox, y, c0[1] - oz); const v = t * L / 14 + (11 - lift) / 5; uv.push(0, -v, 1, -v);
      if (i){ const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#b9d3d6'; g.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 70; i++){ g.fillStyle = `rgba(255,255,255,${.35 + Math.random() * .6})`; g.fillRect(Math.random() * 64, Math.random() * 128, 1 + Math.random() * 3, 8 + Math.random() * 34); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, side: THREE.DoubleSide})); m.renderOrder = 2; scene.add(m); flows.push(tex);
    const end = at(L), foam = new THREE.Mesh(new THREE.CircleGeometry(W * .7, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({color: '#f4f8f8', transparent: true, opacity: .75, depthWrite: false})); foam.position.set(end[0], Y(end[0], end[1]) + 1.2, end[1]); scene.add(foam);
  }
  if (Q.has('falls') && FL && FL.falls && FL.falls[0]){ const [fx, fz] = toXZ(FL.falls[0].lat, FL.falls[0].lon); setTimeout(() => flyTo(fx, fz, 380), 900); }   // ?falls goes straight to the waterfall
  if (flows.length){ let last = performance.now(); const run = now => { const dt = Math.min(.1, (now - last) / 1000); last = now; for (const t of flows) t.offset.y += dt * .9; requestAnimationFrame(run); }; requestAnimationFrame(run); }
  { const pid = Q.get('p'); if (pid && added.has(pid) && !c.EMBED){ const p = D.pois.find(p => p.id === pid); if (p) setTimeout(() => openPlace(p), 300); } }   // places added here load after the page's own ?p= check

  if (Q.has('town')){ const t = TOWNS.find(t => t.n.toLowerCase() === Q.get('town').toLowerCase()); if (t) setTimeout(() => townSheet(t.n), 800); }

  /* ---------- the overview tour: ?tour plays a captioned fly-through with the controls hidden, for recording a video ---------- */
  if (Q.has('tour')){
    const T = (await getJSON('tour.json')) || {};
    document.body.classList.add('tour');
    const cap = document.createElement('div'); cap.id = 'tourCap'; cap.innerHTML = '<b></b><span></span>'; document.body.appendChild(cap);
    const town = n => TOWNS.find(t => t.n === n), near = t => D.pois.filter(p => inTown(t, p)).length;
    const marina = D.pois.find(p => /Lighthouse Harbor/.test(p.name)) || D.pois.find(p => p.kind === 'Marina');
    const [lx, lz] = toXZ(41.4115, -75.248), [mx, mz] = toXZ(41.432, -75.212);
    const zf = innerHeight > innerWidth ? 1.35 : 1;                   // an upright (phone-shaped) recording stands further back
    const intro = {x: lx, z: lz, d: [34000, 23000], az: [-.3, .05], pol: [.72, .86], s: 11, b: 'Lake Wallenpaupack', t: 'The whole lake, and the towns around it, in 3D'};
    const end = {x: lx, z: lz, d: [20000, 30000], az: [-.1, -.35], pol: [.9, .78], s: 11, b: T.endTitle || 'Put your business on the map', t: T.endLine || 'Featured pins, photos and listings for local businesses'};
    const tw = Q.get('tour') && town(TOWNS.map(t => t.n).find(n => n.toLowerCase() === Q.get('tour').toLowerCase())), biz = Q.get('biz') && D.pois.find(p => p.id === Q.get('biz'));
    let shots;
    if (biz){                                                          // ?tour&biz=<place id>: a short clip that flies to one business, shown as a featured pin
      const el = pinEls.get(biz.id), it = itemOf(biz); if (el){ el.classList.remove('minor'); el.classList.add('feat', 'sel'); } if (it){ it.maxD = 0; it.w = 0; } biz.major = true;
      shots = [{...intro, d: [30000, 24000], s: 5, t: 'The whole lake in 3D'},
        {x: biz.x, z: biz.z, d: [3800, 1700], az: [-.7, -.15], pol: [.9, 1.1], s: 7, b: biz.name, t: 'On the map of Lake Wallenpaupack'},
        {x: biz.x, z: biz.z, d: [1700, 1150], az: [-.15, .45], pol: [1.1, 1.16], s: 8, b: T.bizTitle || 'Your pin, featured', t: T.bizLine || 'Always on the map · first in your town guide · your photo and link'},
        {...end, s: 6}];
    } else if (tw){                                                    // ?tour=hawley: a short clip for one town
      shots = [{...intro, d: [30000, 24000], s: 5, t: 'The whole lake in 3D'},
        {x: tw.x, z: tw.z, d: [3800, 2900], az: [-.6, -.1], pol: [.9, 1.08], s: 9, b: tw.n, t: `${near(tw)} places to eat, shop and stay`},
        {x: tw.x, z: tw.z, d: [2900, 1900], az: [-.1, .5], pol: [1.08, 1.14], s: 8, b: 'Every shop, table and bed', t: 'Tap any pin for directions and details'},
        {...end, s: 6}];
    } else shots = [intro,
      {x: mx, z: mz, d: [9500, 6800], az: [.5, 1.05], pol: [1.0, 1.1], s: 10, b: 'Every cove, road and community', t: `${D.roads.length.toLocaleString()} roads · ${D.towns.length} towns and communities`},
      marina && {x: marina.x, z: marina.z, d: [1900, 1250], az: [-.2, .6], pol: [1.05, 1.15], s: 10, b: 'Marinas, launches and beaches', t: 'Zoom in for houses, trees, boats and wildlife'},
      ...['Hawley', 'Honesdale', 'Greentown'].map(n => town(n) && {x: town(n).x, z: town(n).z, d: [3600, 2500], az: [-.5, .25], pol: [.95, 1.1], s: 10, b: n, t: `${near(town(n))} places to eat, shop and stay`}),
      {x: lx, z: lz, d: [12000, 16000], az: [1.2, 1.7], pol: [1.12, 1.0], s: 9, b: 'Weather, events, fishing and trails', t: 'Live, and updated through the year'},
      end].filter(Boolean);
    const total = shots.reduce((a, s) => a + s.s, 0), ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, v = new THREE.Vector3();
    let t0 = 0, cur = -1, stop = false;
    addEventListener('keydown', e => { if (e.key === 'Escape'){ stop = true; document.body.classList.remove('tour'); cap.remove(); } });
    function step(now){
      if (stop) return; if (!t0) t0 = now + (Q.has('wait') ? +Q.get('wait') * 1000 || 3000 : 2500);
      let t = (now - t0) / 1000; if (t < 0) t = 0; if (t >= total){ if (Q.has('loop')) { t0 = now; t = 0; } else t = total - .001; }
      let i = 0, acc = 0; while (i < shots.length - 1 && t >= acc + shots[i].s){ acc += shots[i].s; i++; }
      const s = shots[i], k = ease(Math.min(1, (t - acc) / s.s)), L = a => a[0] + (a[1] - a[0]) * k;
      if (i !== cur){ cur = i; cap.classList.remove('on'); setTimeout(() => { cap.firstChild.textContent = s.b; cap.lastChild.textContent = s.t; cap.classList.add('on'); }, cur ? 700 : 0); }
      if (t - acc > s.s - 1 && i < shots.length - 1) cap.classList.remove('on');
      c.stopFly(); place(v.set(s.x, Y(s.x, s.z), s.z), L(s.az), L(s.pol), L(s.d) * zf);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
}
