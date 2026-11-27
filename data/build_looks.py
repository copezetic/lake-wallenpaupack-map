"""Closer looks: for golf courses, marinas and campgrounds on the map, pull the grounds from OpenStreetMap (boundary, paths, drives,
buildings, parking; fairways, greens, tees and bunkers; docks; camp pitches) and add them to ../docs/parks.json beside the hand-kept
entries (those with 'hand': true, e.g. the animal park, are left alone). A place is kept only if OpenStreetMap has real detail inside it."""
import json, math, time, urllib.request, urllib.parse
D = json.load(open('../docs/lake-data.json')); M = D['meta']
def overpass(q):
    for i in range(6):
        for host in ('https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'):
            try: return json.load(urllib.request.urlopen(urllib.request.Request(host, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'lake-map-build/1.0'}), timeout=90))['elements']
            except Exception as e: print('  retry', host[8:30], str(e)[:40])
        time.sleep(15)
    return None
KINDS = {'Golf course': ('leisure', 'golf_course', 'golf'), 'Marina': ('leisure', 'marina', 'marina'), 'Campground': ('tourism', 'camp_site', 'camp')}
def inside(ring, lat, lon):
    c = False
    for i in range(len(ring)):
        a, b = ring[i], ring[i-1]
        if (a[0] > lat) != (b[0] > lat) and lon < (b[1]-a[1]) * (lat-a[0]) / (b[0]-a[0]) + a[1]: c = not c
    return c
PK = json.load(open('../docs/parks.json')); keep = [p for p in PK['parks'] if p.get('hand') or p['id'] == 'claws']
for p in keep: p['hand'] = True
made = []
for poi in D['pois']:
    if poi.get('kind') not in KINDS: continue
    k, v, typ = KINDS[poi['kind']]; lat = poi.get('dlat') or M['lat0'] - poi['z'] / M['kz']; lon = poi.get('dlon') or M['lon0'] + poi['x'] / M['kx']
    els = overpass(f'[out:json][timeout:60];way["{k}"="{v}"](around:350,{lat},{lon});out geom tags;')
    if els is None: print('SKIP (server)', poi['name']); continue
    if not els: print('no outline', poi['name']); continue
    w = min(els, key=lambda e: min(math.hypot((g['lat']-lat)*110574, (g['lon']-lon)*83438) for g in e['geometry']))
    ring = [(g['lat'], g['lon']) for g in w['geometry']]
    if any(m.get('osm') == w['id'] for m in made): continue
    s, n_, w_, e_ = min(r[0] for r in ring), max(r[0] for r in ring), min(r[1] for r in ring), max(r[1] for r in ring)
    pad = 0.0012 if typ == 'marina' else 0
    inn = overpass(f'[out:json][timeout:90];(way({s-pad},{w_-pad},{n_+pad},{e_+pad});node({s-pad},{w_-pad},{n_+pad},{e_+pad})[~"^(golf|amenity|shop|tourism|entrance)$"~"."];);out geom tags;')
    if inn is None: print('SKIP (server)', poi['name']); continue
    o = {k2: [] for k2 in ('paths', 'drives', 'buildings', 'parking', 'fairways', 'greens', 'tees', 'bunkers', 'ponds', 'pitches', 'holes', 'piers', 'pts')}
    r6 = lambda g: [round(g['lat'], 6), round(g['lon'], 6)]
    for e in inn:
        t = e.get('tags', {})
        if e['type'] == 'node':
            nm = {'toilets': 'Restrooms', 'restaurant': 'Restaurant', 'fast_food': 'Food', 'cafe': 'Café', 'fuel': 'Fuel', 'shower': 'Showers', 'bar': 'Bar'}.get(t.get('amenity'))
            if nm and inside(ring, e['lat'], e['lon']): o['pts'].append({'n': nm, 'll': [round(e['lat'], 6), round(e['lon'], 6)]})
            continue
        ll = [r6(g) for g in e.get('geometry', [])]
        if len(ll) < 2: continue
        c = (sum(q[0] for q in ll) / len(ll), sum(q[1] for q in ll) / len(ll)); near = inside(ring, *c)
        if t.get('man_made') == 'pier' and (near or typ == 'marina'): o['piers'].append(ll); continue
        if not near: continue
        gf = t.get('golf')
        if gf == 'fairway': o['fairways'].append(ll)
        elif gf == 'green': o['greens'].append(ll)
        elif gf == 'tee': o['tees'].append(ll)
        elif gf == 'bunker': o['bunkers'].append(ll)
        elif gf == 'hole':
            o['holes'].append(ll)
            if t.get('ref'): o['pts'].append({'n': t['ref'] + (' · par ' + t['par'] if t.get('par') else ''), 'll': ll[0]})
        elif gf in ('water_hazard', 'lateral_water_hazard') or t.get('natural') == 'water': o['ponds'].append(ll)
        elif t.get('tourism') == 'camp_pitch': o['pitches'].append(ll)
        elif t.get('highway') in ('footway', 'path', 'pedestrian', 'cycleway') or gf == 'cartpath': o['paths'].append(ll)
        elif t.get('highway') in ('service', 'track', 'unclassified', 'residential'): o['drives'].append(ll)
        elif 'building' in t: o['buildings'].append(ll)
        elif t.get('amenity') == 'parking': o['parking'].append(ll)
    score = {'golf': len(o['greens']) + len(o['fairways']) + len(o['holes']), 'marina': len(o['piers']), 'camp': len(o['pitches']) + len(o['drives'])}[typ]
    need = {'golf': 6, 'marina': 3, 'camp': 4}[typ]
    print(poi['name'], typ, {k2: len(v2) for k2, v2 in o.items() if v2}, 'KEEP' if score >= need else 'thin')
    if score < need: continue
    holes = len([q for q in o['pts'] if ' · par ' in q['n'] or q['n'].isdigit()])
    lines = {'golf': f"{len(o['greens'])} greens, {len(o['fairways'])} fairways and {len(o['bunkers'])} bunkers are mapped here" + (f", with {holes} holes numbered." if holes else '.'),
             'marina': f"{len(o['piers'])} docks are mapped here.", 'camp': f"{len(o['pitches'])} pitches and the camp roads are mapped here." if o['pitches'] else 'The camp roads and buildings are mapped here.'}[typ]
    size = max((n_ - s) * 110574, (e_ - w_) * 83438)
    pk = {'id': ''.join(ch for ch in poi['name'].lower().replace(' ', '-') if ch.isalnum() or ch == '-')[:40], 'poi': poi['id'], 'osm': w['id'], 'kick': 'A closer look', 'url': poi.get('url'),
          'lines': [lines], 'fine': 'The layout comes from OpenStreetMap volunteers and may be incomplete or out of date. An independent map, not affiliated with this place.',
          'updated': time.strftime('%Y-%m-%d'), 'viewD': int(max(380, min(2400, size * 1.5))), 'labelD': int(max(2600, size * 3)), 'boundary': [[round(a, 6), round(b, 6)] for a, b in ring]}
    pk.update({k2: v2 for k2, v2 in o.items() if v2}); made.append(pk)
PK['parks'] = keep + made
json.dump(PK, open('../docs/parks.json', 'w'), ensure_ascii=False, separators=(',', ':')); print(len(made), 'closer looks built')
