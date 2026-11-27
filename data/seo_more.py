# run inside build_seo.py: lake community pages, town pages, boat rentals and waterfront dining. Everything is computed from the map's
# own data (positions and listings); nothing is said about a community beyond its name and where it meets the lake.
from shapely.geometry import Polygon as _Pg, Point as _Pt
_W = max((w for w in D['water'] if w.get('n') == 'Lake Wallenpaupack'), key=lambda w: len(w['o'])); _LAKE = _Pg(_W['o'], _W['h']).buffer(0)
sl = lambda n: re.sub(r'[^a-z0-9]+', '-', n.lower()).strip('-')
mi = lambda a, b: math.hypot(a['x'] - b['x'], a['z'] - b['z']) / 1609.34
def nearest(pt, ps, n=1): return sorted(ps, key=lambda q: mi(pt, q))[:n]
ANAME = {}
def nl(pt, ps, n): return '<ul class="l">' + ''.join(f'<li>{plink(q["id"]) if q["id"] in slugs else "<b>" + e(ANAME.get(q["id"], q["name"])) + "</b>"}<small>{e(q["kind"])} · {mi(pt, q):.1f} mi in a straight line</small></li>' for q in nearest(pt, ps, n)) + '</ul>'
TOWNPTS = [t for t in D['towns'] if t.get('k') == 'town']
COMS_ = []; seen = set()
for t in sorted((t for t in D['towns'] if t.get('k') == 'community' or t.get('a')), key=lambda t: t['n']):
    if sl(t['n']) not in seen: seen.add(sl(t['n'])); COMS_.append(t)
MAR = cat('water', ('Marina',)); FOOD = cat('food'); STAY = cat('stay'); FUN = cat('nature')
ACC = []                                           # the public beach and the public launches only, from access.json
for s_ in J('access')['sections'][:2]:
    for i in s_.get('items', []):
        q = BY.get(i.get('poi')); la, lo = (q['dlat'], q['dlon']) if q else (i.get('lat'), i.get('lon'))
        if la is None: continue
        pid = i.get('poi') if q else 'acc-' + sl(i['n']); ANAME[pid] = i['n']
        ACC.append({'id': pid, 'name': i['n'], 'kind': 'Public beach' if s_['title'] == 'Swim' else 'Public boat launch', 'x': (lo - M['lon0']) * M['kx'], 'z': -(la - M['lat0']) * M['kz']})
for t in COMS_:
    tn = nearest(t, TOWNPTS)[0] if TOWNPTS else None
    desc = f"{t['n']} is one of the lake communities around Lake Wallenpaupack{', about ' + format(mi(t, tn), '.1f') + ' miles from ' + tn['n'] if tn else ''}. See it on the 3D map, with the nearest marinas, public access and places to eat."
    body = f'''<h1>{e(t['n'])}</h1><p>{e(desc)}</p><a class="btn" href="/?c={sl(t['n'])}">See {e(t['n'])} on the 3D map</a>
<h2>Nearest marinas</h2>{nl(t, MAR, 3)}{'<h2>Nearest public beach or launch</h2>' + nl(t, ACC, 3) if ACC else ''}
<h2>Places to eat nearby</h2>{nl(t, FOOD, 6)}<h2>Things to do nearby</h2>{nl(t, FUN, 4)}
<p><a href="/guide/real-estate.html">Housing market figures for the lake area →</a> · <a href="/guide/communities.html">All lake communities →</a></p>
<p class="fine">Community names and positions are from the county's 2012 map of lake developments and landmarks, placed to within about 100 metres; the position marks where the community meets the lake. Most are private. This page is not affiliated with the community or its association, and says nothing about its rules or amenities.</p>'''
    page(f'community/{sl(t["n"])}.html', f'{t["n"]} · Lake Wallenpaupack community | WallyMap', desc, body, kick='Lake community')
guide('communities', 'Lake communities on Lake Wallenpaupack', f'{len(COMS_)} named communities and developments around the shore of Lake Wallenpaupack, each placed on the 3D map.',
      '<ul class="l">' + ''.join(f'<li><a href="/community/{sl(t["n"])}.html">{e(t["n"])}</a></li>' for t in COMS_) + '</ul>', '?c=' + sl(COMS_[0]['n']) if COMS_ else '')
# ---- towns
TOWNS_ = ['Hawley', 'Honesdale', 'Greentown', 'Lake Ariel', 'Hamlin', 'Tafton', 'Lakeville', 'Newfoundland']
def intown(n): return [p for p in sorted(POIS, key=lambda p: p['name']) if town(p) == n]
for n in TOWNS_:
    ps = intown(n); sec = ''
    for c_, lab in (('food', 'Places to eat and drink'), ('nature', 'Things to do'), ('stay', 'Places to stay'), ('water', 'On the water'), ('shops', 'Shops and services')):
        l = [p for p in ps if p['cat'] == c_]
        if l: sec += f'<h2>{lab} in {e(n)} · {len(l)}</h2><ul class="l">' + ''.join(f'<li>{plink(p["id"]) if p["id"] in slugs else "<b>" + e(p["name"]) + "</b>"}<small>{e(p["kind"])}{" · " + e(dict(p["facts"]).get("Address", "").rsplit(",", 1)[0]) if dict(p.get("facts", [])).get("Address") else ""}</small></li>' for p in l) + '</ul>'
    desc = f'{len(ps)} places to eat, shop, stay and visit in {n}, Pennsylvania, near Lake Wallenpaupack, each on the 3D map.'
    page(f'town/{sl(n)}.html', f'Things to do in {n}, PA | Lake Wallenpaupack map', desc, f'<h1>Things to do in {e(n)}, PA</h1><p>{e(desc)}</p><a class="btn" href="/?town={e(n)}">See {e(n)} on the 3D map</a>{sec}<p class="fine">Listings are from OpenStreetMap and Overture Maps, grouped by the town in each address.</p>', kick='Town')
guide('towns', 'Towns around Lake Wallenpaupack', 'The towns around Lake Wallenpaupack and what is in each: where to eat, shop, stay and what to do.',
      '<ul class="l">' + ''.join(f'<li><a href="/town/{sl(n)}.html">Things to do in {e(n)}</a><small>{len(intown(n))} places</small></li>' for n in TOWNS_) + '</ul>')
# ---- boat rentals and tours; food by the water
RENT = [p for p in PAGED if 'boat' in p['kind'].lower() and any(k in p['kind'].lower() for k in ('rental', 'hire', 'tour'))]
ONL = [p for p in RENT if _LAKE.distance(_Pt(p['x'], p['z'])) <= 1500]; OFF = [p for p in RENT if p not in ONL]
guide('boat-rentals', 'Boat rentals and tours on Lake Wallenpaupack', f'{len(ONL)} listings for boat rentals and boat tours on Lake Wallenpaupack, with address, phone and website. Call ahead: seasons, prices and what each rents are not listed here.',
      listing(ONL) + ('<h2>On other lakes nearby</h2>' + listing(OFF) if OFF else ''))
SHORE = sorted((p for p in FOOD if _LAKE.distance(_Pt(p['x'], p['z'])) <= 150), key=lambda p: _LAKE.distance(_Pt(p['x'], p['z'])))
guide('waterfront-dining', 'Restaurants by the water on Lake Wallenpaupack', f'{len(SHORE)} places to eat and drink within about 500 feet of the Lake Wallenpaupack shoreline, nearest the water first. Being close to the shore does not mean a place has a lake view or a dock: see Dock and dine for those that say boaters can arrive by water.',
      '<ul class="l">' + ''.join(f'<li>{plink(p["id"])}<small>{e(p["kind"])} · about {max(10, round(_LAKE.distance(_Pt(p["x"], p["z"])) * 3.281 / 10) * 10):.0f} ft from the shoreline{" · " + e(dict(p["facts"]).get("Address", "")) if dict(p["facts"]).get("Address") else ""}</small></li>' for p in SHORE) + '</ul><p><a href="/guide/dock-and-dine.html">Dock and dine →</a></p>')

# ---- groceries, beer and liquor
_ST = [('Grocery store', 'Grocery stores'), ('Beer distributor', 'Beer distributors'), ('Wine and spirits store', 'Wine and spirits stores')]
def stl(k): return '<ul class="l">' + ''.join(f'<li><b>{e(p["name"])}</b> · <a href="/?p={e(p["id"])}">on the map</a><small>{e(dict(p.get("facts", [])).get("Address", ""))}{" · " + e(dict(p.get("facts", [])).get("Phone", "")) if dict(p.get("facts", [])).get("Phone") else ""}</small></li>' for p in sorted(POIS, key=lambda p: p["name"]) if p["kind"] == k) + '</ul>'
guide('groceries-beer-and-liquor', 'Groceries, beer and liquor around Lake Wallenpaupack', 'Where to stock up around Lake Wallenpaupack: grocery stores, beer distributors, and the state wine and spirits stores. In Pennsylvania, liquor is sold at state Fine Wine & Good Spirits stores and cases of beer at beer distributors.',
      ''.join(f'<h2>{t}</h2>{stl(k)}' for k, t in _ST) + '<p class="fine">From OpenStreetMap and Overture Maps; hours are not listed here, so check before a late run. Some groceries and restaurants also sell beer and wine to go, which this list does not cover.</p>', '?stockup')

# ---- utilities and services directory
if os.path.exists('../docs/services.json'):
    _SV = J('services'); _PW = J('outages')
    def _svi(it): return f'<li><b>{e(it["n"])}</b><small>{e(it.get("a", ""))}{" · " if it.get("a") and it.get("ph") else ""}{e(it.get("ph", ""))}{f""" · <a href="{e(it["url"])}" rel="nofollow noopener">website</a>""" if it.get("url") else ""}</small></li>'
    guide('utilities-and-services', 'Utilities and local services around Lake Wallenpaupack', 'Who to call around Lake Wallenpaupack: power outages, plumbers, electricians, septic and trash services, property managers, builders and emergency services.',
          '<h2>Power</h2><ul class="l">' + ''.join(f'<li><b>{e(u["n"])}</b><small><a href="{e(u["map"])}" rel="nofollow noopener">Live outage map</a> · <a href="{e(u["report"])}" rel="nofollow noopener">report an outage</a> · {e(u["phone"])}</small></li>' for u in _PW['utilities']) + '</ul>' +
          f'<p>{e(_SV["intro"])}</p>' + ''.join(f'<h2>{e(g["t"])}</h2>' + ('<p><b>In an emergency, call 911.</b></p>' if g['t'] == 'Emergency services' else '') + '<ul class="l">' + ''.join(_svi(i) for i in g['items']) + '</ul>' for g in _SV['groups']) + f'<p class="fine">{e(_SV["fine"])}</p>', '?services')
