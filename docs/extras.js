/* Lake Wallenpaupack map — town guides, homes for sale, sponsored places, trails, boating, opening hours and the overview tour.
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
  const {THREE, scene, D, M, Y, openSheet, openPlace, flyTo, esc, panel, chips, items, pinEls, addLabel, place, controls, camera, say, share, CATS} = c;
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
#tourCap{position:fixed;left:0;right:0;bottom:11%;z-index:8;text-align:center;pointer-events:none;opacity:0;transition:opacity .9s}
#tourCap.on{opacity:1}#tourCap b{display:inline-block;font:600 clamp(30px,4.6vw,64px)/1.05 var(--serif);color:var(--ink);background:rgba(247,242,230,.9);padding:.18em .5em .22em;box-shadow:6px 6px 0 rgba(34,48,58,.16);border:1px solid var(--ink)}
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
    const row = p => { const o = openNow(p); return `<button data-poi="${esc(p.id)}">${esc(p.name)}<small>${esc(p.kind || '')}${o && o.open ? ' · open now' : ''}</small>${p.sponsor ? '<span class="sp">Sponsored</span>' : ''}</button>`; };
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
      guide(BO, 'On the water', 'Boating', BO.bandFeet ? `<button class="wide" id="bandBtn" style="margin:0 0 6px"></button>` : '');
      const b = panel.querySelector('#bandBtn'); if (!b) return;
      const label = () => b.textContent = band && band.visible ? 'Hide the no-wake band' : `Show the ${BO.bandFeet}-foot no-wake band`;
      label(); b.onclick = () => { band = band || makeBand(); if (!band) return; band.visible = !band.visible; chip.classList.toggle('fx', band.visible); label();
        if (band.visible) say(`Orange band: within ${BO.bandFeet} feet of shore. An illustration, not a chart.`); };
    });
    if (Q.has('boating')) setTimeout(() => chip.click(), 800);
  }

  if (Q.has('town')){ const t = TOWNS.find(t => t.n.toLowerCase() === Q.get('town').toLowerCase()); if (t) setTimeout(() => townSheet(t.n), 800); }

  /* ---------- the overview tour: ?tour plays a captioned fly-through with the controls hidden, for recording a video ---------- */
  if (Q.has('tour')){
    const T = (await getJSON('tour.json')) || {};
    document.body.classList.add('tour');
    const cap = document.createElement('div'); cap.id = 'tourCap'; cap.innerHTML = '<b></b><span></span>'; document.body.appendChild(cap);
    const town = n => TOWNS.find(t => t.n === n), near = t => D.pois.filter(p => inTown(t, p)).length;
    const marina = D.pois.find(p => /Lighthouse Harbor/.test(p.name)) || D.pois.find(p => p.kind === 'Marina');
    const [lx, lz] = toXZ(41.4115, -75.248), [mx, mz] = toXZ(41.432, -75.212);
    const shots = [
      {x: lx, z: lz, d: [34000, 23000], az: [-.3, .05], pol: [.72, .86], s: 11, b: 'Lake Wallenpaupack', t: 'The whole lake, and the towns around it, in 3D'},
      {x: mx, z: mz, d: [9500, 6800], az: [.5, 1.05], pol: [1.0, 1.1], s: 10, b: 'Every cove, road and community', t: `${D.roads.length.toLocaleString()} roads · ${D.towns.length} towns and communities`},
      marina && {x: marina.x, z: marina.z, d: [1900, 1250], az: [-.2, .6], pol: [1.05, 1.15], s: 10, b: 'Marinas, launches and beaches', t: 'Zoom in for houses, trees, boats and wildlife'},
      ...['Hawley', 'Honesdale', 'Greentown'].map(n => town(n) && {x: town(n).x, z: town(n).z, d: [3600, 2500], az: [-.5, .25], pol: [.95, 1.1], s: 10, b: n, t: `${near(town(n))} places to eat, shop and stay`}),
      {x: lx, z: lz, d: [12000, 16000], az: [1.2, 1.7], pol: [1.12, 1.0], s: 9, b: 'Weather, events, fishing and trails', t: 'Live, and updated through the year'},
      {x: lx, z: lz, d: [20000, 30000], az: [-.1, -.35], pol: [.9, .78], s: 11, b: T.endTitle || 'Put your business on the map', t: T.endLine || 'Featured pins, photos and listings for local businesses'},
    ].filter(Boolean);
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
      c.stopFly(); place(v.set(s.x, Y(s.x, s.z), s.z), L(s.az), L(s.pol), L(s.d));
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
}
