/* Lake Wallenpaupack map — small jokes hidden around the map for anyone who zooms in. Each is an original block figure with a
   short label; none stands for a real business, person or event. They appear only when you are close, and the map keeps count
   of the ones you have found.
   © 2026 DeWitt Hutchins. All rights reserved. */
export function initEggs(c){
  const {THREE, scene, D, M, Y, addLabel, camera, say} = c;
  if (c.EMBED) return;
  const toXZ = (lat, lon) => [(lon - M.lon0) * M.kx, -(lat - M.lat0) * M.kz];
  const mats = new Map(), M3 = col => mats.get(col) || mats.set(col, new THREE.MeshLambertMaterial({color: col})).get(col);
  const box = (g, w, h, d, col, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M3(col)); m.position.set(x, y, z); g.add(m); return m; };
  const cyl = (g, r0, r1, h, col, x, y, z, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), M3(col)); m.position.set(x, y, z); g.add(m); return m; };
  const ball = (g, r, col, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M3(col)); m.position.set(x, y, z); g.add(m); return m; };

  /* each egg: where it is, its label, and a builder that fills a group and may return a function called every frame with (seconds, group) */
  const EGGS = [
    {id: 'monster', at: [41.4300, -75.2150], label: 'Probably a log', sc: 7, lift: 4, build: g => {
      const C = '#3f5a4a', humps = [0, 1, 2].map(i => ball(g, .9 - i * .12, C, -1.6 - i * 1.7, 0, 0)); const neck = box(g, .45, 2.2, .45, C, .2, .9, 0), head = box(g, 1, .5, .55, C, .55, 2.1, 0); box(g, .12, .12, .58, '#f1eadb', .8, 2.2, 0);
      return t => { humps.forEach((h, i) => h.position.y = -.25 + Math.sin(t * 1.3 + i) * .28); const d = Math.sin(t * .35); neck.position.y = .2 + d * .9; head.position.y = 1.4 + d * .9; g.rotation.y = t * .05; }; }},
    {id: 'boot', at: [41.3990, -75.2520], label: 'Caught something', sc: 5, lift: 5, build: g => {
      box(g, 3.2, .5, 1.3, '#7a3b2e', 0, .25, 0); box(g, 2.8, .12, 1, '#b98d5a', 0, .5, 0); box(g, .6, .9, .5, '#33506f', -.5, 1, 0); ball(g, .3, '#e2c9a8', -.5, 1.7, 0); box(g, .7, .1, .7, '#c9a25a', -.5, 1.98, 0);
      const rod = box(g, 2.6, .06, .06, '#3a3531', .9, 2.1, 0); rod.rotation.z = .5; const line = box(g, .03, 1.5, .03, '#f1eadb', 2.05, 1.95, 0), boot = new THREE.Group(); box(boot, .28, .5, .28, '#4a3a2a', 0, .1, 0); box(boot, .5, .2, .28, '#4a3a2a', .12, -.15, 0); boot.position.set(2.05, 1.05, 0); g.add(boot);
      return t => { g.position.y += Math.sin(t * 1.6) * .004; boot.rotation.y = t * 1.5; boot.position.y = 1.05 + Math.sin(t * 2.2) * .12; line.scale.y = 1 - Math.sin(t * 2.2) * .08; }; }},
    {id: 'beaver', at: [41.4588, -75.1868], label: 'The competition', sc: 5, lift: 4, build: g => {
      for (let i = 0; i < 9; i++){ const s = box(g, 1.6 + (i % 3) * .5, .18, .18, i % 2 ? '#7d5a3c' : '#6f5335', (i % 3 - 1) * .5, .2 + (i % 4) * .16, (i % 5 - 2) * .25); s.rotation.y = i * .7; s.rotation.z = (i % 3 - 1) * .2; }
      const b = new THREE.Group(); box(b, .9, .5, .5, '#5a4332', 0, .3, 0); box(b, .4, .36, .4, '#5a4332', .55, .45, 0); box(b, .1, .14, .12, '#f1eadb', .76, .36, 0); const tail = box(b, .6, .08, .4, '#3a2c20', -.7, .15, 0); const stick = box(b, .9, .1, .1, '#b98d5a', .8, .5, 0); stick.rotation.y = 1.57; g.add(b);
      return t => { const a = t * .5; b.position.set(Math.cos(a) * 2.6, 0, Math.sin(a) * 2.6); b.rotation.y = -a - 1.57; tail.rotation.z = Math.sin(t * 6) * .25; }; }},
    {id: 'bigfoot', at: [41.3450, -75.4000], label: 'Nobody will believe you', sc: 5.5, lift: 6, build: g => {
      const C = '#4a3526', f = new THREE.Group(); box(f, .9, 1.3, .6, C, 0, 1.75, 0); box(f, .55, .55, .55, C, .05, 2.7, 0); const lL = box(f, .34, 1.1, .36, C, 0, .55, .22), lR = box(f, .34, 1.1, .36, C, 0, .55, -.22), aL = box(f, .28, 1.2, .28, C, 0, 1.7, .6), aR = box(f, .28, 1.2, .28, C, 0, 1.7, -.6); g.add(f);
      return t => { const ph = (t * .05) % 1, out = ph < .5, k = out ? ph * 2 : 2 - ph * 2; f.position.x = -6 + k * 12; f.rotation.y = out ? 0 : Math.PI; const s = Math.sin(t * 4); lL.position.x = s * .3; lR.position.x = -s * .3; aL.position.x = -s * .35; aR.position.x = s * .35; f.position.y = Math.abs(s) * .08; }; }},
    {id: 'saucer', at: [41.4300, -75.4200], label: 'Just visiting', sc: 5, lift: 12, build: g => {
      const ship = new THREE.Group(); cyl(ship, 1.2, 2.6, .5, '#8d9a97', 0, 0, 0, 16); cyl(ship, 2.6, 1.6, .35, '#6f7a78', 0, -.4, 0, 16); ball(ship, 1, '#9fbcc0', 0, .35, 0); ship.position.y = 8; g.add(ship);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.8, 2.4, 7, 14, 1, true), new THREE.MeshBasicMaterial({color: '#f6e7a8', transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false})); beam.position.y = 4.2; g.add(beam);
      const cow = new THREE.Group(); box(cow, 1.5, .8, .7, '#f1eadb', 0, 0, 0); box(cow, .5, .5, .5, '#f1eadb', .9, .25, 0); box(cow, .6, .5, .72, '#22303a', -.2, .05, 0); for (const [x, z] of [[.5, .25], [.5, -.25], [-.5, .25], [-.5, -.25]]) box(cow, .16, .6, .16, '#22303a', x, -.65, z); g.add(cow);
      return t => { ship.rotation.y = t * .8; ship.position.x = Math.sin(t * .4) * .6; const k = (Math.sin(t * .5) + 1) / 2; cow.position.y = 1.2 + k * 4.4; cow.rotation.y = t * .6; cow.rotation.z = Math.sin(t * 1.7) * .2; beam.material.opacity = .2 + .1 * Math.sin(t * 3); }; }},
    {id: 'geese', at: [41.41387, -75.31971], label: 'Right of way', sc: 7, lift: 3, build: g => {
      const N = 6, flock = []; for (let i = 0; i < N; i++){ const q = new THREE.Group(); box(q, .7, .4, .4, i ? '#8a8370' : '#6f6a5c', 0, .45, 0); box(q, .14, .55, .14, '#22303a', .32, .85, 0); box(q, .26, .16, .16, '#22303a', .42, 1.15, 0); box(q, .2, .08, .1, '#e0a52c', .6, 1.12, 0); box(q, .1, .25, .1, '#e0a52c', .05, .12, .1); box(q, .1, .25, .1, '#e0a52c', .05, .12, -.1); g.add(q); flock.push(q); }
      return t => { const ph = (t * .04) % 1; flock.forEach((q, i) => { const s = -9 + ((ph * 26 - i * 1.5) % 26 + 26) % 26 - 4; q.position.set(Math.sin(i) * .25, Math.abs(Math.sin(t * 7 + i)) * .1, s); q.rotation.y = -1.57; q.rotation.z = Math.sin(t * 7 + i) * .12; }); }; }},
    {id: 'raccoons', at: [41.4753, -75.1816], label: 'Night shift', sc: 4, lift: 4, build: g => {
      const can = cyl(g, .5, .45, 1.1, '#6f7a78', 0, .5, 0, 10); can.rotation.z = 1.35; can.position.set(0, .5, 0); const lid = cyl(g, .56, .56, .08, '#56636b', 1.2, .06, .6, 10); box(g, .3, .2, .3, '#c8452c', .9, .12, -.3); box(g, .25, .15, .2, '#f1eadb', 1.3, .1, 0);
      const rc = [0, 1].map(i => { const r = new THREE.Group(); box(r, .7, .4, .4, '#6f6a66', 0, .35, 0); box(r, .34, .32, .36, '#6f6a66', .46, .5, 0); box(r, .36, .1, .38, '#22303a', .5, .52, 0); const tl = box(r, .55, .16, .16, '#3a3531', -.6, .42, 0); box(r, .12, .17, .17, '#f1eadb', -.52, .42, 0); r.userData.tl = tl; g.add(r); return r; });
      return t => { rc[0].position.set(1.2 + Math.sin(t * 1.2) * .3, 0, .9); rc[0].rotation.y = 2.4; rc[0].rotation.z = Math.sin(t * 5) * .08; rc[1].position.set(-.6, .55 + Math.abs(Math.sin(t * 2.5)) * .12, .1); rc[1].rotation.y = .3; rc.forEach((r, i) => r.userData.tl.rotation.y = Math.sin(t * 4 + i) * .5); lid.rotation.z = Math.sin(t * 2) * .04; }; }},
    {id: 'balloon', at: [41.4100, -75.2400], label: 'Up and away', sc: 6, lift: 60, build: g => {
      const b = new THREE.Group(); const cols = ['#c8452c', '#f1eadb', '#33506f', '#e0a52c']; for (let i = 0; i < 8; i++){ const s = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 10, i * Math.PI / 4, Math.PI / 4), M3(cols[i % 4])); s.position.y = 6; s.scale.y = 1.2; b.add(s); }
      cyl(b, .9, .5, 1.6, '#7a3b2e', 0, 2, 0, 8); box(b, .8, .7, .8, '#b98d5a', 0, .35, 0); for (const [x, z] of [[.36, .36], [.36, -.36], [-.36, .36], [-.36, -.36]]) box(b, .04, 1.3, .04, '#3a3531', x, 1.2, z); b.position.y = 34; g.add(b);
      return t => { const a = t * .03; b.position.set(Math.cos(a) * 60, 34 + Math.sin(t * .3) * 3, Math.sin(a) * 40); b.rotation.y = t * .1; }; }},
    {id: 'bunker', poi: /CC at Woodloch Springs/, off: [60, 40], label: 'Still in the bunker', sc: 4.5, lift: 4, build: g => {
      cyl(g, 3.2, 3.4, .12, '#efe3bd', 0, .06, 0, 14); const p = new THREE.Group(); box(p, .5, .8, .35, '#c8452c', 0, 1.2, 0); box(p, .22, .8, .22, '#f1eadb', 0, .4, .12); box(p, .22, .8, .22, '#f1eadb', 0, .4, -.12); ball(p, .26, '#e2c9a8', 0, 1.85, 0); box(p, .5, .08, .5, '#22303a', .05, 2.05, 0); const club = box(p, .06, 1.5, .06, '#8d9a97', .5, .9, 0); g.add(p);
      const sand = [0, 1, 2, 3].map(i => ball(g, .14, '#efe3bd', .9, .2, 0)), fl = cyl(g, .04, .04, 2.6, '#f1eadb', 5.5, 1.3, 2, 6); box(g, .7, .45, .04, '#c8452c', 5.85, 2.35, 2);
      return t => { const sw = (t * .7) % 1, a = sw < .3 ? -1.2 + sw / .3 * 2.6 : 1.4 - (sw - .3) / .7 * 2.6; club.rotation.z = a; club.position.set(.5 + Math.sin(a) * .5, .9 - Math.cos(a) * .1 + .1, 0); sand.forEach((s, i) => { const k = Math.max(0, sw - .28) * 1.6; s.position.set(.9 + k * (1 + i * .5), .2 + Math.sin(Math.min(1, k) * Math.PI) * (1 + i * .3), (i - 1.5) * .3 * k); s.visible = sw > .28 && k < 1; }); }; }}
  ];

  const KEY = 'wally-eggs', TOTAL = EGGS.length + 1;                       // the picnic bear at the campground counts as one
  let found = new Set(); try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) {}
  const NAMES = {bear: 'the picnic bear', monster: 'the lake monster', boot: 'the old boot', beaver: 'the beaver', bigfoot: 'the walker in the woods', saucer: 'the visitors', geese: 'the geese', raccoons: 'the night shift', balloon: 'the balloon', bunker: 'the golfer'};
  const mark = id => { if (found.has(id)) return; found.add(id); try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch (e) {}
    if (say) say(found.size === TOTAL ? `You found ${NAMES[id] || 'one'}. That is all ${TOTAL} of the hidden things.` : `You found ${NAMES[id] || 'one'}: ${found.size} of ${TOTAL} hidden things.`); };
  if (c.hooks) c.hooks.eggFound = mark;

  const BIG = 1.7;                                  // storybook scale: big enough to spot among the trees
  const live = [];
  for (const e of EGGS){
    let x, z;
    if (e.poi){ const p = D.pois.find(p => e.poi.test(p.name)); if (!p) continue; x = p.x + e.off[0]; z = p.z + e.off[1]; } else [x, z] = toXZ(e.at[0], e.at[1]);
    if (x < M.xmin || x > M.xmax || z < M.zmin || z > M.zmax) continue;
    const g = new THREE.Group(), inner = new THREE.Group(); inner.scale.setScalar(e.sc * BIG); g.add(inner); g.add(new THREE.HemisphereLight('#ffffff', '#8a8370', 2.4));
    const y0 = Y(x, z) + .6; g.position.set(x, y0, z); g.visible = false; scene.add(g);
    const tick = e.build(inner);
    const el = document.createElement('div'); el.className = 'lb pk an'; el.textContent = e.label; const lab = addLabel(el, x, z, e.sc * BIG * e.lift * .5 + 4, 'center'); lab.maxD = 2200;
    live.push({e, g, inner, tick, pos: new THREE.Vector3(x, y0, z), y0});
  }
  { const want = new URLSearchParams(location.search).get('egg'), L = want && live.find(L => L.e.id === want); if (L && c.flyTo) setTimeout(() => c.flyTo(L.pos.x, L.pos.z, 380), 1800); }   // ?egg=monster jumps straight to one, for checking
  const frame = now => { requestAnimationFrame(frame); const t = now / 1000;
    for (const L of live){ const d = camera.position.distanceTo(L.pos), near = d < 3000; L.g.visible = near; if (!near) continue;
      L.inner.position.y = 0; if (L.tick) L.tick(t, L.inner); if (d < 900) mark(L.e.id); } };
  requestAnimationFrame(frame);
}
