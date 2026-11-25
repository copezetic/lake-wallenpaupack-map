#!/usr/bin/env python3
"""Elevation grid for the lake area from Terrarium tiles (zoom 12, ~29 m/pixel) -> dem.npy + dem_meta.json"""
import io, json, math, urllib.request, numpy as np
from PIL import Image
Z = 12
a = json.load(open('area.json'))
def tx(lon): return (lon + 180) / 360 * 2 ** Z
def ty(lat): return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** Z
x0, x1, y0, y1 = tx(a['W']), tx(a['E']), ty(a['N']), ty(a['S'])
X0, X1, Y0, Y1 = int(x0), int(x1), int(y0), int(y1)
big = np.zeros(((Y1 - Y0 + 1) * 256, (X1 - X0 + 1) * 256), np.float32)
for X in range(X0, X1 + 1):
    for Yt in range(Y0, Y1 + 1):
        u = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{X}/{Yt}.png'
        im = np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(u, timeout=60).read())).convert('RGB')).astype(np.float32)
        big[(Yt - Y0) * 256:(Yt - Y0 + 1) * 256, (X - X0) * 256:(X - X0 + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
# resample the Mercator crop onto an even lat/lon grid
Wn, Hn = 620, int(round(620 * (a['N'] - a['S']) * 110574 / ((a['E'] - a['W']) * math.cos(math.radians((a['N'] + a['S']) / 2)) * 111320)))
lon = a['W'] + (np.arange(Wn) + .5) / Wn * (a['E'] - a['W']); lat = a['N'] - (np.arange(Hn) + .5) / Hn * (a['N'] - a['S'])
px = ((lon + 180) / 360 * 2 ** Z - X0) * 256; py = np.array([(ty(l) - Y0) * 256 for l in lat])
xi = np.clip(px.astype(int), 0, big.shape[1] - 2); yi = np.clip(py.astype(int), 0, big.shape[0] - 2); fx = px - xi; fy = (py - yi)[:, None]
g = (big[yi][:, xi] * (1 - fx) + big[yi][:, xi + 1] * fx) * (1 - fy) + (big[yi + 1][:, xi] * (1 - fx) + big[yi + 1][:, xi + 1] * fx) * fy
np.save('dem.npy', g.astype(np.float32)); json.dump({**a, 'w': Wn, 'h': Hn}, open('dem_meta.json', 'w'))
print('dem', g.shape, float(g.min()), float(g.max()))
