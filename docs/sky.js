/* Lake Wallenpaupack map — the sky: live weather, night, fireworks, Santa, and the events list.
   © 2026 DeWitt Hutchins. All rights reserved.
   Test switches: ?wx=snow|rain|storm|fog|cloudy|clear  ?night=1  ?fx=fireworks|santa */
const TRAFFIC_KEY = '4eOfmF8XexLCSPsE5iGLfHHYVkbRUriY';      // TomTom key, restricted to this site's address; empty = no traffic layer
export function initSky(c){
  const {THREE, scene, camera, M, D, openSheet, flyTo, esc, chips, maxH, getCamD, panel, tiles} = c;
  const Q = new URLSearchParams(location.search);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl = document.getElementById('gl');
  const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k, v){ try { localStorage.setItem(k, v); } catch(e){} } };
  let animate = store.get('lake-wx') !== 'off';

  /* ---------- overlays ---------- */
  const css = document.createElement('style');
  css.textContent = `#night,#haze,#flash,#wxc,#fxc{position:absolute;inset:0;pointer-events:none}
#wxc,#fxc{width:100%;height:100%}
#night{background:#101a3a;mix-blend-mode:multiply;opacity:0;transition:opacity 3s}
#haze{background:#8f979c;opacity:0;transition:opacity 3s}
#flash{background:#fff;opacity:0}
.chip.sky{background:var(--card);border-color:var(--ink)}
.chip.sky.alert{border-color:#b5562f;color:#8a3b30}
.chip.sky.fx{background:#7a3b2e;color:#fbf7ee;border-color:#7a3b2e}
#panel .wxnow{font:600 34px var(--serif);margin:2px 0 2px}
#panel .wxrow{display:grid;grid-template-columns:62px 46px 1fr;gap:8px;padding:6px 0;border-bottom:1px solid rgba(141,154,151,.55);font:500 16px var(--serif)}
#panel .wxrow small{color:var(--ink-soft);font-size:14px}
#panel .wxalert{border-left:3px solid #b5562f;padding:2px 0 2px 10px;margin:10px 0}
#panel .ev{display:grid;grid-template-columns:64px 1fr;gap:12px;padding:10px 0;border-bottom:1px solid rgba(141,154,151,.55)}
#panel .ev .when{font:700 11px var(--sc);letter-spacing:.12em;color:#7a3b2e;text-align:center;line-height:1.25}
#panel .ev .when b{display:block;font:600 26px var(--serif);letter-spacing:0;color:var(--ink)}
#panel .ev h3{margin:0;font:600 18.5px var(--serif)}
#panel .ev h3 button{all:unset;cursor:pointer}
#panel .ev h3 button:hover{color:#7a3b2e}
#panel .ev p{margin:2px 0 0;font-size:15.5px;line-height:1.3}
#panel .ev .meta{font:600 10.5px var(--sc);letter-spacing:.12em;color:var(--ink-soft)}
#panel .ev a{color:#7a3b2e}
#panel .tog{font:700 12px var(--sc);letter-spacing:.14em;background:none;border:1px solid var(--ink);color:var(--ink);padding:8px 12px;cursor:pointer;margin-top:12px}`;
  document.head.appendChild(css);
  const mk = (tag, id) => { const e = document.createElement(tag); e.id = id; return e; };
  const night = mk('div', 'night'), haze = mk('div', 'haze'), wxc = mk('canvas', 'wxc'), fxc = mk('canvas', 'fxc'), flash = mk('div', 'flash');
  gl.after(haze, night, wxc, fxc, flash);
  const wg = wxc.getContext('2d'), fg = fxc.getContext('2d');
  let CW = 1, CH = 1;
  function fit(){ CW = gl.clientWidth; CH = gl.clientHeight; for (const cv of [wxc, fxc]){ cv.width = CW; cv.height = CH; } }
  addEventListener('resize', fit); fit();

  /* ---------- time at the lake ---------- */
  const LAT = 41.42, LON = -75.22;
  function lakeDate(d = new Date()){
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(d).map(x => [x.type, x.value]));
    return {ymd: `${p.year}-${p.month}-${p.day}`, md: `${p.month}-${p.day}`, h: +p.hour + +p.minute / 60};
  }
  function sunAlt(d = new Date()){                    // degrees above the horizon, good to about a degree
    const n = d / 864e5 - 10957.5, L = (280.46 + .9856474 * n) % 360, g = (357.528 + .9856003 * n) * Math.PI / 180;
    const lam = (L + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * Math.PI / 180, eps = 23.439 * Math.PI / 180;
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const gmst = (18.697374558 + 24.06570982441908 * n) % 24, ha = (gmst * 15 + LON) * Math.PI / 180 - ra, la = LAT * Math.PI / 180;
    return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) * 180 / Math.PI;
  }
  const dark = () => Q.has('night') || Q.has('fx') ? 1 : Math.min(1, Math.max(0, (3 - sunAlt()) / 10));   // 0 by day, 1 once the sun is 7° down

  /* ---------- weather: National Weather Service hourly forecast for the lake ---------- */
  const W = {kind: 'clear', heavy: 0, cover: 0, wind: 0, dir: 270, temp: null, text: '', periods: [], alerts: [], ok: false};
  const DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  function read(text, pop){
    const s = text.toLowerCase(), maybe = /chance/.test(s) && (pop == null || pop < 55);
    let kind = 'clear', cover = 0;
    if (/mostly (sunny|clear)/.test(s)) cover = .2; else if (/partly/.test(s)) cover = .45; else if (/mostly cloudy/.test(s)) cover = .75; else if (/cloud|overcast/.test(s)) cover = 1;
    if (cover > .3) kind = 'cloudy';
    if (!maybe){
      if (/thunder/.test(s)) kind = 'storm'; else if (/snow|flurr|blizzard|sleet|wintry|ice|freezing/.test(s)) kind = 'snow';
      else if (/rain|shower|drizzle/.test(s)) kind = 'rain'; else if (/fog|haze|mist/.test(s)) kind = 'fog';
    } else cover = Math.max(cover, .7), kind = 'cloudy';
    if (kind !== 'clear' && kind !== 'cloudy') cover = Math.max(cover, .9);
    return {kind, cover, heavy: /heavy/.test(s) ? 1 : /light|flurr|drizzle/.test(s) ? .35 : .65};
  }
  const chip = document.createElement('button'); chip.className = 'chip sky'; chip.style.display = 'none'; chip.onclick = weatherSheet; chips.prepend(chip);
  async function load(){
    try {
      const [f, a] = await Promise.all([
        fetch('https://api.weather.gov/gridpoints/BGM/94,30/forecast/hourly').then(r => r.json()),
        fetch(`https://api.weather.gov/alerts/active?point=${LAT},${LON}`).then(r => r.json()).catch(() => ({features: []}))]);
      const now = Date.now(), ps = f.properties.periods.filter(p => new Date(p.endTime) > now);
      const p = ps[0]; if (!p) return;
      Object.assign(W, read(p.shortForecast, p.probabilityOfPrecipitation && p.probabilityOfPrecipitation.value),
        {temp: p.temperature, text: p.shortForecast, wind: parseInt(p.windSpeed) || 0, dir: Math.max(0, DIRS.indexOf(p.windDirection)) * 22.5, from: p.windDirection, periods: ps.slice(0, 12),
         alerts: (a.features || []).map(x => x.properties), ok: true});
    } catch(e){ /* no forecast: the map simply shows fair weather */ }
    const force = Q.get('wx');
    if (force) Object.assign(W, {kind: force, cover: force === 'clear' ? 0 : .9, heavy: .8, wind: W.wind || 9, text: W.text || force, ok: true});
    apply();
  }
  function apply(){
    if (W.ok){ chip.style.display = ''; chip.textContent = (W.temp != null ? W.temp + '° ' : '') + W.text; chip.classList.toggle('alert', W.alerts.length > 0);
      chip.title = W.alerts.length ? W.alerts.map(a => a.event).join(', ') : 'Weather at the lake'; }
    seed(); clouds();
  }
  function weatherSheet(){
    const hr = t => new Date(t).toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric'});
    openSheet('Weather', 'At the lake now',
      `<div class="wxnow">${W.temp != null ? W.temp + '°F' : ''}</div><p>${esc(W.text)}${W.wind ? ` · wind ${esc(W.from || '')} ${W.wind} mph` : ''}</p>` +
      W.alerts.map(a => `<div class="wxalert"><b>${esc(a.event)}</b><br><span class="fine" style="margin:0">${esc(a.headline || '')}</span></div>`).join('') +
      `<div class="sec">Next hours</div>` + W.periods.map(p => `<div class="wxrow"><span>${hr(p.startTime)}</span><b>${p.temperature}°</b><span>${esc(p.shortForecast)} <small>${esc(p.windDirection)} ${esc(p.windSpeed)}</small></span></div>`).join('') +
      `<button class="tog" id="wxTog">${animate ? 'Turn weather effects off' : 'Turn weather effects on'}</button>
       <p class="fine">Hourly forecast and alerts from the U.S. National Weather Service for the middle of the lake. The rain, snow, clouds and night shading on the map follow it; they are an illustration, not a radar picture.</p>`);
    panel.querySelector('#wxTog').onclick = () => { animate = !animate; store.set('lake-wx', animate ? 'on' : 'off'); apply(); weatherSheet(); };
  }

  /* rain and snow fall across the screen, leaning with the wind as seen from where you are looking */
  let drops = [];
  function seed(){
    const wet = animate && !still && (W.kind === 'rain' || W.kind === 'storm' || W.kind === 'snow');
    const n = wet ? Math.round((W.kind === 'snow' ? 150 : 210) * (.4 + W.heavy) * Math.min(2, CW * CH / 9e5)) : 0;
    drops = Array.from({length: n}, () => ({x: Math.random() * CW, y: Math.random() * CH, k: .6 + Math.random() * .8, ph: Math.random() * 6.3}));
  }
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
  function lean(){                                   // the wind's direction on screen, from the camera's point of view
    const a = W.dir * Math.PI / 180; v0.set(0, 0, 0).project(camera); v1.set(-Math.sin(a) * 800, 0, Math.cos(a) * 800).project(camera);
    const dx = (v1.x - v0.x), dy = -(v1.y - v0.y), l = Math.hypot(dx, dy) || 1; return dx / l;
  }
  function precip(t, dt){
    wg.clearRect(0, 0, CW, CH); if (!drops.length) return;
    const snow = W.kind === 'snow', push = lean() * Math.min(1.2, W.wind / 14);
    if (snow){ wg.fillStyle = 'rgba(255,255,255,.95)'; wg.strokeStyle = 'rgba(96,116,138,.45)'; wg.lineWidth = .8; }
    else { wg.strokeStyle = 'rgba(62,88,116,.42)'; wg.lineWidth = 1.1; wg.beginPath(); }
    for (const d of drops){
      const vy = snow ? 55 * d.k : 950 * d.k, vx = snow ? push * 70 + Math.sin(t * 1.3 + d.ph) * 18 : push * 420;
      d.x += vx * dt; d.y += vy * dt;
      if (d.y > CH + 20){ d.y = -20; d.x = Math.random() * CW; } if (d.x > CW + 20) d.x = -20; else if (d.x < -20) d.x = CW + 20;
      if (snow){ wg.beginPath(); wg.arc(d.x, d.y, 1.1 + d.k * 1.3, 0, 6.3); wg.fill(); wg.stroke(); }
      else { wg.moveTo(d.x, d.y); wg.lineTo(d.x - vx * .017, d.y - vy * .017); }
    }
    if (!snow) wg.stroke();
  }

  /* clouds drift over the lake with the wind */
  const cg = new THREE.Group(); scene.add(cg);
  const ctex = [0, 1, 2].map(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    for (let i = 0; i < 7; i++){ const px = 70 + Math.random() * 116, py = 96 + Math.random() * 64, r = 38 + Math.random() * 44, gr = x.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 256, 256); }
    return new THREE.CanvasTexture(cv); });
  const span = M.xmax - M.xmin, zspan = M.zmax - M.zmin;
  function clouds(){
    const want = animate ? Math.round(W.cover * 22) : 0;
    while (cg.children.length > want){ const m = cg.children[cg.children.length - 1]; cg.remove(m); m.geometry.dispose(); m.material.dispose(); }
    while (cg.children.length < want){
      const s = 1800 + Math.random() * 3200, grey = W.kind === 'rain' || W.kind === 'storm' ? .8 : 1;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s * .7).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({map: ctex[cg.children.length % 3], transparent: true, opacity: .5, depthWrite: false, color: new THREE.Color(grey, grey, grey)}));
      m.position.set(M.xmin + Math.random() * span, maxH + 700 + Math.random() * 500, M.zmin + Math.random() * zspan); m.rotation.y = Math.random() * 6.3; m.renderOrder = 6; cg.add(m);
    }
  }
  function drift(dt, camD){
    if (!cg.children.length) return;
    const a = W.dir * Math.PI / 180, sp = still ? 0 : (6 + W.wind) * 4, fade = Math.min(1, Math.max(0, (camD - 1800) / 2500));
    for (const m of cg.children){ m.position.x += -Math.sin(a) * sp * dt; m.position.z += Math.cos(a) * sp * dt; m.material.opacity = .5 * fade;
      if (m.position.x > M.xmax + 2500) m.position.x = M.xmin - 2500; else if (m.position.x < M.xmin - 2500) m.position.x = M.xmax + 2500;
      if (m.position.z > M.zmax + 2500) m.position.z = M.zmin - 2500; else if (m.position.z < M.zmin - 2500) m.position.z = M.zmax + 2500; }
    cg.visible = fade > 0;
  }
  let nextFlash = 0;
  function mood(t){
    const dk = dark();
    night.style.opacity = (animate ? dk * .42 : 0).toFixed(2);
    haze.style.opacity = (animate ? (W.kind === 'fog' ? .34 : W.cover * .13) * (1 - dk * .6) : 0).toFixed(2);
    if (animate && !still && W.kind === 'storm'){ if (!nextFlash) nextFlash = t + 4 + Math.random() * 8;
      if (t > nextFlash){ flash.animate([{opacity: 0}, {opacity: .55}, {opacity: .1}, {opacity: .4}, {opacity: 0}], {duration: 420}); nextFlash = t + 6 + Math.random() * 14; } }
  }

  /* ---------- events ---------- */
  let EV = {events: []};
  const toXZ = (lat, lon) => [(lon - M.lon0) * M.kx, -(lat - M.lat0) * M.kz];
  const fmt = (ymd, o) => new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', o);
  function upcoming(){ const today = lakeDate().ymd; return EV.events.filter(e => (e.d1 || e.d0 || '9999') >= today || !e.d0).sort((a, b) => (a.d0 || a.sort || '9999').localeCompare(b.d0 || b.sort || '9999')); }
  function eventsSheet(){
    const list = upcoming();
    const row = (e, i) => { const tba = !e.d0;
      const when = tba ? `<div class="when">${esc(e.usual || 'Date to come')}</div>` : `<div class="when">${fmt(e.d0, {month: 'short'}).toUpperCase()}<b>${+e.d0.slice(8)}</b>${e.d1 && e.d1 !== e.d0 ? 'to ' + fmt(e.d1, {month: 'short', day: 'numeric'}) : fmt(e.d0, {weekday: 'short'}).toUpperCase()}</div>`;
      const name = e.lat ? `<button data-ev="${i}">${esc(e.n)}</button>` : esc(e.n);
      return `<div class="ev">${when}<div><h3>${name}</h3><div class="meta">${esc([e.time, e.where].filter(Boolean).join(' · '))}</div>${e.note ? `<p>${esc(e.note)}</p>` : ''}${tba && e.last ? `<p class="fine" style="margin:2px 0 0">Next date not announced yet. Last held ${esc(e.last)}.</p>` : ''}${e.url ? `<p><a href="${esc(e.url)}" target="_blank" rel="noopener">Details from the organiser</a></p>` : ''}</div></div>`; };
    openSheet('What’s on', 'Events around the lake', (list.length ? list.map(row).join('') : '<p>No events listed yet.</p>') +
      `<p class="fine">Collected from the organisers' own pages${EV.updated ? ', last checked ' + fmt(EV.updated, {month: 'long', day: 'numeric', year: 'numeric'}) : ''}. Dates and times change: check with the organiser before you go.</p>`);
    panel.querySelectorAll('button[data-ev]').forEach(b => b.onclick = () => { const e = list[+b.dataset.ev], [x, z] = toXZ(e.lat, e.lon); flyTo(x, z, 2600); });
  }
  const bEv = document.getElementById('bEvents'); if (bEv) bEv.onclick = eventsSheet;

  /* ---------- live traffic on the major roads (TomTom flow tiles, laid over the ground) ---------- */
  const tkey = Q.get('tk') || TRAFFIC_KEY;
  if (tkey){
    const TS = 2048, tc = document.createElement('canvas'); tc.width = tc.height = TS; const tx = tc.getContext('2d');
    const ttex = new THREE.CanvasTexture(tc); ttex.colorSpace = THREE.SRGBColorSpace; ttex.anisotropy = 8;
    const tg = new THREE.Group(); tg.visible = false; scene.add(tg);
    const tm = new THREE.MeshBasicMaterial({map: ttex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
    for (const t of tiles){ const m = new THREE.Mesh(t.mesh.geometry, tm); m.renderOrder = 1; tg.add(m); }
    const XS = M.xmax - M.xmin, ZS = M.zmax - M.zmin, px = x => (x - M.xmin) / XS * TS, pz = z => (z - M.zmin) / ZS * TS;
    const Z = 13, n = 2 ** Z, lon2x = lon => Math.floor((lon + 180) / 360 * n), lat2y = lat => Math.floor((1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    const x2lon = x => x / n * 360 - 180, y2lat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    let on = false, timer = 0;
    const tchip = document.createElement('button'); tchip.className = 'chip sky'; tchip.textContent = 'Traffic'; tchip.title = 'Live traffic on the major roads'; chip.after(tchip);
    const credit = document.getElementById('credit');
    async function draw(){
      const jobs = [];
      for (let x = lon2x(M.W); x <= lon2x(M.E); x++) for (let y = lat2y(M.N); y <= lat2y(M.S); y++) jobs.push(new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = () => res({im, x, y}); im.onerror = () => res(null); im.src = `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/${Z}/${x}/${y}.png?key=${encodeURIComponent(tkey)}&tileSize=512`; }));
      const got = (await Promise.all(jobs)).filter(Boolean);
      if (!got.length){ tchip.textContent = 'Traffic unavailable'; return; }
      tx.globalCompositeOperation = 'source-over'; tx.clearRect(0, 0, TS, TS);
      for (const {im, x, y} of got){ const [x0, z0] = toXZ(y2lat(y), x2lon(x)), [x1, z1] = toXZ(y2lat(y + 1), x2lon(x + 1)); tx.drawImage(im, px(x0), pz(z0), px(x1) - px(x0), pz(z1) - pz(z0)); }
      tx.globalCompositeOperation = 'destination-in'; tx.lineCap = tx.lineJoin = 'round'; tx.strokeStyle = '#000'; tx.lineWidth = 90 / XS * TS; tx.beginPath();   // keep only what lies along a major road
      for (const r of D.roads) if (r.k !== 'street') r.p.forEach((p, i) => i ? tx.lineTo(px(p[0]), pz(p[1])) : tx.moveTo(px(p[0]), pz(p[1])));
      tx.stroke(); tx.globalCompositeOperation = 'source-over'; ttex.needsUpdate = true;
      tchip.textContent = 'Traffic · live';
    }
    tchip.onclick = () => { on = !on; tg.visible = on; tchip.classList.toggle('fx', on); clearInterval(timer);
      let note = document.getElementById('ttc'); if (on && !note && credit){ note = document.createElement('span'); note.id = 'ttc'; note.textContent = ' Traffic © TomTom.'; credit.appendChild(note); } if (note) note.hidden = !on;
      if (on){ tchip.textContent = 'Traffic…'; draw(); timer = setInterval(draw, 5 * 60e3); } else tchip.textContent = 'Traffic'; };
  }

  /* ---------- fireworks ---------- */
  const PAL = ['#ff5a4a', '#ffd257', '#7fd0ff', '#8dff9a', '#ff8ad8', '#ffffff', '#ffb04a', '#b79bff'];
  let show = null, sparks = [], shells = [], lastCam = '';
  function startShow(x, z, label){
    if (show) return; show = {x, z, y: c.Y(x, z) + 4, next: 0};
    const b = document.createElement('button'); b.className = 'chip sky fx'; b.textContent = label || 'Fireworks tonight'; b.onclick = () => flyTo(x + 200, z + 700, 4200); chips.prepend(b);
  }
  function fireworks(t, dt, camD){
    if (!show || still){ if (!show) return; }
    const K = Math.min(5, Math.max(1.5, camD / 3000));              // stand farther back and the bursts grow so you can still see them
    if (!still && t > show.next){ show.next = t + (Math.random() < .12 ? .12 : .35 + Math.random() * 1.1);
      shells.push({x: show.x + (Math.random() - .5) * 160, z: show.z + (Math.random() - .5) * 160, y: show.y, vy: 190 + Math.random() * 60, top: 300 + Math.random() * 220, col: PAL[Math.floor(Math.random() * PAL.length)], y0: show.y}); }
    for (const s of shells){ s.y += s.vy * dt; if (s.y - s.y0 > s.top){ s.done = true;
      const n = 70 + Math.floor(Math.random() * 60), sp = 105 + Math.random() * 85, two = Math.random() < .3 ? PAL[Math.floor(Math.random() * PAL.length)] : s.col, willow = Math.random() < .25;
      for (let i = 0; i < n; i++){ const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = Math.sqrt(1 - u * u), v = sp * (.82 + Math.random() * .3);
        sparks.push({x: s.x, y: s.y, z: s.z, vx: r * Math.cos(a) * v, vy: u * v, vz: r * Math.sin(a) * v, life: 0, ttl: (willow ? 2.9 : 1.7) + Math.random() * .8, col: i % 2 ? two : s.col, g: willow ? 26 : 15, ox: s.x, oy: s.y0, oz: s.z}); } } }
    shells = shells.filter(s => !s.done);
    const cam = camera.matrixWorld.elements.map(v => v.toFixed(1)).join();
    if (cam !== lastCam){ fg.clearRect(0, 0, CW, CH); lastCam = cam; }
    else { fg.globalCompositeOperation = 'destination-out'; fg.fillStyle = 'rgba(0,0,0,.3)'; fg.fillRect(0, 0, CW, CH); }
    fg.globalCompositeOperation = 'source-over';
    const dot = (x, y, z, ox, oy, oz, col, al, r) => { v0.set(ox + (x - ox) * K, oy + (y - oy) * K, oz + (z - oz) * K).project(camera); if (v0.z > 1) return;
      fg.globalAlpha = al; fg.fillStyle = col; fg.beginPath(); fg.arc((v0.x + 1) / 2 * CW, (1 - v0.y) / 2 * CH, r, 0, 6.3); fg.fill(); };
    for (const s of shells) dot(s.x, s.y, s.z, s.x, s.y0, s.z, '#ffe9b0', .9, 1.6);
    for (const p of sparks){ p.life += dt; const drag = Math.exp(-1.3 * dt); p.vx *= drag; p.vy = p.vy * drag - p.g * dt; p.vz *= drag; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const k = 1 - p.life / p.ttl; if (k > 0) dot(p.x, p.y, p.z, p.ox, p.oy, p.oz, p.col, Math.min(1, k * 1.4), 1.2 + k * 1.6); }
    sparks = sparks.filter(p => p.life < p.ttl); fg.globalAlpha = 1;
  }

  /* ---------- Santa ---------- */
  let santa = null;
  function startSanta(){
    if (santa) return;
    const mat = col => new THREE.MeshBasicMaterial({color: col});
    const box = (w, h, d, col, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col)); m.position.set(x, y, z); return m; };
    const ball = (r, col, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat(col)); m.position.set(x, y, z); return m; };
    const g = new THREE.Group(), RED = '#c0281f', GOLD = '#e0b04a', FUR = '#b07a44', WHITE = '#fbf7ee';
    g.add(box(3, 1, 1.7, RED, 0, .95, 0), box(.4, 1.5, 1.7, RED, -1.5, 1.7, 0), box(.4, .9, 1.7, RED, 1.5, 1.4, 0), box(3.2, .14, 1.74, GOLD, 0, 1.5, 0),
      box(4, .14, .14, GOLD, .1, .2, .75), box(4, .14, .14, GOLD, .1, .2, -.75), box(.14, .6, .14, GOLD, 2, .5, .75), box(.14, .6, .14, GOLD, 2, .5, -.75),
      ball(.85, '#3f6b3a', -.75, 2.05, 0), box(1, 1.1, 1, RED, .45, 1.95, 0), box(1.04, .16, 1.04, '#22303a', .45, 1.75, 0), ball(.36, '#e3c19a', .5, 2.85, 0), ball(.3, WHITE, .72, 2.68, 0), ball(.16, WHITE, .1, 3.5, 0));
    const hat = new THREE.Mesh(new THREE.ConeGeometry(.36, .75, 10), mat(RED)); hat.position.set(.42, 3.3, 0); hat.rotation.z = .35; g.add(hat, box(.8, .16, .8, WHITE, .5, 3.02, 0));
    const deer = [];
    const reindeer = (x, z, lead) => { const d = new THREE.Group(); d.add(box(1.5, .6, .5, FUR, 0, 1.1, 0), box(.5, .45, .4, FUR, .95, 1.6, 0), box(.3, .5, .3, FUR, .7, 1.35, 0), box(.2, .22, .2, WHITE, -.8, 1.2, 0),
        box(.1, .5, .1, '#d8c39a', .9, 2.05, .17), box(.1, .5, .1, '#d8c39a', .9, 2.05, -.17), box(.34, .1, .1, '#d8c39a', .98, 2.2, .17), box(.34, .1, .1, '#d8c39a', .98, 2.2, -.17));
      const legs = [[.55, .17], [.55, -.17], [-.55, .17], [-.55, -.17]].map(([lx, lz]) => { const l = box(.13, .85, .13, FUR, lx, .45, lz); d.add(l); return l; });
      if (lead) d.add(ball(.15, '#ff2a1a', 1.24, 1.6, 0)); d.position.set(x, 0, z); g.add(d); deer.push({d, legs, ph: Math.random() * 6}); };
    for (let i = 0; i < 4; i++){ reindeer(4 + i * 2.5, 1); reindeer(4 + i * 2.5, -1); } reindeer(14.4, 0, true);
    g.add(box(11.5, .05, .05, GOLD, 8.2, 1.25, 1), box(11.5, .05, .05, GOLD, 8.2, 1.25, -1));
    scene.add(g);
    // once round the lake, following the shore of the big lake
    const lake = D.water.reduce((a, b) => (b.o.length > a.o.length ? b : a)), step = Math.max(1, Math.floor(lake.o.length / 18));
    const pts = lake.o.filter((_, i) => i % step === 0).map(p => new THREE.Vector3(p[0], maxH + 260, p[1]));
    const path = new THREE.CatmullRomCurve3(pts, true, 'centripetal'), len = path.getLength();
    santa = {g, deer, path, len, u: Math.random(), trail: []};
    const b = document.createElement('button'); b.className = 'chip sky fx'; b.textContent = 'Find Santa'; b.onclick = () => flyTo(g.position.x, g.position.z, 3600); chips.prepend(b);
  }
  const pa = new THREE.Vector3(), pb = new THREE.Vector3();
  function flySanta(t, dt, camD){
    if (!santa) return; const s = santa;
    if (!still) s.u = (s.u + dt * 130 / s.len) % 1;
    s.path.getPointAt(s.u, pa); s.path.getPointAt((s.u + .004) % 1, pb);
    const k = Math.min(110, Math.max(4, camD / 150));
    s.g.position.copy(pa); s.g.position.y += Math.sin(t * .8) * 12; s.g.scale.setScalar(k);
    s.g.rotation.y = -Math.atan2(pb.z - pa.z, pb.x - pa.x); s.g.rotation.z = Math.sin(t * .8 + 1.4) * .06;
    for (const r of s.deer){ r.d.position.y = Math.sin(t * 7 + r.ph) * .16; r.legs.forEach((l, i) => l.rotation.z = Math.sin(t * 7 + r.ph + (i < 2 ? 0 : Math.PI)) * .7); }
    if (still) return;
    if (Math.random() < dt * 16){ const hx = pb.x - pa.x, hz = pb.z - pa.z, hl = Math.hypot(hx, hz) || 1, back = -(2.5 + Math.random() * 2) * k;
      s.trail.push({x: pa.x + hx / hl * back + (Math.random() - .5) * k, y: s.g.position.y + (.4 + Math.random() * 1.4) * k, z: pa.z + hz / hl * back + (Math.random() - .5) * k, life: 0, ttl: 1.4 + Math.random()}); }
    if (!show){ const cam = camera.matrixWorld.elements.map(v => v.toFixed(1)).join(); fg.globalCompositeOperation = 'source-over'; fg.clearRect(0, 0, CW, CH); lastCam = cam; }
    fg.globalCompositeOperation = 'lighter';
    for (const p of s.trail){ p.life += dt; p.y -= 6 * dt * k / 6; const q = 1 - p.life / p.ttl; if (q <= 0) continue; v0.set(p.x, p.y, p.z).project(camera); if (v0.z > 1) continue;
      fg.globalAlpha = q * .8; fg.fillStyle = '#ffd97a'; fg.beginPath(); fg.arc((v0.x + 1) / 2 * CW, (1 - v0.y) / 2 * CH, .6 + q * 1.2, 0, 6.3); fg.fill(); }
    s.trail = s.trail.filter(p => p.life < p.ttl); fg.globalAlpha = 1;
  }

  /* ---------- what is on today ---------- */
  function season(){
    const now = lakeDate(), fx = Q.get('fx'), dk = dark();
    const site = EV.fireworks || {lat: 41.4585, lon: -75.1795};
    const fwDay = (EV.fireworksDates || ['07-04']).includes(now.md) || EV.events.some(e => e.fx === 'fireworks' && e.d0 === now.ymd);
    if (fx === 'fireworks' || (fwDay && dk > .85 && now.h > 12)){ const [x, z] = toXZ(site.lat, site.lon); startShow(x, z); }
    if (fx === 'santa' || now.md === '12-24' || (now.md === '12-25' && now.h < 7)) startSanta();
  }

  fetch('events.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : EV).then(j => { EV = j; if (bEv) bEv.hidden = !upcoming().length; season(); }).catch(() => season());
  load(); setInterval(load, 15 * 60e3); setInterval(season, 60e3);

  let last = 0;
  return { update(now){ const t = now / 1000, dt = Math.min(.05, t - last || 0); last = t; const camD = getCamD();
      mood(t); precip(t, dt); drift(dt, camD); if (show) fireworks(t, dt, camD); flySanta(t, dt, camD); },
    W, eventsSheet };
}
