"""Marina closer looks from public aerial photography. For each marina in SITES, fetch a leaf-off aerial photo from PASDA
(Pennsylvania Spatial Data Access, public layer NAIP2022WEB), pick out the docks as the bright shapes standing in dark water, and
write them as lat/lon polygons to aerial/<id>.json with an overlay picture aerial/<id>_check.jpg to check by eye.
Nothing here is published by itself: build_marinas.py turns the checked traces into parks.json entries."""
import json, sys, os, urllib.request, numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from shapely.geometry import box, Polygon, MultiPolygon
from shapely.ops import unary_union
SVC = 'https://imagery.pasda.psu.edu/arcgis/rest/services/pasda/NAIP2022WEB/MapServer/export'
SITES = json.load(open('marina_sites.json'))
PX = 2000
def fetch(s):
    f = f"aerial/{s['id']}.jpg"
    lat, lon, h = s['lat'], s['lon'], s.get('half', 300)
    dla, dlo = h / 110574, h / (111320 * np.cos(np.radians(lat)))
    bb = (lon - dlo, lat - dla, lon + dlo, lat + dla)
    if not os.path.exists(f):
        u = f"{SVC}?bbox={bb[0]},{bb[1]},{bb[2]},{bb[3]}&bboxSR=4326&imageSR=4326&size={PX},{PX}&format=jpg&f=image"
        open(f, 'wb').write(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'lake-map-build/1.0'}), timeout=120).read())
    return f, bb
def trace(s):
    f, bb = fetch(s); im = Image.open(f).convert('RGB'); a = np.asarray(im).astype(np.float32)
    h = s.get('half', 300); m = 2 * h / PX                      # metres per pixel
    v = a.mean(2)
    wp = ((a[..., 2] > a[..., 0] - 6) & (v < s.get('dark', 105))).astype(np.float32)      # dark and not brown: water
    dens = ndi.uniform_filter(wp, int(s.get('win', 26) / m))
    reg = dens > s.get('dens', 0.42)
    lab, n = ndi.label(reg)
    if n == 0: return []
    sz = ndi.sum(reg, lab, range(1, n + 1)); closed = np.isin(lab, [i + 1 for i, q in enumerate(sz) if q * m * m > 6000])
    bright = (v > s.get('bright', 135)) & (a.max(2) - a.min(2) < 70)   # pale decking, not blue tarps
    cand = closed & bright
    if s.get('open'): cand = ndi.binary_opening(cand, iterations=s['open'])
    cand = ndi.binary_closing(cand, iterations=int(max(1, 0.6 / m)))
    cand = ndi.binary_opening(cand, iterations=1)
    lab, n = ndi.label(cand); out = np.zeros_like(cand)
    for i, sl in enumerate(ndi.find_objects(lab)):
        comp = lab[sl] == i + 1; area = comp.sum() * m * m
        hh, ww = comp.shape; ext = max(hh, ww) * m
        if area >= s.get('minA', 30) and ext >= s.get('minL', 12): out[sl] |= comp
    # pixels -> polygons
    boxes = []
    for y in range(PX):
        row = out[y]; d = np.diff(np.concatenate(([0], row.view(np.int8), [0]))); st = np.where(d == 1)[0]; en = np.where(d == -1)[0]
        boxes += [box(x0, y, x1, y + 1) for x0, x1 in zip(st, en)]
    polys = []
    if boxes:
        u = unary_union(boxes).buffer(0.8 / m).buffer(-0.5 / m).simplify(0.7 / m)
        for g in (u.geoms if isinstance(u, MultiPolygon) else [u]):
            if g.area * m * m < s.get('minA', 30): continue
            polys.append([[round(bb[3] - y / PX * (bb[3] - bb[1]), 6), round(bb[0] + x / PX * (bb[2] - bb[0]), 6)] for x, y in g.exterior.coords])
    ov = im.copy(); d = ImageDraw.Draw(ov)
    for p in polys:
        d.line([((lo - bb[0]) / (bb[2] - bb[0]) * PX, (bb[3] - la) / (bb[3] - bb[1]) * PX) for la, lo in p], fill=(255, 0, 255), width=2)
    for i in range(0, PX, 200):
        d.line([(i, 0), (i, PX)], fill=(255, 255, 0), width=1); d.line([(0, i), (PX, i)], fill=(255, 255, 0), width=1); d.text((i + 3, 3), str(i), fill=(255, 255, 0)); d.text((3, i + 3), str(i), fill=(255, 255, 0))
    ov.save(f"aerial/{s['id']}_check.jpg", quality=88)
    json.dump({'bbox': bb, 'docks': polys}, open(f"aerial/{s['id']}.json", 'w'))
    return polys
for s in SITES:
    if len(sys.argv) > 1 and s['id'] not in sys.argv[1:]: continue
    p = trace(s); print(s['id'], len(p), 'dock shapes', sum(len(q) for q in p), 'points')
