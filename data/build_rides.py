"""Routes for the ride mode and finer ground for two spots -> ../docs/rides.json and ../docs/patches.json
 boat   the middle of Lake Wallenpaupack from the dam to Ledgedale: the path that stays furthest from shore (distance map + shortest path)
 drives numbered roads chained end to end from the map's own road data (PA 507 along the lake, US 6 Hawley to Honesdale)
 rail   the Stourbridge Line track and the dam's outline, from OpenStreetMap (kept from the last good fetch if the server is down)
 patches  ~5 m elevation (Terrarium zoom 14, USGS 3DEP) for small boxes, as heights above the map's lowest point, to sharpen the dam and the falls gorge"""
import json, math, heapq, io, base64, urllib.request, os, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
import ovp
D = json.load(open('../docs/lake-data.json')); M = D['meta']
ll = lambda x, z: [round(M['lat0'] - z / M['kz'], 6), round(M['lon0'] + x / M['kx'], 6)]
xz = lambda lat, lon: ((lon - M['lon0']) * M['kx'], -(lat - M['lat0']) * M['kz'])
out = json.load(open('../docs/rides.json')) if os.path.exists('../docs/rides.json') else {}

# ---- boat: centreline of the big lake
lake = max((w for w in D['water'] if w.get('n') == 'Lake Wallenpaupack'), key=lambda w: len(w['o']))
xs = [p[0] for p in lake['o']]; zs = [p[1] for p in lake['o']]; x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs); R = 25.0
Wp, Hp = int((x1 - x0) / R) + 3, int((z1 - z0) / R) + 3; im = Image.new('L', (Wp, Hp), 0); dr = ImageDraw.Draw(im)
px = lambda p: ((p[0] - x0) / R + 1, (p[1] - z0) / R + 1)
dr.polygon([px(p) for p in lake['o']], fill=1)
for h in lake['h']: dr.polygon([px(p) for p in h], fill=0)
mask = np.array(im, bool); dist = ndimage.distance_transform_edt(mask) * R
def cell(lat, lon):
    x, z = xz(lat, lon); c = (int(round((z - z0) / R + 1)), int(round((x - x0) / R + 1)))
    ys, xs_ = np.nonzero(mask); k = np.argmin((ys - c[0]) ** 2 + (xs_ - c[1]) ** 2); return (int(ys[k]), int(xs_[k]))
a, b = cell(41.4590, -75.1870), cell(41.3690, -75.3150)          # off the dam; the Ledgedale end
best = {a: 0.0}; prev = {}; pq = [(0.0, a)]
while pq:
    d, c = heapq.heappop(pq)
    if c == b: break
    if d > best.get(c, 1e18): continue
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            n = (c[0] + dy, c[1] + dx)
            if (dy or dx) and 0 <= n[0] < Hp and 0 <= n[1] < Wp and mask[n]:
                nd = d + math.hypot(dy, dx) * (1 + 900.0 / (dist[n] + 20) ** 1.2)
                if nd < best.get(n, 1e18): best[n] = nd; prev[n] = c; heapq.heappush(pq, (nd, n))
path = [b]
while path[-1] != a: path.append(prev[path[-1]])
path = path[::-1]; pts = np.array([[(c[1] - 1) * R + x0, (c[0] - 1) * R + z0] for c in path])
for _ in range(60): pts[1:-1] = (pts[:-2] + pts[1:-1] * 2 + pts[2:]) / 4          # smooth the staircase
pts = pts[::6]; out['boat'] = {'n': 'Down the lake by boat', 'p': [ll(*p) for p in pts]}
print('boat', len(pts), 'points', round(sum(math.hypot(*(pts[i] - pts[i-1])) for i in range(1, len(pts))) / 1609.34, 1), 'mi')

# ---- drives: chain the pieces of a numbered road
def chain(ref, start, end):
    segs = [r['p'] for r in D['roads'] if r.get('ref') == ref]; s = xz(*start); e = xz(*end)
    nodes = {}; 
    def key(p): return (round(p[0]), round(p[1]))
    adj = {}
    for sg in segs:
        for i in range(1, len(sg)):
            u, v = key(sg[i-1]), key(sg[i]); w = math.hypot(sg[i][0] - sg[i-1][0], sg[i][1] - sg[i-1][1]); adj.setdefault(u, []).append((v, w)); adj.setdefault(v, []).append((u, w))
    ks = list(adj); near = lambda q: min(ks, key=lambda k: (k[0] - q[0]) ** 2 + (k[1] - q[1]) ** 2)
    for u in ks:                                                    # bridge small gaps between pieces
        if len(adj[u]) == 1:
            c = min((k for k in ks if k != u and k != adj[u][0][0]), key=lambda k: (k[0] - u[0]) ** 2 + (k[1] - u[1]) ** 2); g = math.hypot(c[0] - u[0], c[1] - u[1])
            if g < 60: adj[u].append((c, g)); adj[c].append((u, g))
    A, B = near(s), near(e); best = {A: 0}; prev = {}; pq = [(0, A)]
    while pq:
        d, c = heapq.heappop(pq)
        if c == B: break
        if d > best.get(c, 1e18): continue
        for n, w in adj[c]:
            if d + w < best.get(n, 1e18): best[n] = d + w; prev[n] = c; heapq.heappush(pq, (d + w, n))
    if B not in prev: print('no chain for', ref); return None
    p = [B]
    while p[-1] != A: p.append(prev[p[-1]])
    p = p[::-1]; print(ref, len(p), 'points', round(best[B] / 1609.34, 1), 'mi'); return [ll(*q) for q in p]
drives = []
for id_, n, ref, s, e in [('507', 'Route 507 along the lake', 'PA 507', (41.4530, -75.1790), (41.3330, -75.3010)), ('6', 'Route 6, Hawley to Honesdale', 'US 6', (41.4760, -75.1820), (41.5740, -75.2550))]:
    p = chain(ref, s, e)
    if p: drives.append({'id': id_, 'n': n, 'p': p})
out['drives'] = drives

# ---- rail and the dam, from OpenStreetMap
try:
    A_ = json.load(open('area.json')); bb = f"{A_['S']},{A_['W']},{A_['N']},{A_['E']}"
    els = ovp.run(f'[out:json][timeout:90];(way["railway"="rail"]["service"!~"."]({bb});way["waterway"="dam"]({bb}););out geom tags;', tries=2)['elements']
    rails = [[(g['lat'], g['lon']) for g in e['geometry']] for e in els if e['tags'].get('railway') == 'rail']
    # join the pieces into the longest single run
    def K(p): return (round(p[0], 5), round(p[1], 5))
    adj = {}
    for r in rails:
        for i in range(1, len(r)):
            w = math.hypot((r[i][0] - r[i-1][0]) * 110574, (r[i][1] - r[i-1][1]) * 83400); adj.setdefault(K(r[i-1]), []).append((K(r[i]), w)); adj.setdefault(K(r[i]), []).append((K(r[i-1]), w))
    def far(src):
        best = {src: 0}; prev = {}; pq = [(0, src)]
        while pq:
            d, c = heapq.heappop(pq)
            if d > best[c]: continue
            for n, w in adj[c]:
                if d + w < best.get(n, 1e18): best[n] = d + w; prev[n] = c; heapq.heappush(pq, (d + w, n))
        t = max(best, key=best.get); return t, best[t], prev
    if adj:
        hon = min(adj, key=lambda k: (k[0] - 41.5750) ** 2 + (k[1] + 75.2560) ** 2)          # start from the Honesdale end
        t, dlen, prev = far(hon); p = [t]
        while p[-1] != hon: p.append(prev[p[-1]])
        out['rail'] = {'n': 'The Stourbridge Line', 'p': [[round(a, 6), round(b_, 6)] for a, b_ in p[::-1]]}; print('rail', len(p), 'points', round(dlen / 1609.34, 1), 'mi')
    dams = [e for e in els if e['tags'].get('waterway') == 'dam' and 'Wallenpaupack' in e['tags'].get('name', '')]
    if dams: out['dam'] = [[round(g['lat'], 6), round(g['lon'], 6)] for g in dams[0]['geometry']]; print('dam', len(out['dam']), 'points', dams[0]['tags'])
except SystemExit: print('map server down: rail and dam kept from before' if 'rail' in out else 'map server down: no rail or dam yet')
json.dump(out, open('../docs/rides.json', 'w'), separators=(',', ':'))

# ---- finer ground
Z = 14
def tx(lon): return (lon + 180) / 360 * 2 ** Z
def ty(lat): return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** Z
cache = {}
def tile(X, Y_):
    if (X, Y_) not in cache:
        im = np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{X}/{Y_}.png', timeout=60).read())).convert('RGB')).astype(np.float32)
        cache[(X, Y_)] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
    return cache[(X, Y_)]
def sample(lat, lon):
    fx, fy = tx(lon) * 256 - .5, ty(lat) * 256 - .5; i, j = int(math.floor(fx)), int(math.floor(fy)); a, b = fx - i, fy - j
    g = lambda ii, jj: tile(ii // 256, jj // 256)[jj % 256, ii % 256]
    return (g(i, j) * (1 - a) + g(i + 1, j) * a) * (1 - b) + (g(i, j + 1) * (1 - a) + g(i + 1, j + 1) * a) * b
patches = []
for id_, lat, lon, half in [('falls', 41.4721, -75.1712, 420), ('dam', 41.4600, -75.1850, 520)]:
    cx, cz = xz(lat, lon); step = 6.0; n = int(2 * half / step) + 1; h = np.zeros((n, n), np.float32)
    for j in range(n):
        for i in range(n):
            la, lo = ll(cx - half + i * step, cz - half + j * step); h[j, i] = sample(la, lo) - M['emin']
    patches.append({'id': id_, 'x0': round(cx - half, 1), 'z0': round(cz - half, 1), 'step': step, 'n': n, 'd': base64.b64encode(np.clip(h * 10, 0, 65535).astype('<u2').tobytes()).decode()})
    print('patch', id_, n, 'x', n, 'range', round(float(h.min()), 1), round(float(h.max()), 1))
json.dump({'patches': patches}, open('../docs/patches.json', 'w'), separators=(',', ':'))
