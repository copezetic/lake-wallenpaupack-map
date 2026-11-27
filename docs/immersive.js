/* Lake Wallenpaupack map — being in it: rides (boat, road, train), sound, moving water and cloud shadows, lights at night,
   the time and season dial, the dam and a few landmark buildings.
   Routes come from rides.json (built by data/build_rides.py from the map's own data and OpenStreetMap). Sounds are made in the
   browser; nothing is recorded or downloaded. © 2026 DeWitt Hutchins. All rights reserved. */
export async function initImmersive(c){
  const {THREE, scene, camera, controls, canvas, D, M, Y, terrain, tiles, flyTo, panel, openSheet, esc, chips, say, sky, setSeason} = c;
  const Q = new URLSearchParams(location.search), TOUR = Q.has('tour');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toXZ = (lat, lon) => [(lon - M.lon0) * M.kx, -(lat - M.lat0) * M.kz];
  const RD = await fetch('rides.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  const store = {get: k => { try { return localStorage.getItem(k); } catch(e){ return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch(e){} }};
  const css = document.createElement('style');
  css.textContent = `#lights{position:absolute;inset:0;pointer-events:none}
body.riding header .tools,body.riding #chips,body.riding #zoom,body.riding #locate,body.riding #compass,body.riding #hint,body.riding #credit .long,body.riding #panel{display:none!important}
body.riding #labels .pin.minor,body.riding #labels .lb.town.com{display:none}
#rideBar{position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9;display:none;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;max-width:94vw;
  background:rgba(247,242,230,.94);border:1px solid var(--ink);padding:8px 10px;box-shadow:5px 5px 0 rgba(34,48,58,.16)}
body.riding #rideBar{display:flex}
#rideBar b{font:600 18px var(--serif);margin:0 6px 0 2px}#rideBar small{font:700 10.5px var(--sc);letter-spacing:.13em;color:var(--ink-soft);min-width:74px}
#rideBar button{font:700 11px var(--sc);letter-spacing:.13em;color:var(--ink);background:none;border:1px solid var(--ink);padding:7px 10px 6px;cursor:pointer}
#rideBar button[aria-pressed="true"],#rideBar button.pri{background:var(--ink);color:var(--card)}
#panel .rides button{display:block;width:100%;text-align:left;font:600 19px var(--serif);background:none;border:0;border-bottom:1px solid rgba(141,154,151,.55);padding:10px 0;cursor:pointer;color:var(--ink)}
#panel .rides button small{display:block;font:500 14.5px var(--serif);color:var(--ink-soft)}
#panel .seg{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 10px}#panel .seg button{font:700 11.5px var(--sc);letter-spacing:.13em;padding:7px 11px 6px;border:1px solid var(--ink);background:none;color:var(--ink);cursor:pointer}
#panel .seg button[aria-pressed="true"]{background:var(--ink);color:var(--card)}`;
  document.head.appendChild(css);
  const addChip = (label, fn) => { const b = document.createElement('button'); b.className = 'chip sky'; b.textContent = label; b.onclick = fn; chips.insertBefore(b, chips.querySelector('.chip:not(.sky)')); return b; };
  const mat = new Map(), M3 = col => mat.get(col) || mat.set(col, new THREE.MeshBasicMaterial({color: col})).get(col);
  const bx = (w, h, d, col, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M3(col)); m.position.set(x, y, z); return m; };

  /* ---------- routes ---------- */
  const route = (ll, n, id, kind) => { const p = ll.map(q => toXZ(q[0], q[1])), cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i-1] + Math.hypot(p[i][0] - p[i-1][0], p[i][1] - p[i-1][1]));
    let k = 1; const L = cum[cum.length - 1];
    const at = s => { s = Math.max(0, Math.min(L, s)); if (cum[k-1] > s) k = 1; while (k < p.length - 1 && cum[k] < s) k++; const f = (s - cum[k-1]) / (cum[k] - cum[k-1] || 1); return [p[k-1][0] + (p[k][0] - p[k-1][0]) * f, p[k-1][1] + (p[k][1] - p[k-1][1]) * f]; };
    return {id, n, kind, L, at}; };
  const ROUTES = [];
  if (RD.boat) ROUTES.push({...route(RD.boat.p, RD.boat.n, 'boat', 'boat'), sub: 'From the dam to Ledgedale, down the middle of the lake', speed: 60});
  for (const d of RD.drives || []) ROUTES.push({...route(d.p, d.n, d.id, 'car'), sub: d.id === '507' ? 'From Route 6 at the dam to Greentown' : 'Along the Lackawaxen and the old canal', speed: 55});
  if (RD.rail) ROUTES.push({...route(RD.rail.p, RD.rail.n, 'train', 'train'), sub: 'The excursion railroad\'s track from Honesdale through Hawley', speed: 42});
  const miles = m => (m / 1609.34).toFixed(1) + ' mi';

  /* ---------- the things you ride ---------- */
  function boatModel(){ const g = new THREE.Group(); g.add(bx(9, 1.4, 3.2, '#f4f1ea', 0, .8, 0), bx(3, 1.2, 2.6, '#f4f1ea', 5.2, .9, 0), bx(9.2, .3, 3.4, '#8a3b30', 0, 1.6, 0), bx(2.4, 1.3, 2.4, '#33506f', .6, 2.3, 0), bx(.3, 1.6, 2.6, '#cfe0e2', 1.9, 2.5, 0), bx(1.2, 1.4, 1.2, '#2f3d46', -4.6, 1.2, 0));
    const wk = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([-4.5, .12, 0, -13, .12, 2.3, -13, .12, -2.3], 3)), new THREE.MeshBasicMaterial({color: '#f4f8f8', transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide})); g.add(wk); g.scale.setScalar(1.7); return g; }
  function carModel(){ const g = new THREE.Group(); g.add(bx(8.6, 1.5, 3.6, '#7a3b2e', 0, 1.5, 0), bx(4.6, 1.4, 3.2, '#7a3b2e', -.6, 2.9, 0), bx(4.2, 1, 3.3, '#cfe0e2', -.6, 3, 0));
    for (const [x, z] of [[2.7, 1.8], [2.7, -1.8], [-2.7, 1.8], [-2.7, -1.8]]) g.add(bx(1.5, 1.5, .5, '#22303a', x, .75, z)); return g; }
  function carriage(col, loco){ const g = new THREE.Group();
    if (loco) g.add(bx(15, 3.2, 3.4, '#22303a', 0, 3.2, 0), bx(5, 2.6, 3.6, '#7a3b2e', -5, 5.9, 0), bx(1, 2.2, 1, '#22303a', 4.5, 5.8, 0), bx(1.8, 1.2, 3.6, '#c2622d', 7.9, 2, 0));
    else g.add(bx(17, 4.2, 3.4, col, 0, 3.7, 0), bx(17.4, .5, 3.7, '#f3ecd9', 0, 6, 0), bx(15.5, 1.3, 3.5, '#f3ecd9', 0, 4.4, 0));
    for (const x of [-5, 5]) g.add(bx(3.4, 1.4, 3.6, '#2a2522', x, .8, 0)); return g; }
  const VEH = {};
  const veh = kind => { if (!VEH[kind]){ const g = new THREE.Group(); g.visible = false;
      if (kind === 'train'){ g.userData.cars = [carriage('', true), carriage('#3f5a4a'), carriage('#3f5a4a'), carriage('#7a3b2e')]; g.userData.cars.forEach(o => g.add(o)); }
      else g.add(kind === 'boat' ? boatModel() : carModel());
      scene.add(g); VEH[kind] = g; } return VEH[kind]; };
  const hd = (r, s) => { const a = r.at(s - 4), b = r.at(s + 4); return Math.atan2(-(b[1] - a[1]), b[0] - a[0]); };
  const setTrain = (r, s) => { const g = veh('train'); g.userData.cars.forEach((o, i) => { const q = s - i * 20, [x, z] = r.at(q); o.position.set(x, Y(x, z) + .4, z); o.rotation.y = hd(r, q); }); };
  const setVeh = (r, s) => { if (r.kind === 'train') return setTrain(r, s); const g = veh(r.kind), [x, z] = r.at(s); g.position.set(x, Y(x, z) + (r.kind === 'boat' ? .6 : .5), z); g.rotation.y = hd(r, s); };
  /* the train keeps running on its own when nobody is riding it */
  const rail = ROUTES.find(r => r.kind === 'train'); let railS = rail ? rail.L * .3 : 0, railDir = 1;

  /* ---------- riding ---------- */
  const bar = document.createElement('div'); bar.id = 'rideBar'; document.body.appendChild(bar);
  let ride = null, last = 0;
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  function drawBar(){ if (!ride) return; const r = ride.r;
    bar.innerHTML = `<b>${esc(r.n)}</b><small id="rdProg"></small><button id="rdPause" aria-pressed="${ride.paused}">${ride.paused ? 'Go' : 'Pause'}</button>` +
      [1, 2, 4].map(m => `<button data-m="${m}" aria-pressed="${ride.mult === m}">${m}×</button>`).join('') + `<button id="rdLook" aria-pressed="${!!ride.gyro}">Tilt to look</button><button id="rdEnd" class="pri">End</button>`;
    bar.querySelector('#rdPause').onclick = () => { ride.paused = !ride.paused; drawBar(); };
    bar.querySelectorAll('button[data-m]').forEach(b => b.onclick = () => { ride.mult = +b.dataset.m; drawBar(); });
    bar.querySelector('#rdEnd').onclick = () => endRide();
    bar.querySelector('#rdLook').onclick = async () => { if (ride.gyro){ ride.gyro = null; drawBar(); return; }
      try { if (typeof DeviceOrientationEvent === 'undefined') throw 0; if (DeviceOrientationEvent.requestPermission && (await DeviceOrientationEvent.requestPermission()) !== 'granted') throw 0; ride.gyro = {a0: null, b0: null}; say('Turn or tilt your phone to look around.'); }
      catch(e){ say('This device does not share its motion. Drag to look around.'); } drawBar(); };
  }
  addEventListener('deviceorientation', e => { if (!ride || !ride.gyro || e.alpha == null) return; const g = ride.gyro; if (g.a0 == null){ g.a0 = e.alpha; g.b0 = e.beta; }
    let da = e.alpha - g.a0; if (da > 180) da -= 360; if (da < -180) da += 360; ride.yaw = da * Math.PI / 180; ride.pitch = Math.max(-.5, Math.min(.6, (e.beta - g.b0) * Math.PI / 180 * .8)); });
  { let dn = null; canvas.addEventListener('pointerdown', e => { if (ride) dn = [e.clientX, e.clientY, ride.yaw, ride.pitch]; });
    addEventListener('pointermove', e => { if (!ride || !dn || ride.gyro) return; ride.yaw = dn[2] + (e.clientX - dn[0]) * .006; ride.pitch = Math.max(-.5, Math.min(.6, dn[3] + (e.clientY - dn[1]) * .004)); });
    addEventListener('pointerup', () => dn = null); }
  function startRide(id, from){ const r = ROUTES.find(r => r.id === id); if (!r) return; if (from == null) from = r.kind === 'train' ? 90 : 0; if (ride) endRide(true);
    c.stopFly(); panel.classList.remove('open');
    ride = {r, s: from, mult: 1, paused: false, yaw: 0, pitch: 0, fov: camera.fov, near: camera.near, far: camera.far, first: true};
    camera.fov = 50; camera.near = 4; camera.far = 70000; camera.updateProjectionMatrix(); controls.enabled = false;
    document.body.classList.add('riding'); veh(r.kind).visible = true; drawBar(); audio.sync(); }
  function endRide(quiet){ if (!ride) return; const r = ride.r, [x, z] = r.at(ride.s);
    camera.fov = ride.fov; camera.near = ride.near; camera.far = ride.far; camera.updateProjectionMatrix(); controls.enabled = true;
    document.body.classList.remove('riding'); if (r.kind !== 'train') veh(r.kind).visible = false; ride = null; audio.sync();
    if (!quiet){ controls.target.set(x, Y(x, z), z); camera.position.set(x + 500, Y(x, z) + 1500, z + 1600); flyTo(x, z, 3000); } }
  addEventListener('keydown', e => { if (ride && e.key === 'Escape') endRide(); });
  const DIST = {boat: [48, 15], car: [40, 14], train: [112, 30]};
  function rideFrame(dt){ const r = ride.r;
    if (!ride.paused) ride.s += r.speed * ride.mult * dt;
    if (ride.s >= r.L){ ride.s = r.L; say('End of the line.'); return endRide(); }
    setVeh(r, ride.s);
    const [x, z] = r.at(ride.s), h = hd(r, ride.s) , [back, up] = DIST[r.kind], a = h + Math.PI + ride.yaw, y0 = Y(x, z);
    tmp.set(x + Math.cos(a) * back, 0, z - Math.sin(a) * back); tmp.y = Math.max(y0 + up + ride.pitch * 40, Y(tmp.x, tmp.z) + 7);
    if (ride.first){ cam.copy(tmp); ride.first = false; } else cam.lerp(tmp, Math.min(1, dt * 3.2));
    const ahead = r.at(ride.s + 90); look.set(ahead[0] + (ride.yaw ? (x - ahead[0]) * Math.min(1, Math.abs(ride.yaw) / 1.2) : 0), y0 + 5 - ride.pitch * 30, ahead[1] + (ride.yaw ? (z - ahead[1]) * Math.min(1, Math.abs(ride.yaw) / 1.2) : 0));
    const far = r.at(ride.s + 520); controls.target.set(far[0], Y(far[0], far[1]), far[1]);         // the map dresses the ground ahead of you
    camera.position.copy(cam); camera.lookAt(look);
    const pr = bar.querySelector('#rdProg'); if (pr) pr.textContent = `${miles(ride.s)} of ${miles(r.L)}`;
  }
  function rideSheet(){
    openSheet('Go for a ride', 'Ride the map', `<p>See the lake from down in it. Drag to look around; the bar at the bottom pauses, speeds up or ends the ride.</p>
      <div class="rides">${ROUTES.map(r => `<button data-r="${esc(r.id)}">${esc(r.n)}<small>${esc(r.sub)} · ${miles(r.L)}</small></button>`).join('')}</div>
      <p class="fine">Rides follow the map's own lines and run faster than life. They are a way to look around, not directions: the boat keeps to the middle of the lake and ignores other boats, buoys and no-wake areas.</p>`);
    panel.querySelectorAll('button[data-r]').forEach(b => b.onclick = () => startRide(b.dataset.r));
  }
  if (ROUTES.length) addChip('Ride', rideSheet);

  /* ---------- moving water and cloud shadows: a second skin over the ground that sparkles on the lakes and drifts shade across the hills ---------- */
  let skin = null, skinOn = store.get('lake-water') !== 'off' && !still;
  function makeSkin(){
    const g0 = terrain.children[0].geometry, geo = new THREE.BufferGeometry(); geo.setAttribute('position', g0.attributes.position); geo.setAttribute('uv', g0.attributes.uv);
    let n = 0; for (const m of terrain.children) n += m.geometry.index.count; const idx = new Uint32Array(n); let o = 0; for (const m of terrain.children){ idx.set(m.geometry.index.array, o); o += m.geometry.index.count; }
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e6);
    const XS = M.xmax - M.xmin, ZS = M.zmax - M.zmin, W = c.small ? 768 : 1280, cv = document.createElement('canvas'); cv.width = W; cv.height = Math.round(W * ZS / XS);
    const g = cv.getContext('2d'), S = W / XS; g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = '#fff';
    for (const w of D.water){ g.beginPath(); for (const r of [w.o, ...w.h]){ r.forEach((p, i) => i ? g.lineTo((p[0] - M.xmin) * S, (p[1] - M.zmin) * S) : g.moveTo((p[0] - M.xmin) * S, (p[1] - M.zmin) * S)); g.closePath(); } g.fill('evenodd'); }
    const mask = new THREE.CanvasTexture(cv); mask.minFilter = THREE.LinearFilter; mask.generateMipmaps = false;
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5,
      uniforms: {mask: {value: mask}, t: {value: 0}, dark: {value: 0}, ice: {value: 0}, near: {value: 1}, cloud: {value: .5}, size: {value: new THREE.Vector2(XS, ZS)}},
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `precision highp float; varying vec2 vUv; uniform sampler2D mask; uniform float t, dark, ice, near, cloud; uniform vec2 size;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y); }
        void main(){ vec2 w = vec2(vUv.x, 1. - vUv.y) * size;
          float cl = noise(w / 2700. + vec2(t * .011, t * .006)) * .62 + noise(w / 880. + vec2(t * .02, -t * .008)) * .38;
          float sh = smoothstep(.5, .76, cl) * .2 * cloud * (1. - dark);
          vec3 col = vec3(.08, .1, .16); float a = sh;
          if (texture2D(mask, vUv).r > .5 && ice < .5){
            float r1 = noise(w / 2.6 + vec2(t * 1.1, t * .6)) * noise(w / 8. - vec2(t * .4, t * .7));
            float r2 = noise(w / 60. + vec2(t * .16, t * .1)) * noise(w / 150. - vec2(t * .05, t * .09));
            float sp = smoothstep(.44, .62, r1) * near * .8 + smoothstep(.4, .54, r2) * (1. - near) * .6;
            sp *= (1. - dark * .82) * (1. - sh * 2.2);
            col = mix(col, vec3(1., .99, .95), clamp(sp * 1.6, 0., 1.)); a = max(a * (1. - sp), sp * .38);
          }
          if (a < .004) discard; gl_FragColor = vec4(col, a); }`}));
    m.renderOrder = 1; m.frustumCulled = false; scene.add(m); return m;
  }

  /* ---------- lights at night: a warm dot on the houses near you once it is dark (and coloured strings in winter) ---------- */
  const lights = document.createElement('canvas'); lights.id = 'lights'; const nightEl = document.getElementById('night'); if (nightEl) nightEl.after(lights); else canvas.after(lights);
  const lg = lights.getContext('2d'), v3 = new THREE.Vector3(), XMAS = ['255,214,130', '232,72,60', '96,190,110', '255,214,130', '110,160,240'];
  function drawLights(dk){
    const W = canvas.clientWidth, H = canvas.clientHeight; if (lights.width !== W || lights.height !== H){ lights.width = W; lights.height = H; }
    lg.clearRect(0, 0, W, H); if (dk < .3) return; const winter = c.season() === 'winter', A = Math.min(1, (dk - .3) / .4); let n = 0;
    for (const t of tiles){ if (t.state !== 2 || !t.blds) continue;
      if (t._litFor !== t.blds){ t._litFor = t.blds; t._lit = t.blds.filter((b, i) => i % 5 !== 0 && b.p.length > 2).map(b => { const q = b.p[0]; return [q[0], Y(q[0], q[1]) + 5, q[1]]; }); }
      for (let i = 0; i < t._lit.length && n < 2600; i++){ const q = t._lit[i]; v3.set(q[0], q[1], q[2]).project(camera); if (v3.z > 1 || v3.x < -1 || v3.x > 1 || v3.y < -1 || v3.y > 1) continue;
        const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, col = winter ? XMAS[i % XMAS.length] : '255,214,130'; n++;
        lg.fillStyle = `rgba(${col},${(.85 * A).toFixed(2)})`; lg.fillRect(x - 1, y - 1, 2.4, 2.4); lg.fillStyle = `rgba(${col},${(.16 * A).toFixed(2)})`; lg.fillRect(x - 3, y - 3, 6.4, 6.4); } }
  }

  /* ---------- sound, made here: water, wind, rain, an engine, a train, and a loon at dusk ---------- */
  const audio = (() => { let ctx = null, on = false, N = {}, loonAt = 0;
    const noiseBuf = () => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
    function build(){ ctx = new (window.AudioContext || window.webkitAudioContext)(); const buf = noiseBuf(), master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
      const src = (type, f, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || .7; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(master); s.start(); return {g, fl}; };
      N.water = src('bandpass', 520, .6); N.wind = src('lowpass', 380, .5); N.rain = src('highpass', 2600, .5); N.road = src('lowpass', 170, .6); N.chuff = src('bandpass', 900, 1.2);
      const lfo = ctx.createOscillator(), lg2 = ctx.createGain(); lfo.frequency.value = .23; lg2.gain.value = .035; lfo.connect(lg2).connect(N.water.g.gain); lfo.start();
      const o = ctx.createOscillator(), og = ctx.createGain(), of = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 58; of.type = 'lowpass'; of.frequency.value = 260; og.gain.value = 0; o.connect(of).connect(og).connect(master); o.start(); N.motor = {g: og, o};
      const cl = ctx.createOscillator(), cg = ctx.createGain(); cl.type = 'square'; cl.frequency.value = 3.1; cg.gain.value = 0; cl.connect(cg).connect(N.chuff.g.gain); cl.start(); N.chuffLfo = cg; N.master = master; }
    function loon(){ const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(880, t + .5); o.frequency.setValueAtTime(880, t + 1.1); o.frequency.exponentialRampToValueAtTime(700, t + 1.9);
      vib.frequency.value = 7; vg.gain.value = 9; vib.connect(vg).connect(o.frequency); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.11, t + .25); g.gain.setValueAtTime(.11, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 2);
      o.connect(g).connect(N.master); o.start(t); vib.start(t); o.stop(t + 2.1); vib.stop(t + 2.1); }
    const set = (n, v) => n.g.gain.setTargetAtTime(v, ctx.currentTime, .6);
    return { on: () => on,
      async toggle(){ if (!on){ if (!ctx) build(); await ctx.resume(); on = true; } else { on = false; await ctx.suspend(); } this.sync(); return on; },
      sync(){ if (chipS) { chipS.textContent = on ? 'Sound on' : 'Sound'; chipS.classList.toggle('fx', on); } },
      frame(now, camD, dk){ if (!on || !ctx) return; const k = Math.max(0, Math.min(1, 1 - camD / 9000)), W = sky.W || {}, wet = W.kind === 'rain' || W.kind === 'storm', kind = ride && ride.r.kind, moving = ride && !ride.paused;
        set(N.water, kind === 'car' || kind === 'train' ? .01 : .02 + .07 * k); set(N.wind, .03 + .05 * (1 - k) + (W.wind > 15 ? .04 : 0)); set(N.rain, wet ? .09 : 0);
        N.motor.g.gain.setTargetAtTime(kind === 'boat' && moving ? .1 : 0, ctx.currentTime, .4); N.motor.o.frequency.setTargetAtTime(52 + (ride ? ride.mult * 9 : 0), ctx.currentTime, .5);
        set(N.road, kind === 'car' && moving ? .22 : kind === 'train' && moving ? .14 : 0); N.chuffLfo.gain.setTargetAtTime(kind === 'train' && moving ? .1 : 0, ctx.currentTime, .3);
        if (dk > .25 && dk < .95 && !wet && c.season() !== 'winter' && now > loonAt){ if (loonAt) loon(); loonAt = now + 22000 + Math.random() * 30000; } } }; })();
  let chipS = null; if (window.AudioContext || window.webkitAudioContext) chipS = addChip('Sound', () => audio.toggle().then(on => say(on ? 'Sound on. Made in your browser; nothing is recorded.' : 'Sound off.')));

  /* ---------- the time and season dial ---------- */
  const hourText = h => { const m = Math.round(h * 60), hh = Math.floor(m / 60) % 24, mm = m % 60; return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'am' : 'pm'}`; };
  function timeSheet(){
    const hand = sky.handHour(), nowH = sky.lakeDate().h, sn = c.season();
    openSheet('Light and weather', 'Time and season', `<label style="display:block;font:700 11px var(--sc);letter-spacing:.13em">Time of day · <span id="tHr">${hand == null ? 'now' : hourText(hand)}</span>
        <input id="tDial" type="range" min="0" max="24" step="0.25" value="${hand == null ? nowH.toFixed(2) : hand}" style="display:block;width:100%;margin-top:6px"></label>
      <div class="seg" style="margin-top:8px"><button id="tNow" aria-pressed="${hand == null}">Now</button><button data-h="6.5">Sunrise</button><button data-h="12">Noon</button><button data-h="19.5">Dusk</button><button data-h="22.5">Night</button></div>
      <div class="sec">Season</div><div class="seg">${[['summer', 'Summer'], ['fall', 'Fall colour'], ['winter', 'Winter']].map(([k, l]) => `<button data-s="${k}" aria-pressed="${sn === k}">${l}</button>`).join('')}</div>
      <div class="sec">Effects</div><div class="seg"><button id="tWater" aria-pressed="${skinOn}">Moving water and cloud shadows</button><button id="tFw">Play the fireworks</button></div>
      <p class="fine">The dial changes the light on the map only; the weather shown is still today's. Winter and fall are a look, not a forecast: the lake does not freeze on a schedule. Lights come on in the houses near you after dark.</p>`);
    const dial = panel.querySelector('#tDial'), lab = panel.querySelector('#tHr'), setH = h => { sky.setClock(h); lab.textContent = h == null ? 'now' : hourText(h); panel.querySelector('#tNow').setAttribute('aria-pressed', String(h == null)); if (h != null) dial.value = h; };
    dial.oninput = () => setH(+dial.value); panel.querySelector('#tNow').onclick = () => { setH(null); dial.value = sky.lakeDate().h; };
    panel.querySelectorAll('button[data-h]').forEach(b => b.onclick = () => setH(+b.dataset.h));
    panel.querySelectorAll('button[data-s]').forEach(b => b.onclick = () => { say('Repainting…'); setTimeout(() => { setSeason(b.dataset.s); if (skin) skin.material.uniforms.ice.value = b.dataset.s === 'winter' ? 1 : 0; timeSheet(); }, 30); });
    panel.querySelector('#tWater').onclick = () => { skinOn = !skinOn; store.set('lake-water', skinOn ? 'on' : 'off'); if (skin) skin.visible = skinOn; timeSheet(); };
    panel.querySelector('#tFw').onclick = () => { setH(22.5); const at = sky.startFireworks(); flyTo(at[0] + 200, at[1] + 700, 4200); };
  }
  addChip('Time & season', timeSheet);

  /* ---------- the dam, and a few landmark buildings at their real mapped height ---------- */
  if (RD.dam && RD.dam.length > 1){ const g = new THREE.Group(), p = RD.dam.map(q => toXZ(q[0], q[1])), lake = D.water.filter(w => w.n === 'Lake Wallenpaupack').sort((a, b) => b.o.length - a.o.length)[0];
    const top = (lake ? Y(lake.o[0][0], lake.o[0][1]) : Math.max(...p.map(q => Y(q[0], q[1])))) + 9;
    for (let i = 1; i < p.length; i++){ const a = p[i-1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), lo = Math.min(Y(a[0], a[1]), Y(b[0], b[1])) - 30, m = bx(L + 6, top - lo, 13, '#cfcabb', (a[0] + b[0]) / 2, (top + lo) / 2, (a[1] + b[1]) / 2);
      m.rotation.y = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); g.add(m); const cap = bx(L + 6, 1.2, 15, '#e9e4d8', (a[0] + b[0]) / 2, top + .6, (a[1] + b[1]) / 2); cap.rotation.y = m.rotation.y; g.add(cap); }
    scene.add(g); }
  const MARKS = [['ov-f4d7c836-9d6', '#8c98a3', 26], ['ledges-hotel-417768323', '#a39a8c', 20], ['ov-791a4246-4db', '#b08d6e', 14], ['hawley-public-library-417449244', '#b5653e', 12], ['the-settlers-inn-417762893', '#8a6a52', 14]];
  (async () => { const XS = M.xmax - M.xmin, ZS = M.zmax - M.zmin;
    for (const [id, col, fallback] of MARKS){ const p = D.pois.find(p => p.id === id); if (!p) continue;
      const i = Math.min(M.ntx - 1, Math.floor((p.x - M.xmin) / XS * M.ntx)), j = Math.min(M.ntz - 1, Math.floor((p.z - M.zmin) / ZS * M.ntz));
      let blds = []; try { blds = await (await fetch(`tiles/b_${i}_${j}.json`)).json(); } catch(e){ continue; }
      let best = null, bd = 70; for (const b of blds){ if (b.p.length < 3) continue; const cx = b.p.reduce((a, q) => a + q[0], 0) / b.p.length, cz = b.p.reduce((a, q) => a + q[1], 0) / b.p.length, d = Math.hypot(cx - p.x, cz - p.z); if (d < bd){ bd = d; best = b; } }
      if (!best) continue; const sh = new THREE.Shape(best.p.map(q => new THREE.Vector2(q[0], -q[1]))), h = Math.max(best.h > 6 ? best.h * 1.5 : 0, fallback);
      let lo = Infinity; for (const q of best.p) lo = Math.min(lo, Y(q[0], q[1]));
      const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: h + 6, bevelEnabled: false}).rotateX(-Math.PI / 2), M3(col)); body.position.y = lo - 6; scene.add(body);
      const roof = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2), M3('#4a4038')); roof.position.y = lo + h + .15; scene.add(roof); } })();

  if (Q.has('ride')) setTimeout(() => startRide(Q.get('ride')), 1500);
  if (Q.has('season')) setTimeout(() => { setSeason(Q.get('season')); if (skin) skin.material.uniforms.ice.value = Q.get('season') === 'winter' ? 1 : 0; }, 600);
  if (Q.has('hour')) sky.setClock(+Q.get('hour'));
  if (skinOn && !TOUR) try { skin = makeSkin(); } catch(e){ console.warn(e); }
  if (TOUR && skinOn) try { skin = makeSkin(); } catch(e){}

  return { riding: () => !!ride,
    update(now){ const dt = Math.min(.1, (now - last) / 1000 || 0); last = now; const camD = c.getCamD(), dk = sky.dark();
      if (ride) rideFrame(dt);
      else if (rail){ const show = camD < 9000; veh('train').visible = show; if (show){ railS += railDir * 26 * dt; if (railS > rail.L - 90){ railS = rail.L - 90; railDir = -1; } if (railS < 90){ railS = 90; railDir = 1; } setTrain(rail, railS); } }
      if (skin && skin.visible){ const u = skin.material.uniforms; u.t.value = now / 1000; u.dark.value = dk; u.near.value = Math.max(0, Math.min(1, 1.25 - camD / 9000)); u.cloud.value = .35 + .65 * ((sky.W && sky.W.cover) || 0); }
      drawLights(dk); audio.frame(now, camD, dk); } };
}
