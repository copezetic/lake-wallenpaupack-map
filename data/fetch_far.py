#!/usr/bin/env python3
"""Coarse elevation for the country around the map (Terrarium tiles, zoom 9, ~230 m/pixel) -> far_dem.npy + far_meta.json
The viewer draws it as the faded ground that runs on past the edge of the detailed map."""
import io, json, math, urllib.request, numpy as np
from PIL import Image
Z = 9
a = json.load(open('area.json'))
PAD_LAT, PAD_LON = 0.78, 1.02            # how far past the map the faded ground runs, in degrees (about 85 km)
W, E, S, N = a['W'] - PAD_LON, a['E'] + PAD_LON, a['S'] - PAD_LAT, a['N'] + PAD_LAT
def tx(lon): return (lon + 180) / 360 * 2 ** Z
def ty(lat): return (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * 2 ** Z
X0, X1, Y0, Y1 = int(tx(W)), int(tx(E)), int(ty(N)), int(ty(S))
big = np.zeros(((Y1 - Y0 + 1) * 256, (X1 - X0 + 1) * 256), np.float32)
for X in range(X0, X1 + 1):
    for Yt in range(Y0, Y1 + 1):
        u = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{X}/{Yt}.png'
        im = np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(u, timeout=60).read())).convert('RGB')).astype(np.float32)
        big[(Yt - Y0) * 256:(Yt - Y0 + 1) * 256, (X - X0) * 256:(X - X0 + 1) * 256] = im[..., 0] * 256 + im[..., 1] + im[..., 2] / 256 - 32768
Wn = 640; Hn = int(round(Wn * (N - S) * 110574 / ((E - W) * math.cos(math.radians((N + S) / 2)) * 111320)))
lon = W + (np.arange(Wn) + .5) / Wn * (E - W); lat = N - (np.arange(Hn) + .5) / Hn * (N - S)
px = ((lon + 180) / 360 * 2 ** Z - X0) * 256; py = np.array([(ty(l) - Y0) * 256 for l in lat])
xi = np.clip(px.astype(int), 0, big.shape[1] - 2); yi = np.clip(py.astype(int), 0, big.shape[0] - 2); fx = px - xi; fy = (py - yi)[:, None]
g = (big[yi][:, xi] * (1 - fx) + big[yi][:, xi + 1] * fx) * (1 - fy) + (big[yi + 1][:, xi] * (1 - fx) + big[yi + 1][:, xi + 1] * fx) * fy
np.save('far_dem.npy', g.astype(np.float32)); json.dump({'W': W, 'S': S, 'E': E, 'N': N, 'w': Wn, 'h': Hn}, open('far_meta.json', 'w'))
print('far dem', g.shape, float(g.min()), float(g.max()))
