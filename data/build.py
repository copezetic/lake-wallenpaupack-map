#!/usr/bin/env python3
"""Build the Lake Wallenpaupack 3D map data.

Inputs (all in this folder; see fetch_osm.py / fetch_dem.py for how they are made):
  area.json            the rectangle the map covers
  dem.npy              elevation grid (Terrarium tiles)
  osm_roads.json       OpenStreetMap roads
  osm_water.json       OpenStreetMap lakes, streams, beaches, wetlands
  osm_places.json      OpenStreetMap places: marinas, launches, food, lodging, parks ...
  osm_piers.json       OpenStreetMap piers and docks
  buildings.geojsonl   Overture building footprints
  places_overture.geojsonl  Overture business listings
  places.json          hand-kept additions and corrections (optional)

Outputs:
  ../docs/lake-data.json        terrain, water, roads, places
  ../docs/tiles/b_<i>_<j>.json  building footprints, one file per map tile (loaded as you zoom in)

Run:  python build.py
"""
import base64, json, math, os, re
import numpy as np
from shapely.geometry import shape, box, LineString, Polygon, Point
from shapely.ops import polygonize, unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
def p(name): return os.path.join(HERE, name)
def load(name):
    return json.load(open(p(name)))['elements'] if os.path.exists(p(name)) else []

A = json.load(open(p('area.json')))
W, S, E, N = A['W'], A['S'], A['E'], A['N']
lat0, lon0 = (S + N) / 2, (W + E) / 2
KX = math.cos(math.radians(lat0)) * 111320.0
KZ = 110574.0

def xz(lon, lat): return [round((lon - lon0) * KX, 1), round(-(lat - lat0) * KZ, 1)]
def ring_xz(coords, nd=1): return [[round((c[0] - lon0) * KX, nd), round(-(c[1] - lat0) * KZ, nd)] for c in coords]
bbox = box(W, S, E, N)
xmin, zmin = xz(W, N); xmax, zmax = xz(E, S)
NTX, NTZ = round((xmax - xmin) / 2000), round((zmax - zmin) / 2000)   # the map is cut into tiles about 2 km square for close-up detail
TOL = 2.0 / KZ                              # simplify to about two metres

# ---- the edge of the detailed map: the rectangle, a little inside the data so nothing is cut ragged
m = 40
boundary = [[xmin + m, zmin + m], [xmax - m, zmin + m], [xmax - m, zmax - m], [xmin + m, zmax - m], [xmin + m, zmin + m]]
bxz = Polygon(boundary)

# ---- elevation
dem = np.load(p('dem.npy')).astype(np.float32)
emin = float(dem.min())
dem = dem - emin
# the country beyond the map: a coarse grid of heights that runs far past the rectangle, drawn faded by the viewer.
# Its lines fall exactly on the rectangle's edges, and the detailed heights are eased onto it over the last few
# hundred metres, so the two surfaces meet without a step.
FAR_N, FAR_PAD, EASE = 36, 130, 350.0
far = None
if os.path.exists(p('far_dem.npy')):
    fd = np.clip(np.load(p('far_dem.npy')).astype(np.float32), 40, 2500); fm = json.load(open(p('far_meta.json')))
    XSm, ZSm = xmax - xmin, zmax - zmin
    ncx = FAR_N; cx = XSm / ncx; ncz = round(ZSm / cx); cz = ZSm / ncz
    gx = xmin + (np.arange(ncx + 2 * FAR_PAD + 1) - FAR_PAD) * cx; gz = zmin + (np.arange(ncz + 2 * FAR_PAD + 1) - FAR_PAD) * cz
    fu = np.clip(((lon0 + gx / KX) - fm['W']) / (fm['E'] - fm['W']) * fm['w'] - .5, 0, fm['w'] - 1.001)
    fv = np.clip((fm['N'] - (lat0 - gz / KZ)) / (fm['N'] - fm['S']) * fm['h'] - .5, 0, fm['h'] - 1.001)
    ui = fu.astype(int); vi = fv.astype(int); a = (fu - ui)[None, :]; b = (fv - vi)[:, None]
    hc = (fd[vi][:, ui] * (1 - a) + fd[vi][:, ui + 1] * a) * (1 - b) + (fd[vi + 1][:, ui] * (1 - a) + fd[vi + 1][:, ui + 1] * a) * b - emin
    DH_, DW_ = dem.shape
    px = xmin + XSm * np.arange(DW_) / (DW_ - 1); pz = zmin + ZSm * np.arange(DH_) / (DH_ - 1)
    cu = np.clip((px - xmin) / cx + FAR_PAD, 0, hc.shape[1] - 1.001); cv = np.clip((pz - zmin) / cz + FAR_PAD, 0, hc.shape[0] - 1.001)
    ci = cu.astype(int); cj = cv.astype(int); a = (cu - ci)[None, :]; b = (cv - cj)[:, None]
    coarse = (hc[cj][:, ci] * (1 - a) + hc[cj][:, ci + 1] * a) * (1 - b) + (hc[cj + 1][:, ci] * (1 - a) + hc[cj + 1][:, ci + 1] * a) * b
    edge = np.minimum(np.minimum(px - xmin, xmax - px)[None, :], np.minimum(pz - zmin, zmax - pz)[:, None])
    t = np.clip(1 - edge / EASE, 0, 1); t = t * t * (3 - 2 * t)
    dem = dem * (1 - t) + coarse * t
    far = {'w': int(hc.shape[1]), 'h': int(hc.shape[0]), 'x0': round(float(gx[0]), 1), 'z0': round(float(gz[0]), 1), 'cx': cx, 'cz': cz, 'pad': FAR_PAD,
           'd': base64.b64encode(np.clip(np.round(hc * 10), -32768, 32767).astype('<i2').tobytes()).decode()}
dem_b64 = base64.b64encode(np.clip(np.round(dem * 10), 0, 65535).astype('<u2').tobytes()).decode()

# ---- roads
ROAD_KIND = {'motorway': 'hwy', 'trunk': 'hwy', 'primary': 'hwy', 'motorway_link': 'hwy', 'trunk_link': 'hwy', 'primary_link': 'hwy',
             'secondary': 'main', 'tertiary': 'main', 'secondary_link': 'main', 'tertiary_link': 'main',
             'unclassified': 'street', 'residential': 'street'}
NAME_FIX = {12075988: 'Bluebird Drive'}     # corrections from people who live there, keyed by OSM way id
el = load('osm_roads.json')
nodes = {e['id']: (e['lon'], e['lat']) for e in el if e['type'] == 'node'}
roads = []
for w in el:
    if w['type'] != 'way': continue
    t = w.get('tags', {}); k = ROAD_KIND.get(t.get('highway'))
    pts = [nodes[n] for n in w['nodes'] if n in nodes]
    if not k or len(pts) < 2: continue
    g = LineString(pts)
    if not g.intersects(bbox): continue
    name = NAME_FIX.get(w['id'], t.get('name', '')).replace('Cirle', 'Circle').replace('Tpk', 'Turnpike')
    r = {'k': k, 'n': name, 'p': ring_xz(pts)}                       # nodes kept as they are so junctions still meet
    if t.get('ref'): r['ref'] = t['ref'].split(';')[0]
    roads.append(r)

# ---- water, streams, beaches, wetlands
el = load('osm_water.json')
nodes = {e['id']: (e['lon'], e['lat']) for e in el if e['type'] == 'node'}
ways = {e['id']: e for e in el if e['type'] == 'way'}
def way_line(w): return [nodes[n] for n in w['nodes'] if n in nodes]
def polys_out(g, min_area=250):
    g = g.intersection(bbox).simplify(TOL)
    out = []
    for q in ([g] if isinstance(g, Polygon) else list(getattr(g, 'geoms', []))):
        if isinstance(q, Polygon) and not q.is_empty and q.area * KX * KZ >= min_area:
            out.append({'o': ring_xz(q.exterior.coords), 'h': [ring_xz(r.coords) for r in q.interiors if Polygon(r).area * KX * KZ > 150]})
    return out
water, features, used = [], [], set()
for e in el:
    if e['type'] != 'relation': continue
    t = e.get('tags', {})
    part = lambda role: [LineString(way_line(ways[m['ref']])) for m in e['members']
                         if m['type'] == 'way' and m['role'] == role and m['ref'] in ways and len(way_line(ways[m['ref']])) > 1]
    for m_ in e['members']: used.add(m_['ref'])
    op = unary_union(list(polygonize(unary_union(part('outer'))))) if part('outer') else Polygon()
    ip = unary_union(list(polygonize(unary_union(part('inner'))))) if part('inner') else None
    g = op.difference(ip) if ip is not None and not ip.is_empty else op
    if g.is_empty: continue
    for q in polys_out(g):
        q['n'] = t.get('name', ''); water.append(q)
for w in ways.values():
    t = w.get('tags', {})
    if w['id'] in used and 'natural' not in t: continue
    pts = way_line(w)
    if t.get('waterway') in ('stream', 'river') and len(pts) > 1:
        g = LineString(pts)
        if g.intersects(bbox):
            f = {'k': 'stream', 'p': ring_xz(g.simplify(TOL).coords)}
            if t.get('name'): f['n'] = t['name']
            features.append(f)
        continue
    if len(pts) < 4 or w['nodes'][0] != w['nodes'][-1]: continue
    g = Polygon(pts).buffer(0)
    if not g.intersects(bbox): continue
    if t.get('natural') == 'water':
        if w['id'] in used: continue
        for q in polys_out(g):
            q['n'] = t.get('name', ''); water.append(q)
    elif t.get('natural') in ('beach', 'wetland'):
        for q in polys_out(g, 400): features.append({'k': t['natural'], 'p': q['o']})

# ---- piers
el = load('osm_piers.json')
pn = {e['id']: (e['lon'], e['lat']) for e in el if e['type'] == 'node'}
piers = [ring_xz([pn[n] for n in w['nodes'] if n in pn]) for w in el if w['type'] == 'way']
piers = [q for q in piers if len(q) > 1]

# ---- trails: named footpaths and the members of hiking routes
trails = []
el = load('osm_trails.json')
tn = {e['id']: (e['lon'], e['lat']) for e in el if e['type'] == 'node'}
route_of = {}
for e in el:
    if e['type'] == 'relation' and e.get('tags', {}).get('route') in ('hiking', 'foot') and e['tags'].get('name'):
        for m_ in e['members']:
            if m_['type'] == 'way': route_of.setdefault(m_['ref'], e['tags']['name'])
NOT_TRAIL = re.compile(r'\b(road|lane|avenue|street|drive|bridge|footbridge|driveway)\b|overgrown|blazes\)$|^\(', re.I)
for w in el:
    if w['type'] != 'way': continue
    t = w.get('tags', {}); name = t.get('name') or route_of.get(w['id'])
    pts = [tn[n] for n in w['nodes'] if n in tn]
    if not name or len(pts) < 2 or NOT_TRAIL.search(name): continue
    g = LineString(pts)
    if not bbox.contains(g): continue
    name = re.sub(r'\s*\((?:\d+ mph|[A-Za-z ]+)\)$', '', name).replace(' #', ' ')
    trails.append({'n': name, 'p': ring_xz(g.simplify(TOL).coords)})
print('trails', len(trails), 'pieces,', len({t_['n'] for t_ in trails}), 'names')

# ---- lake name labels
lakes, by_name = [], {}
for q in water:
    if q.get('n'): by_name.setdefault(q['n'], []).append(Polygon(q['o'], q['h']).buffer(0))
for name, polys in by_name.items():
    g = unary_union(polys).intersection(bxz)
    if g.is_empty or g.area < 6000: continue
    big = max(getattr(g, 'geoms', [g]), key=lambda s: s.area)
    best, bd = big.representative_point(), -1
    x0, z0, x1, z1 = big.bounds
    for i in range(28):
        for j in range(28):
            c = Point(x0 + (x1 - x0) * (i + .5) / 28, z0 + (z1 - z0) * (j + .5) / 28)
            if big.contains(c):
                dd = big.exterior.distance(c)
                if dd > bd: best, bd = c, dd
    lakes.append({'n': name, 'x': round(best.x, 1), 'z': round(best.y, 1), 'a': round(g.area)})

# ---- places
CAT = [  # (category, test on tags, kind label, major?)
    ('water', lambda t: t.get('leisure') == 'marina' or t.get('waterway') == 'boatyard', 'Marina', True),
    ('water', lambda t: t.get('leisure') == 'slipway', 'Boat launch', True),
    ('water', lambda t: t.get('amenity') == 'boat_rental', 'Boat rental', True),
    ('water', lambda t: t.get('natural') == 'beach' or t.get('leisure') in ('beach_resort', 'swimming_area'), 'Beach', True),
    ('water', lambda t: t.get('waterway') == 'dam' and 'Wallenpaupack' in t.get('name', ''), 'Dam', True),   # the small pond dams are not worth a pin
    ('food', lambda t: t.get('amenity') in ('restaurant', 'bar', 'pub', 'cafe', 'fast_food', 'ice_cream'), None, False),
    ('stay', lambda t: t.get('tourism') in ('hotel', 'motel', 'guest_house', 'hostel', 'chalet', 'resort', 'camp_site', 'caravan_site'), None, False),
    ('nature', lambda t: t.get('leisure') in ('park', 'nature_reserve') or t.get('boundary') in ('protected_area', 'national_park')
        or t.get('tourism') in ('viewpoint', 'picnic_site', 'attraction', 'museum', 'information') or t.get('leisure') == 'golf_course', None, False),
    ('shops', lambda t: 'shop' in t or t.get('amenity') in ('fuel', 'marketplace', 'pharmacy', 'post_office', 'library'), None, False),
]
KIND = {'restaurant': 'Restaurant', 'bar': 'Bar', 'pub': 'Pub', 'cafe': 'Café', 'fast_food': 'Quick bite', 'ice_cream': 'Ice cream',
        'hotel': 'Hotel', 'motel': 'Motel', 'guest_house': 'Guest house', 'chalet': 'Rental', 'resort': 'Resort', 'camp_site': 'Campground',
        'caravan_site': 'RV park', 'park': 'Park', 'nature_reserve': 'Nature reserve', 'viewpoint': 'Viewpoint', 'picnic_site': 'Picnic area',
        'attraction': 'Attraction', 'museum': 'Museum', 'information': 'Visitor information', 'golf_course': 'Golf course', 'fuel': 'Fuel',
        'supermarket': 'Grocery', 'convenience': 'Convenience store', 'alcohol': 'Wine & spirits', 'bakery': 'Bakery', 'hardware': 'Hardware',
        'marketplace': 'Market', 'pharmacy': 'Pharmacy', 'post_office': 'Post office', 'library': 'Library', 'protected_area': 'Protected land'}
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
pois, towns, seen = [], [], set()
for e in load('osm_places.json'):
    t = e.get('tags', {}); name = t.get('name')
    c = e.get('center') or ({'lat': e['lat'], 'lon': e['lon']} if 'lat' in e else None)
    if not c or not bbox.contains(Point(c['lon'], c['lat'])) or t.get('boundary') == 'administrative': continue
    x, z = xz(c['lon'], c['lat'])
    if t.get('place') in ('town', 'village', 'hamlet', 'suburb', 'neighbourhood', 'locality') or (t.get('landuse') == 'residential' and name):
        if name and t.get('place') != 'locality':
            towns.append({'n': name, 'x': x, 'z': z, 'k': 'town' if t.get('place') in ('town', 'village') else 'hamlet' if t.get('place') == 'hamlet' else 'community'})
        continue
    if name and t.get('tourism') == 'attraction' and (name[0].islower() or name.endswith('?')): continue   # mappers' notes, not places
    for cat, test, kind, major in CAT:
        if not test(t): continue
        kind = kind or KIND.get(t.get('amenity') or t.get('tourism') or t.get('leisure') or t.get('shop') or t.get('boundary'), 'Shop' if 'shop' in t else 'Place')
        if not name:
            if not major: break                                   # an unnamed shop is not worth a pin
            name = kind
        key = (slug(name), round(x / 150), round(z / 150))
        if key in seen: break
        seen.add(key)
        q = {'id': f"{slug(name)}-{e['id']}", 'name': name, 'cat': cat, 'kind': kind, 'x': x, 'z': z, 'dlat': round(c['lat'], 6), 'dlon': round(c['lon'], 6)}
        if major: q['major'] = True
        facts = []
        addr = ' '.join(v for v in [t.get('addr:housenumber'), t.get('addr:street')] if v)
        if addr: facts.append(['Address', addr + (', ' + t['addr:city'] if t.get('addr:city') else '')])
        if t.get('phone') or t.get('contact:phone'): facts.append(['Phone', t.get('phone') or t.get('contact:phone')])
        if t.get('opening_hours'): facts.append(['Hours', t['opening_hours']])
        if t.get('cuisine'): facts.append(['Serves', t['cuisine'].replace(';', ', ').replace('_', ' ')])
        if facts: q['facts'] = facts
        url = t.get('website') or t.get('contact:website')
        if url: q['url'] = url if url.startswith('http') else 'https://' + url
        pois.append(q); break
# Overture's business listings fill in what OpenStreetMap lacks around here (shops, restaurants, lodging)
def pretty(k): return k.replace('_', ' ').capitalize()
def tidy(n):
    n = re.sub(r'\s*,?\s*\b(l\.?l\.?c|inc)\b\.?$', '', n, flags=re.I)
    n = re.sub(r'\s*[-,]?\s*Lake Wallenpaupack,? (PA|Pennsylvania)$', '', n)
    n = re.sub(r'\bIi\b', 'II', n)
    if n.isupper() and len(n) > 4: n = n.title()
    return n.strip(' ,-')
# listings that are not somewhere a visitor would go
DULL = re.compile(r'hearing aid|carpet|flooring|computer|electrical supply|electronics|auto dealer|auto body|apartment', re.I)
def ov_cat(tax):
    h = tax.get('hierarchy') or []; pr = tax.get('primary') or ''
    if not h: return None
    if pr in ('marina', 'boat_rental_and_training', 'boat_tours', 'beach', 'boat_charter', 'fishing_charter') or 'boat' in pr: return 'water', True
    if h[0] == 'food_and_drink': return 'food', False
    if h[0] == 'lodging': return (None if 'private_lodging' in h else ('stay', False))
    if pr in ('park', 'historic_site', 'museum', 'golf_course', 'hiking_trail', 'nature_reserve', 'state_park', 'campground', 'ski_resort', 'amusement_park', 'art_gallery', 'winery', 'brewery', 'farm') \
       or h[0] in ('attractions_and_activities', 'arts_and_entertainment'): return 'nature', False
    if h[0] == 'shopping' or pr == 'gas_station': return 'shops', False
    return None
if os.path.exists(p('places_overture.geojsonl')):
    for line in open(p('places_overture.geojsonl')):
        f = json.loads(line); pr = f['properties']; name = (pr.get('names') or {}).get('primary')
        hit = ov_cat(pr.get('taxonomy') or {})
        if not name or not hit or not hit[0] or (pr.get('confidence') or 0) < 0.7: continue
        name = tidy(name)
        if ', Pennsylvania' in name or DULL.search(name + ' ' + pretty(pr['taxonomy']['primary'])): continue   # encyclopedia entries and trades
        lon, lat = f['geometry']['coordinates'][:2]
        if not bbox.contains(Point(lon, lat)): continue
        x, z = xz(lon, lat)
        if any(slug(o['name']) == slug(name) and math.hypot(o['x'] - x, o['z'] - z) < 600 for o in pois): continue
        if any(math.hypot(o['x'] - x, o['z'] - z) < 25 and (slug(name) in slug(o['name']) or slug(o['name']) in slug(name)) for o in pois): continue
        q = {'id': 'ov-' + f['id'][:12], 'name': name, 'cat': hit[0], 'kind': pretty(pr['taxonomy']['primary']), 'x': x, 'z': z, 'dlat': round(lat, 6), 'dlon': round(lon, 6)}
        if hit[1]: q['major'] = True
        facts = []
        ad = (pr.get('addresses') or [{}])[0]
        if ad.get('freeform'): facts.append(['Address', ad['freeform'] + (', ' + ad['locality'] if ad.get('locality') else '')])
        ph = (pr.get('phones') or [None])[0]
        if ph:
            d = re.sub(r'\D', '', ph)[-10:]
            facts.append(['Phone', f'{d[:3]}-{d[3:6]}-{d[6:]}' if len(d) == 10 else ph])
        if facts: q['facts'] = facts
        web = (pr.get('websites') or [None])[0]
        if web: q['url'] = web
        pois.append(q)
# hand-kept additions and corrections: same shape as above, with lat/lon; "drop": true removes an OSM place by id
if os.path.exists(p('places.json')):
    for q in json.load(open(p('places.json'))):
        old = [o for o in pois if o['id'] == q['id']]
        if not old and (q.get('drop') or q.get('patch')): print('places.json: no place with id', q['id'])
        pois = [o for o in pois if o['id'] != q['id']]
        if q.get('drop'): continue
        if q.get('patch'):
            for o in old: o.update(q['patch']); pois.append(o)
            continue
        q = dict(q); q['dlat'], q['dlon'] = q['lat'], q['lon']; q['x'], q['z'] = xz(q.pop('lon'), q.pop('lat')); pois.append(q)
# everything inside a resort is the resort: one pin, not one per lounge
for big, r in (('Cove Haven Resort', 650),):
    hub = next((o for o in pois if o['name'] == big), None)
    if hub: pois = [o for o in pois if o is hub or o.get('major') or math.hypot(o['x'] - hub['x'], o['z'] - hub['z']) > r]
# unnamed boat launches: one per spot, named after the recreation area they belong to
launches = [o for o in pois if o['name'] == 'Boat launch']
for o in launches:
    if o not in pois: continue
    pois = [q for q in pois if q is o or q not in launches or math.hypot(q['x'] - o['x'], q['z'] - o['z']) > 160]
    near = min((q for q in pois if 'Recreation Area' in q['name'] or 'Access Area' in q['name']), key=lambda q: math.hypot(q['x'] - o['x'], q['z'] - o['z']), default=None)
    if near and math.hypot(near['x'] - o['x'], near['z'] - o['z']) < 320:
        o['name'] = re.sub(r' (Campground|Access Area)$', '', near['name']) + ' boat launch'
# the same place listed twice: same words within a short walk, or the same name a little further off
STOP = set('the a an and of at on in inc llc co company restaurant bar grill grille pub cafe shop shoppe store stores pa hawley lake wallenpaupack'.split())
def toks(n):
    n = re.sub(r"[’'`.]", '', n.lower())
    return frozenset(w.rstrip('s') for w in re.findall(r'[a-z0-9]+', n) if w not in STOP)
def squash(n): return re.sub(r'[^a-z0-9]', '', re.sub(r"[’'`.]", '', n.lower())).replace('coffeehouse', 'coffee').replace('house', '')
def same(a, b):
    d = math.hypot(a['x'] - b['x'], a['z'] - b['z']); ta, tb = toks(a['name']), toks(b['name'])
    if not ta or not tb: return False
    if squash(a['name']).rstrip('s') == squash(b['name']).rstrip('s') or ta == tb: return d < 800
    wide = 1500 if a['cat'] == b['cat'] == 'nature' else 160
    if (ta <= tb or tb <= ta) and d < wide: return True
    first = lambda n: re.sub(r"[’'`.]", '', n.lower()).split()[0]
    return d < 30 and a['cat'] == b['cat'] and first(a['name']) == first(b['name']) and len(first(a['name'])) > 3
def rank(o): return (not o['id'].startswith('ov-'), len(o.get('facts', [])) + ('url' in o), -len(o['name']))   # OpenStreetMap's position first, then the fuller card
kept = []
for o in sorted(pois, key=rank, reverse=True):
    twin = next((k for k in kept if same(k, o)), None)
    if twin is None: kept.append(o); continue
    have = {f[0] for f in twin.get('facts', [])}
    for f in o.get('facts', []):
        if f[0] not in have: twin.setdefault('facts', []).append(f)
    if 'url' in o and 'url' not in twin: twin['url'] = o['url']
    if o.get('major'): twin['major'] = True
print('places', len(pois), '->', len(kept), 'after merging doubles')
pois = sorted(kept, key=lambda o: (o['cat'], o['name']))

# communities and islands kept by hand (communities.json), on top of the few OpenStreetMap knows
FIX = {'Lake Wallenpaupack Estate': 'Lake Wallenpaupack Estates', 'Tanglewood': None, 'Tanglewood Estate': None}
towns = [dict(t_, n=FIX.get(t_['n'], t_['n'])) for t_ in towns if FIX.get(t_['n'], t_['n'])]
for t_ in towns:
    if t_['n'] in ('Greentown',) and t_['k'] == 'hamlet': t_['k'] = 'town'      # the village at the south end gets a town's lettering
if os.path.exists(p('communities.json')):
    for c in json.load(open(p('communities.json')))['communities']:
        if not bbox.contains(Point(c['lon'], c['lat'])): continue
        x, z = xz(c['lon'], c['lat']); towns.append({'n': c['n'], 'x': x, 'z': z, 'k': c['k'], **({'sep': 1} if c.get('sep') else {})})
# one label per name, unless the same name really is used in two places
order = {'town': 0, 'hamlet': 1, 'community': 2, 'island': 2}
uniq = []
for t_ in sorted(towns, key=lambda t_: order[t_['k']]):
    if not any(slug(u['n']) == slug(t_['n']) and math.hypot(u['x'] - t_['x'], u['z'] - t_['z']) < 1200 for u in uniq): uniq.append(t_)
towns = uniq

# ---- community areas, for showing one community on its own
SEP_R = 450
# Census outlines where they exist; otherwise the streets nearest the name, which is only a rough guide.
def rings(g): return [[[round(v[0]), round(v[1])] for v in q.exterior.coords[:-1]] for q in getattr(g, 'geoms', [g]) if not q.is_empty]
census = []
if os.path.exists(p('census_places.geojson')):
    for f in json.load(open(p('census_places.geojson')))['features']:
        g = shape(f['geometry']); g = g if isinstance(g, Polygon) else max(g.geoms, key=lambda q: q.area)
        census.append((f['properties']['BASENAME'], Polygon(ring_xz(g.exterior.coords)).buffer(0)))
for name, g in census:
    own = [t_ for t_ in towns if slug(t_['n']) == slug(name)]
    for t_ in own[:1]: t_['a'] = rings(g.intersection(bxz).simplify(6)); t_['src'] = 'census'
    for t_ in towns:
        if t_ not in own and t_['k'] == 'community' and g.contains(Point(t_['x'], t_['z'])): t_['encl' if t_.get('sep') else 'in'] = name
taken = unary_union([g for _, g in census]) if census else Polygon()
thru = unary_union([LineString(r['p']) for r in roads if r['k'] != 'street']).buffer(14)
def cut(g):
    out = []
    for ln in getattr(g, 'geoms', [g]):
        if ln.is_empty or ln.geom_type != 'LineString' or ln.length < 8: continue
        n = max(1, round(ln.length / 60))
        out += [LineString([ln.interpolate(i / n, normalized=True), ln.interpolate((i + 1) / n, normalized=True)]) for i in range(n)]
    return out
segs = []
for r in roads:
    if r['k'] == 'street': segs += cut(LineString(r['p']).difference(thru).difference(taken))
# communities marked "sep" in communities.json sit inside a Census outline but are not part of it:
# they take the streets nearest their name, and that ground comes out of the Census community
seps = [t_ for t_ in towns if 'encl' in t_]
if seps:
    inner = []
    for r in roads:
        if r['k'] == 'street': inner += cut(LineString(r['p']).difference(thru).intersection(taken))
    got = {}
    for q in inner:
        m_ = q.centroid; i = min(range(len(seps)), key=lambda i: math.hypot(seps[i]['x'] - m_.x, seps[i]['z'] - m_.y))
        if math.hypot(seps[i]['x'] - m_.x, seps[i]['z'] - m_.y) < SEP_R: got.setdefault(i, []).append(q)
    cz = dict(census)
    for i, c in enumerate(seps):
        if i not in got: continue
        g = unary_union([q.buffer(75) for q in got[i]]).buffer(45).buffer(-70).intersection(cz[c['encl']]).simplify(8)
        parts = sorted(getattr(g, 'geoms', [g]), key=lambda q: -q.area)[:1]
        if parts and parts[0].area > 12000: c['a'] = rings(parts[0]); c['src'] = 'streets'; c['g'] = parts[0]
    for name, g in census:
        cutout = [c['g'] for c in seps if c['encl'] == name and 'g' in c]
        if not cutout: continue
        rest = g.intersection(bxz).difference(unary_union(cutout).buffer(1)).simplify(6)
        rest = [q for q in getattr(rest, 'geoms', [rest]) if q.area > 12000]
        for t_ in towns:
            if t_.get('src') == 'census' and slug(t_['n']) == slug(name): t_['a'] = rings(unary_union(rest))
    for c in seps: c.pop('g', None)
for t_ in towns: t_.pop('sep', None); t_.pop('encl', None)
net = unary_union([q.buffer(3) for q in segs]); comps = list(getattr(net, 'geoms', [net]))
coms = [t_ for t_ in towns if t_['k'] == 'community' and 'a' not in t_ and 'in' not in t_]
claims = {}
for ci, c in enumerate(coms):
    pt = Point(c['x'], c['z'])
    for k, g in enumerate(comps):
        if g.distance(pt) < 380: claims.setdefault(k, []).append(ci)
mine = {}
for q in segs:
    m_ = q.centroid; k = min(range(len(comps)), key=lambda k: comps[k].distance(m_)) if comps else None
    cl = claims.get(k)
    if not cl: continue
    ci = min(cl, key=lambda i: math.hypot(coms[i]['x'] - m_.x, coms[i]['z'] - m_.y))
    if math.hypot(coms[ci]['x'] - m_.x, coms[ci]['z'] - m_.y) < (1600 if len(cl) == 1 else 1100): mine.setdefault(ci, []).append(q)
for ci, c in enumerate(coms):
    if ci not in mine: continue
    g = unary_union([q.buffer(75) for q in mine[ci]]).buffer(45).buffer(-70).simplify(8)
    parts = sorted(getattr(g, 'geoms', [g]), key=lambda q: -q.area); pt = Point(c['x'], c['z'])
    parts = [q for q in parts if q.area > 12000 and (q.distance(pt) < 500 or q.area > .25 * parts[0].area)][:3]
    if parts: c['a'] = rings(unary_union(parts)); c['src'] = 'streets'
print('community areas:', sum(t_.get('src') == 'census' for t_ in towns), 'census,', sum(t_.get('src') == 'streets' for t_ in towns), 'from streets,',
      sum('in' in t_ for t_ in towns), 'inside another,', sum(t_['k'] == 'community' and 'a' not in t_ and 'in' not in t_ for t_ in towns), 'none')

# ---- buildings, one file per tile
tiles = {}
if os.path.exists(p('buildings.geojsonl')):
    for line in open(p('buildings.geojsonl')):
        f = json.loads(line); g = shape(f['geometry'])
        for q in ([g] if isinstance(g, Polygon) else list(getattr(g, 'geoms', []))):
            q = q.simplify(0.000008)
            c = q.centroid; x, z = xz(c.x, c.y)
            if not bxz.contains(Point(x, z)): continue
            i = min(NTX - 1, int((x - xmin) / (xmax - xmin) * NTX)); j = min(NTZ - 1, int((z - zmin) / (zmax - zmin) * NTZ))
            h = f['properties'].get('height') or 5.0
            tiles.setdefault((i, j), []).append({'h': round(float(h), 1), 'p': ring_xz(q.exterior.coords)[:-1]})
site = os.path.join(HERE, '..', 'docs'); os.makedirs(os.path.join(site, 'tiles'), exist_ok=True)
for f in os.listdir(os.path.join(site, 'tiles')): os.remove(os.path.join(site, 'tiles', f))
nb = 0
for i in range(NTX):
    for j in range(NTZ):
        b = tiles.get((i, j), []); nb += len(b)
        json.dump(b, open(os.path.join(site, 'tiles', f'b_{i}_{j}.json'), 'w'), separators=(',', ':'))

# the lake's shoreline comes from lidar when fetch_shore.py has run: far sharper than the volunteer outline
if os.path.exists('lake_shore.json'):
    SH = json.load(open('lake_shore.json')); xz_ = lambda r: [[round((q[1] - lon0) * KX, 1), round(-(q[0] - lat0) * KZ, 1)] for q in r]
    big = max((w for w in water if w.get('n') == 'Lake Wallenpaupack'), key=lambda w: len(w['o']), default=None)
    if big:                                  # lidar flattens most islands into the lake, so the mapped islands are kept as well
        isl = [xz_(r) for r in SH['islands']]; got = [Polygon(r) for r in isl]
        big['o'] = xz_(SH['outer']); big['h'] = isl + [h for h in big['h'] if not any(Polygon(h).intersects(g) for g in got)]
out = {'meta': {'W': W, 'S': S, 'E': E, 'N': N, 'lat0': lat0, 'lon0': lon0, 'kx': KX, 'kz': KZ, 'emin': emin,
                'demW': int(dem.shape[1]), 'demH': int(dem.shape[0]), 'xmin': xmin, 'xmax': xmax, 'zmin': zmin, 'zmax': zmax, 'ntx': NTX, 'ntz': NTZ},
       'dem': dem_b64, 'boundary': boundary, 'lakes': lakes, 'water': water, 'roads': roads, 'features': features,
       'piers': piers, 'towns': towns, 'pois': pois, 'trails': trails}
if far: out['far'] = far
dst = os.path.join(site, 'lake-data.json')
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print('wrote', os.path.getsize(dst) // 1024, 'KB | roads', len(roads), 'water', len(water), 'features', len(features), 'piers', len(piers),
      'lakes', len(lakes), 'towns', len(towns), 'pois', len(pois), 'buildings', nb)
