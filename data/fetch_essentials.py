"""Essentials (hospital, urgent care, pharmacy, groceries, fuel, EV charging, ATM/bank, public toilets) from OpenStreetMap, and
drive distances to the lake from nearby cities computed with the public OSRM router (OpenStreetMap roads, no traffic).
Writes ../docs/essentials.json. Nothing here is typed in by hand except the city centre points."""
import json, urllib.request, urllib.parse, datetime
A = json.load(open('area.json')); bb = f"{A['S']},{A['W']},{A['N']},{A['E']}"
GROUPS = [('Hospital and urgent care', ['nwr["amenity"="hospital"]', 'nwr["amenity"="clinic"]', 'nwr["healthcare"="urgent_care"]']),
          ('Pharmacy', ['nwr["amenity"="pharmacy"]']), ('Groceries', ['nwr["shop"="supermarket"]']), ('Gas', ['nwr["amenity"="fuel"]']),
          ('EV charging', ['nwr["amenity"="charging_station"]']), ('ATM and banks', ['nwr["amenity"="atm"]', 'nwr["amenity"="bank"]']),
          ('Public restrooms', ['nwr["amenity"="toilets"]["access"!="private"]["access"!="customers"]'])]
import time
def get(url, data=None, tries=5):
    for i in range(tries):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(url, data=data, headers={'User-Agent': 'lake-map-build/1.0'}), timeout=120))
        except Exception as e: print('retry', url[:40], e); time.sleep(8 * (i + 1))
    raise SystemExit('gave up on ' + url)
def overpass(q):
    for host in ('https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'):
        try: return get(host, urllib.parse.urlencode({'data': q}).encode(), 2)['elements']
        except SystemExit: pass
    raise SystemExit('overpass down')
import sys
out = []; ok = True
for title, sels in GROUPS:
    try: els = overpass('[out:json][timeout:90];(' + ''.join(f'{s}({bb});' for s in sels) + ');out center tags;')
    except SystemExit: ok = False; print('map server down: keeping any earlier essentials'); break
    items = []; seen = set()
    for e in els:
        t = e.get('tags', {}); lat = e.get('lat') or e.get('center', {}).get('lat'); lon = e.get('lon') or e.get('center', {}).get('lon')
        if lat is None: continue
        n = t.get('name') or t.get('brand') or t.get('operator') or ''
        key = (n, round(lat, 3), round(lon, 3))
        if key in seen: continue
        seen.add(key); it = {'n': n, 'lat': round(lat, 6), 'lon': round(lon, 6)}
        ad = ' '.join(x for x in [t.get('addr:housenumber'), t.get('addr:street')] if x); city = t.get('addr:city')
        if ad or city: it['a'] = ', '.join(x for x in [ad, city] if x)
        if t.get('opening_hours') == '24/7': it['h'] = 'Open 24 hours'
        if t.get('phone'): it['ph'] = t['phone']
        if t.get('emergency') == 'yes': it['er'] = True
        items.append(it)
    items.sort(key=lambda i: (i['n'] == '', i['n'])); out.append({'t': title, 'items': items}); print(title, len(items))
LAKE = (41.4640, -75.1830)   # the lake's visitors center on Route 6, by the dam
CITIES = [('New York City', 40.7580, -73.9855), ('Philadelphia', 39.9526, -75.1652), ('Scranton', 41.4090, -75.6624), ('Allentown', 40.6023, -75.4714), ('Newark, N.J.', 40.7357, -74.1724), ('Binghamton, N.Y.', 42.0987, -75.9180), ('Hartford, Conn.', 41.7658, -72.6734)]
here = []
for n, la, lo in CITIES:
    j = get(f'https://router.project-osrm.org/route/v1/driving/{lo},{la};{LAKE[1]},{LAKE[0]}?overview=false')
    r = j['routes'][0]; here.append({'n': n, 'mi': round(r['distance'] / 1609.34), 'min': round(r['duration'] / 60)}); print(here[-1])
import os
if not ok: out = json.load(open('../docs/essentials.json')).get('groups', []) if os.path.exists('../docs/essentials.json') else []
json.dump({'updated': datetime.date.today().isoformat(), 'groups': out, 'here': here}, open('../docs/essentials.json', 'w'), ensure_ascii=False, separators=(',', ':'))
