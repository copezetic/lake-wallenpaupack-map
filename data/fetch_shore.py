"""A sharp shoreline for Lake Wallenpaupack from the USGS 3DEP lidar elevation service (public domain). In lidar terrain the lake
is flattened to one level, so the lake is simply the connected area at that level. Fetches the lake in 3 km blocks at 1.5 m,
keeps the flat area that overlaps the lake as OpenStreetMap maps it, and writes lake_shore.json (lat/lon outer ring and island
rings) for build.py. Blocks are cached in shore/."""
import json, os, time, urllib.request, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from shapely.geometry import box, Polygon
from shapely.ops import unary_union
SVC = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'
D = json.load(open('../docs/lake-data.json')); M = D['meta']
W = next(w for w in D['water'] if w.get('n') == 'Lake Wallenpaupack' and len(w['o']) > 500)
OLD = Polygon(W['o'], W['h']).buffer(0)
R, N = 1.5, 2000; os.makedirs('shore', exist_ok=True)
x0, z0, x1, z1 = OLD.bounds; x0 -= 200; z0 -= 200; x1 += 200; z1 += 200
nx, nz = int((x1 - x0) / R) + 1, int((z1 - z0) / R) + 1
mask = np.zeros((nz, nx), bool); guide = OLD.buffer(150)
for bi in range(0, nx, N):
    for bj in range(0, nz, N):
        w, h = min(N, nx - bi), min(N, nz - bj); bx = (x0 + bi * R, z0 + bj * R, x0 + (bi + w) * R, z0 + (bj + h) * R)
        if not guide.intersects(box(*bx)): continue
        f = f'shore/{bi}_{bj}.tif'
        if not os.path.exists(f):
            lon0, lon1 = M['lon0'] + bx[0] / M['kx'], M['lon0'] + bx[2] / M['kx']; lat1, lat0 = M['lat0'] - bx[1] / M['kz'], M['lat0'] - bx[3] / M['kz']
            u = f'{SVC}?bbox={lon0},{lat0},{lon1},{lat1}&bboxSR=4326&imageSR=4326&size={w},{h}&format=tiff&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image'
            for k in range(6):
                try:
                    d = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'lake-map-build/1.0'}), timeout=180).read()
                    if d[:2] in (b'II', b'MM'): open(f, 'wb').write(d); break
                    print('  not a tiff', bi, bj, d[:80])
                except Exception as e: print('  retry', bi, bj, str(e)[:60])
                time.sleep(10)
            time.sleep(2)
        t = Image.open(f); cut = h * (1 - M['kx'] / M['kz']) / 2        # the service widens the latitude range to make the request square in degrees
        a = np.asarray(t.resize((w, h), Image.BILINEAR, box=(0, cut, w, h - cut))).astype(np.float32)
        v, c = np.unique(np.round(a[(a > 300) & (a < 400)], 1), return_counts=True)
        # the lake level is the commonest height near 361 m (full pool is 1,187 ft); other flat ponds in the block sit at other heights
        ok = (v > 359.5) & (v < 362.5)
        if not ok.any(): continue
        lvs = [float(q) for q, n_ in zip(v[ok], c[ok]) if n_ > 0.004 * a.size]; flat = np.zeros(a.shape, bool)
        for lv in lvs: flat |= np.abs(a - lv) < 0.08
        print(bi, bj, 'levels', lvs, 'flat %.3f' % flat.mean(), flush=True)
        mask[bj:bj + h, bi:bi + w] = flat
lab, n = ndi.label(mask); sz = ndi.sum(mask, lab, range(1, n + 1)); big = int(np.argmax(sz)) + 1
lake = lab == big; print('lake area km2 %.2f' % (lake.sum() * R * R / 1e6), 'was %.2f' % (OLD.area / 1e6))
lake = ndi.binary_opening(ndi.binary_closing(lake, iterations=1), iterations=1)
boxes = []
for y in range(nz):
    dd = np.diff(np.concatenate(([0], lake[y].view(np.int8), [0]))); st = np.where(dd == 1)[0]; en = np.where(dd == -1)[0]
    boxes += [box(x0 + a_ * R, z0 + y * R, x0 + b_ * R, z0 + (y + 1) * R) for a_, b_ in zip(st, en)]
U = unary_union(boxes).buffer(2.2).buffer(-2.2).simplify(1.6)
g = max(U.geoms, key=lambda q: q.area) if hasattr(U, 'geoms') else U
ll = lambda r: [[round(M['lat0'] - z / M['kz'], 6), round(M['lon0'] + x / M['kx'], 6)] for x, z in r]
isl = [ll(r.coords) for r in g.interiors if Polygon(r).area > 150]
json.dump({'source': 'USGS 3DEP lidar elevation, lake surface', 'outer': ll(g.exterior.coords), 'islands': isl}, open('lake_shore.json', 'w'), separators=(',', ':'))
print('outer points', len(g.exterior.coords), 'islands', len(isl), 'shore km %.1f' % (g.exterior.length / 1000))
