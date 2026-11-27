"""Warp the two earliest USGS 15-minute sheets of the lake (Ariel, surveyed 1927-28; Hawley, 1935 edition) onto the map's own
latitude/longitude grid, as one picture the viewer can lay over the terrain. The sheets are Polyconic on NAD27 (Clarke 1866);
the forward projection is done here so no GIS library is needed. NAD27 -> WGS84 is a constant local shift, good to a few metres.
Sources: USGS Historical Topographic Map Collection GeoTIFFs in data/historic/. Output: docs/historic.jpg + bounds in docs/historic.json."""
import json, numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
Image.MAX_IMAGE_PIXELS = None
A = json.load(open('area.json'))
W, E, S, N = A['W'], A['E'], A['S'], 41.50            # the sheets end at 41.50 N
SHEETS = [('historic/PA_Ariel_461635_1928_62500_geo.tif', -75.375, (-13494.66625069886, 29836.161289139167), W, -75.25),
          ('historic/PA_Hawley_461757_1935_62500_geo.tif', -75.125, (-12609.73318177231, 29754.737792983164), -75.25, E)]
PIX, LAT0 = 5.291666666666667, 41.25
a, f = 6378206.4, 1 / 294.9786982139006; e2 = 2 * f - f * f
DLAT, DLON = 0.33 / 3600, 1.35 / 3600                 # NAD83 minus NAD27 here (east-positive longitude)
def M(p): return a * ((1 - e2/4 - 3*e2**2/64 - 5*e2**3/256) * p - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024) * np.sin(2*p) + (15*e2**2/256 + 45*e2**3/1024) * np.sin(4*p) - (35*e2**3/3072) * np.sin(6*p))
def poly(lat, lon, lon0):
    p, l = np.radians(lat), np.radians(lon - lon0); Nn = a / np.sqrt(1 - e2 * np.sin(p)**2); Ee = l * np.sin(p)
    return Nn / np.tan(p) * np.sin(Ee), M(p) - M(np.radians(LAT0)) + Nn / np.tan(p) * (1 - np.cos(Ee))
kx = 111320 * np.cos(np.radians((S + N) / 2)); RES = 7.0
w, h = int((E - W) * kx / RES), int((N - S) * 110574 / RES)
lon = W + (np.arange(w) + .5) / w * (E - W); lat = N - (np.arange(h) + .5) / h * (N - S)
LON, LAT = np.meshgrid(lon, lat); out = np.zeros((h, w, 3), np.uint8)
for path, lon0, (ox, oy), lw, le in SHEETS:
    im = np.asarray(Image.open(path).convert('RGB')); m = (LON >= lw) & (LON < le)
    x, y = poly(LAT[m] - DLAT, LON[m] - DLON, lon0); col, row = (x - ox) / PIX - .5, (oy - y) / PIX - .5
    for c in range(3): out[..., c][m] = map_coordinates(im[..., c], [row, col], order=1, mode='nearest')
Image.fromarray(out).save('../docs/historic.jpg', quality=76, optimize=True, progressive=True)
json.dump({'W': W, 'E': E, 'S': S, 'N': N, 'w': w, 'h': h}, open('../docs/historic.json', 'w'))
print(w, h)
