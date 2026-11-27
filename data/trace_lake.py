"""Every dock on the lake, from public aerial photography. Walks the shoreline of Lake Wallenpaupack in 600 m photo tiles (PASDA
layer NAIP2022WEB, leaf-off with the docks in), keeps the pale shapes that stand in the lake and reach the shore, and writes them
to aerial_docks.json and ../docs/docks.json as lat/lon polygons. Photos are cached in aerial/tiles/. `python trace_lake.py test` does three
sample tiles and writes check pictures; with no argument it does the whole shoreline."""
import json, sys, os, time, urllib.request, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from shapely.geometry import box, Polygon, MultiPolygon, Point
from shapely.ops import unary_union
from shapely import affinity
SVC = 'https://imagery.pasda.psu.edu/arcgis/rest/services/pasda/NAIP2022WEB/MapServer/export'
D = json.load(open('../docs/lake-data.json')); M = D['meta']
W = next(w for w in D['water'] if w.get('n') == 'Lake Wallenpaupack' and len(w['o']) > 500)
LAKE = Polygon(W['o'], W['h']).buffer(0)                     # map metres: x east, z south
PX, T, STEP = 2000, 600.0, 560.0; m = T / PX
os.makedirs('aerial/tiles', exist_ok=True)
def tiles():
    band = LAKE.boundary.buffer(110); x0, z0, x1, z1 = LAKE.bounds; out = []
    for i in range(int((x1 - x0) // STEP) + 2):
        for j in range(int((z1 - z0) // STEP) + 2):
            b = box(x0 - 60 + i * STEP, z0 - 60 + j * STEP, x0 - 60 + i * STEP + T, z0 - 60 + j * STEP + T)
            if band.intersects(b) and LAKE.intersects(b): out.append((i, j, b.bounds))
    return out
def photo(i, j, b):
    f = f'aerial/tiles/{i}_{j}.jpg'
    if not os.path.exists(f):
        lon0, lon1 = M['lon0'] + b[0] / M['kx'], M['lon0'] + b[2] / M['kx']; lat1, lat0 = M['lat0'] - b[1] / M['kz'], M['lat0'] - b[3] / M['kz']
        u = f'{SVC}?bbox={lon0},{lat0},{lon1},{lat1}&bboxSR=4326&imageSR=4326&size={PX},{PX}&format=jpg&f=image'
        for k in range(5):
            try:
                d = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'lake-map-build/1.0'}), timeout=120).read()
                if len(d) > 20000: open(f, 'wb').write(d); break
            except Exception as e: print('  retry', i, j, str(e)[:50])
            time.sleep(8)
        time.sleep(1.5)
    return f if os.path.exists(f) else None
def trace(i, j, b, check=False):
    f = photo(i, j, b)
    if not f: return None, 0
    im = Image.open(f).convert('RGB')
    # the service widens the latitude range until the request is square in degrees: the tile we asked for is the middle kx/kz of the rows
    cut = PX * (1 - M['kx'] / M['kz']) / 2; im = im.resize((PX, PX), Image.BICUBIC, box=(0, cut, PX, PX - cut)); a = np.asarray(im).astype(np.float32)
    mk = Image.new('L', (PX, PX), 0); d = ImageDraw.Draw(mk); P = lambda r: [((x - b[0]) / m, (z - b[1]) / m) for x, z in r]
    cl = LAKE.intersection(box(*b).buffer(5))
    for g in (cl.geoms if hasattr(cl, 'geoms') else [cl]):
        if g.geom_type != 'Polygon': continue
        d.polygon(P(g.exterior.coords), fill=1)
        for h in g.interiors: d.polygon(P(h.coords), fill=0)
    rough = ndi.binary_dilation(np.asarray(mk)[::8, ::8] > 0, iterations=int(70 / m / 8))        # the mapped outline is coarse: only a guide
    rough = np.kron(rough, np.ones((8, 8), bool))[:PX, :PX]
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    wet = ((B >= R - 4) & (B >= G - 8)).astype(np.float32)        # blue or neutral: water, foam, decking. Bare woods and grass are not
    reg = (ndi.uniform_filter(wet, int(30 / m)) > 0.62) & rough
    lab, n = ndi.label(reg)
    if n == 0: return None, 0
    sz = ndi.sum(reg, lab, range(1, n + 1)); lake = np.isin(lab, [k + 1 for k, q in enumerate(sz) if q * m * m > 8000])
    shore = ndi.distance_transform_edt(lake) * m               # metres in from the water's edge
    v = a.mean(2); pale = (v > 150) & (a.max(2) - a.min(2) < 70)
    far = shore > 60; noise = float(pale[far].mean()) if far.sum() > 5000 else float(pale[shore > 25].mean()) if (shore > 25).sum() > 5000 else 0
    choppy = noise > 0.012
    cand = pale & lake
    if choppy: cand = ndi.binary_opening(cand, iterations=1)
    cand = ndi.binary_closing(cand, iterations=2); cand = ndi.binary_opening(cand, iterations=1)
    lab, n = ndi.label(cand); out = np.zeros_like(cand)
    for k, sl in enumerate(ndi.find_objects(lab)):
        comp = lab[sl] == k + 1; area = comp.sum() * m * m; ext = max(comp.shape) * m; near = shore[sl][comp].min(); deep = shore[sl][comp].max()
        if area >= (25 if choppy else 10) and ext >= (10 if choppy else 5) and near < 14 and (9 if choppy else 6) < deep < 170: out[sl] |= comp
    boxes = []
    for y in range(PX):
        dd = np.diff(np.concatenate(([0], out[y].view(np.int8), [0]))); st = np.where(dd == 1)[0]; en = np.where(dd == -1)[0]
        boxes += [box(x0, y, x1, y + 1) for x0, x1 in zip(st, en)]
    geom = None
    if boxes: geom = affinity.translate(affinity.scale(unary_union(boxes), m, m, origin=(0, 0)), b[0], b[1])
    if check:
        ov = im.copy(); dr = ImageDraw.Draw(ov)
        if geom is not None:
            for g in (geom.geoms if hasattr(geom, 'geoms') else [geom]): dr.line(P(g.exterior.coords), fill=(255, 0, 255), width=2)
        ov.resize((1000, 1000)).save(f'aerial/tiles/{i}_{j}_check.jpg', quality=78)
    return geom, noise
TL = tiles(); print(len(TL), 'tiles')
if len(sys.argv) > 1 and sys.argv[1] == 'test':
    for la, lo in ((41.3812, -75.2470), (41.3712, -75.2575), (41.4388, -75.1760)):
        x, z = (lo - M['lon0']) * M['kx'], -(la - M['lat0']) * M['kz']
        i, j, b = next(t for t in TL if t[2][0] < x < t[2][2] and t[2][1] < z < t[2][3])
        g, nz = trace(i, j, b, True); print(i, j, 'noise %.4f' % nz, 0 if g is None else len(getattr(g, 'geoms', [g])))
    sys.exit()
parts, chop = [], 0
for n_, (i, j, b) in enumerate(TL):
    g, nz = trace(i, j, b, n_ % 12 == 0)
    if nz > 0.012: chop += 1
    if g is not None: parts.append(g)
    if n_ % 20 == 0: print(n_, '/', len(TL), flush=True)
U = unary_union(parts).buffer(0.5).buffer(-0.3).simplify(0.45)
out = []
for g in (U.geoms if hasattr(U, 'geoms') else [U]):
    if g.area < 10: continue
    mr = g.minimum_rotated_rectangle.exterior.coords; short = min(Point(mr[0]).distance(Point(mr[1])), Point(mr[1]).distance(Point(mr[2])))
    if g.area > 1500 or (short > 9 and g.area / g.convex_hull.area > 0.7): continue      # glare, beaches and roofs are big solid blobs; docks are thin or comb-shaped
    out.append([[round(x, 1), round(z, 1)] for x, z in g.exterior.coords])
ll = [[[round(M['lat0'] - z / M['kz'], 6), round(M['lon0'] + x / M['kx'], 6)] for x, z in r] for r in out]
json.dump({'source': 'PASDA NAIP2022WEB aerial photography', 'tiles': len(TL), 'choppy_tiles': chop, 'docks': ll}, open('aerial_docks.json', 'w'), separators=(',', ':'))
print('docks', len(out), 'points', sum(len(r) for r in out), 'choppy tiles', chop)
json.dump({'_note': 'Docks traced from public aerial photography (PASDA layer NAIP2022WEB) by data/trace_lake.py. lat/lon rings.', 'docks': ll}, open('../docs/docks.json', 'w'), separators=(',', ':'))
