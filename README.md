# Lake Wallenpaupack — the whole lake in 3D

A 3D map of Lake Wallenpaupack (Pike and Wayne Counties, Pennsylvania) and everything
around it: every cove, road and community, with marinas, boat launches, places to eat
and stay. Early draft: the places come from public map data and have not been checked.

An independent project. Not an official publication of any community, association or
business shown.

## Layout

- `docs/` — the site (GitHub Pages serves this folder). `index.html` is the viewer;
  `lake-data.json` holds terrain, water, roads and places; `tiles/` holds building
  footprints, loaded tile by tile as you zoom in.
- `data/` — the build. `area.json` sets the rectangle the map covers.

## Rebuilding the data

    cd data
    python fetch_dem.py                      # terrain
    python fetch_osm.py                      # roads, water, places, piers
    overturemaps download --bbox=-75.342,41.345,-75.154,41.478 -f geojsonseq -t building -o buildings.geojsonl
    overturemaps download --bbox=-75.342,41.345,-75.154,41.478 -f geojsonseq -t place -o places_overture.geojsonl
    python build.py                          # writes docs/lake-data.json and docs/tiles/

Needs Python with `numpy`, `shapely`, `pillow` and `overturemaps`.

Corrections and additions go in `data/places.json` (same fields as a place in
`lake-data.json`, with `lat`/`lon`; `"drop": true` removes a place by id). Road-name
fixes go in `NAME_FIX` in `build.py`.

## Data

Map data © OpenStreetMap contributors (ODbL). Buildings: Overture Maps Foundation.
Terrain: USGS elevation data via Mapzen Terrarium tiles.
