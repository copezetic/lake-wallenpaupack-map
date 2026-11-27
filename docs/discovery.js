// Pure helpers shared by search, the map list, and saved trips.
export const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const groups = [ ['pizza','pizzeria'], ['coffee','cafe','coffeehouse'], ['beer','brewery','brewing','brewpub'], ['wine','winery'], ['food','restaurant','dining','eat'], ['stay','hotel','lodging','lodge','inn','resort','campground'], ['boat','boating','marina','launch'], ['hike','hiking','trail'], ['gas','fuel','petrol'], ['shop','shopping','store'] ];
export function searchable(p, cats = {}) {
  const raw = normalize([p.name, p.kind, cats[p.cat]?.label, ...(p.facts || []).flat(), ...(p.tags || []), ...(p.keywords || [])].join(' '));
  return raw + ' ' + groups.filter(g => g.some(w => raw.split(' ').includes(w))).flat().join(' ');
}
export function searchEntries(entries, query, {cats = {}, origin, hidden = new Set()} = {}) {
  const terms = normalize(query).split(' ').filter(Boolean), exact = normalize(query);
  return entries.filter(e => !e.p || !hidden.has(e.p.cat)).map(e => {
    const name = normalize(e.n), words = e.p ? searchable(e.p, cats) : name;
    return {...e, score: name === exact ? 3 : name.startsWith(exact) ? 2 : name.includes(exact) ? 1 : 0,
      distance: e.p && origin ? Math.hypot(e.p.x-origin[0], e.p.z-origin[1]) : Infinity,
      matches: terms.every(t => words.includes(t))};
  }).filter(e => e.matches).sort((a,b) => b.score-a.score || (origin ? a.distance-b.distance : 0) || a.n.localeCompare(b.n));
}
export function cleanTrip(raw, ids) {
  if (!raw || typeof raw !== 'object') return {title:'My lake weekend', stops:[]};
  return {title: String(raw.title || 'My lake weekend').slice(0,80), stops: [...new Set((Array.isArray(raw.stops) ? raw.stops : []).filter(id => typeof id === 'string' && ids.has(id)))].slice(0,30)};
}
export function parseTrip(value, ids) {
  if (!value || value.length > 12000) return null;
  try { const raw = JSON.parse(value); if (!Array.isArray(raw.stops)) return null; return cleanTrip(raw, ids); } catch { return null; }
}
export function applyPlaceDetails(D, details) {
  const replacements = details.redirects || {};
  D.pois = D.pois.filter(p => !Object.hasOwn(replacements,p.id));
  for (const p of D.pois) {
    const d = details.places?.[p.id]; if (!d) continue;
    const facts = new Map(p.facts || []);
    for (const [k,v] of Object.entries(d.facts || {})) { if(v === null) facts.delete(k); else facts.set(k,v); }
    Object.assign(p, d, {facts:[...facts]});
  }
  return replacements;
}
