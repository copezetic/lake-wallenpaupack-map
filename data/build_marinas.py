"""Marina closer looks. Takes the dock shapes trace_docks.py pulled from public aerial photos (aerial/<id>.json), keeps the ones in
each marina's dock zone, adds the hand-drawn boat yards from MARINAS below (pixel positions read off the 2000 px check pictures) and
writes hand-kept entries into ../docs/parks.json. Run trace_docks.py first."""
import json, math, datetime
from shapely.geometry import Polygon, LineString, MultiPoint, Point
D = json.load(open('../docs/lake-data.json')); POI = {p['id']: p for p in D['pois']}
SITES = {s['id']: s for s in json.load(open('marina_sites.json'))}
def sc(k, pts): return [(x * k, y * k) for x, y in pts]
A, B, C, E_ = 2000 / 1300, 2000 / 1200, 2000 / 1000, 2000 / 1932
MARINAS = {
 'lighthouse-harbor-marina': dict(zone=sc(A, [(320, 420), (890, 910)]), yards=[sc(A, [(650, 560), (865, 560), (870, 690), (960, 740), (950, 800), (830, 815), (700, 890), (640, 860), (650, 700)])]),
 'pine-crest-marina': dict(zone=[(0, 0), (2000, 2000)], yards=[sc(A, [(690, 600), (900, 640), (910, 830), (700, 830)])],
    spines=[[(70, 715), (125, 915)], [(183, 700), (245, 870)], [(318, 668), (358, 870)], [(455, 655), (462, 845)], [(570, 652), (580, 840)], [(690, 652), (693, 842)],
            [(832, 678), (805, 862)], [(965, 728), (918, 885)], [(1160, 722), (1145, 920)], [(1205, 915), (1360, 997)]], note='Pine Crest and New Wave Marina share this address.'),
 'pirates-cove-marina': dict(zone=sc(E_, [(200, 480), (680, 1000)]), yards=[sc(E_, [(930, 880), (1180, 850), (1400, 900), (1380, 1010), (1300, 1100), (960, 1030)])]),
 'seeleys-marina': dict(zone=sc(B, [(280, 60), (680, 270)]), yards=[sc(B, [(590, 470), (700, 430), (860, 500), (850, 590), (600, 600)])]),
 'the-boat-shop': dict(zone=sc(B, [(360, 380), (740, 560)]), yards=[sc(B, [(520, 530), (700, 500), (800, 600), (800, 700), (600, 680), (520, 600)])]),
 '1st-klas-marina': dict(zone=sc(C, [(190, 280), (410, 490)]), yards=[sc(C, [(350, 440), (520, 390), (660, 400), (600, 460), (480, 560), (360, 520)]), sc(C, [(500, 560), (700, 480), (780, 520), (700, 660), (580, 680)])]),
 'walts-landing': dict(zone=sc(C, [(330, 570), (440, 750)]), yards=[]),
 'driftwood-cove-marina': dict(zone=sc(C, [(330, 500), (700, 760)]), yards=[sc(C, [(300, 200), (520, 180), (560, 480), (480, 580), (340, 580), (300, 400)])], note='Driftwood Cove and Sterling Marina sit side by side here; the photo does not show where one ends and the other begins.'),
}
PK = json.load(open('../docs/parks.json')); PK['parks'] = [p for p in PK['parks'] if p['id'] not in MARINAS]
for mid, m in MARINAS.items():
    s = SITES[mid]; t = json.load(open(f'aerial/{mid}.json')); bb = t['bbox']; poi = POI[s['poi']]
    mpp = 2 * s.get('half', 300) / 2000
    ll = lambda x, y: [round(bb[3] - y / 2000 * (bb[3] - bb[1]), 6), round(bb[0] + x / 2000 * (bb[2] - bb[0]), 6)]
    px = lambda la, lo: ((lo - bb[0]) / (bb[2] - bb[0]) * 2000, (bb[3] - la) / (bb[3] - bb[1]) * 2000)
    (x0, y0), (x1, y1) = m['zone']; docks = []
    for d in t['docks']:
        q = [px(*p) for p in d]; c = Polygon(q).centroid
        if x0 <= c.x <= x1 and y0 <= c.y <= y1: docks.append(q)
    for sp in m.get('spines', []): docks.append(list(LineString(sp).buffer(4.5 / mpp, cap_style=2).exterior.coords))
    if not docks: print('NO DOCKS', mid); continue
    yards = m['yards']; pp = px(poi['dlat'], poi['dlon'])
    hull = MultiPoint([p for r in docks + yards for p in r] + [pp]).convex_hull.buffer(25 / mpp).simplify(4 / mpp)
    dc = MultiPoint([p for r in docks for p in r]).centroid
    pts = [{'n': 'Docks', 'll': ll(dc.x, dc.y)}] + [{'n': 'Boat yard', 'll': ll(*Polygon(y).centroid.coords[0])} for y in yards]
    PK['parks'].append({'id': mid, 'poi': s['poi'], 'kick': 'A closer look', 'url': poi.get('url', ''),
        'lines': ['The docks' + (' and boat yard' if yards else '') + ' are traced from a public aerial photograph. Floating docks get moved and added to, so this shows the layout, not a slip plan.'] + ([m['note']] if m.get('note') else []),
        'fine': 'Traced from public aerial photography served by Pennsylvania Spatial Data Access (layer NAIP 2022). Neighbouring private docks may be included and some of the marina\'s may be missing. An independent map, not affiliated with this place.',
        'updated': str(datetime.date.today()), 'viewD': 520, 'labelD': 1500, 'water': True, 'button': 'See the docks', 'hand': True, 'aerial': True,
        'boundary': [ll(x, y) for x, y in hull.exterior.coords], 'docks': [[ll(x, y) for x, y in d] for d in docks], 'parking': [[ll(x, y) for x, y in y_] for y_ in yards], 'pts': pts})
    print(mid, len(docks), 'docks', len(yards), 'yards')
json.dump(PK, open('../docs/parks.json', 'w'), separators=(',', ':'))
