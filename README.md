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
    python fetch_dem.py                      # terrain for the detailed map
    python fetch_far.py                      # coarse terrain for the faded country beyond it
    python fetch_osm.py                      # roads, water, places, piers
    overturemaps download --bbox=-75.375,41.295,-75.150,41.605 -f geojsonseq -t building -o buildings.geojsonl
    overturemaps download --bbox=-75.375,41.295,-75.150,41.605 -f geojsonseq -t place -o places_overture.geojsonl
    python build.py                          # writes docs/lake-data.json and docs/tiles/

Needs Python with `numpy`, `shapely`, `pillow` and `overturemaps`.

The detailed map runs from Greentown and the interstate in the south to Honesdale in the north
(`area.json`; the `--bbox` above must match it). It has no edge: `fetch_far.py` pulls coarse
terrain for about 85 km around, and the viewer draws that as pale relief that fades into the
page. The build eases the detailed heights onto the coarse ones over the last 350 m so the two
meet without a step, and the painting pales over the last 800 m.

Corrections go in `data/places.json`, one entry per place id: `"drop": true` removes it,
`"patch": {...}` changes fields (name, kind, cat), and an entry with `lat`/`lon` adds a new
place. The build also merges doubles on its own (same words within a short walk) and folds
everything inside a resort into the resort's pin. Road-name fixes go in `NAME_FIX` in `build.py`.

Community and island names live in `data/communities.json`. Most were read from the Pike
County Office of Community Planning's 2012 map "Lake Wallenpaupack Developments and
Landmarks" and georeferenced against shared landmarks (about 100 m error); each sits where
the development meets the shore, not at its centre.

Community areas (used when a visitor picks one community to see on its own, or opens
`?c=indian-rocks`) come from `data/census_places.geojson` where the Census Bureau draws an
outline (five communities), and otherwise from the streets nearest the name, which is only a
rough guide. Names that sit inside another community's outline get no area of their own.

## Data

Map data © OpenStreetMap contributors (ODbL). Buildings: Overture Maps Foundation.
Terrain: USGS elevation data via Mapzen Terrarium tiles.
Community names: Pike County Office of Community Planning / LWWMD, 2012.
Community outlines: U.S. Census Bureau (TIGERweb, census designated places).

## Copyright

© 2026 DeWitt Hutchins. All rights reserved. See `LICENSE`. The code, design, models and
artwork are not open source; the map data keeps its own licences, listed above.

## Weather, seasons and events

`docs/sky.js` adds the live layer:

- **Weather**: the National Weather Service hourly forecast and alerts for the middle of the lake (no key needed). Rain, snow, clouds, fog, lightning and night shading follow it. Test with `?wx=snow|rain|storm|fog|cloudy|clear` and `?night=1`.
- **Fireworks**: after dark on July 4, or on the date of any event in `events.json` marked `"fx": "fireworks"`. Test with `?fx=fireworks`. The launch point is not published by the organiser; the spot in `events.json` is open water off the high school viewing area.
- **Santa**: all day December 24 and until 7 am on the 25th, circling the lake. Test with `?fx=santa`.
- **Events**: `docs/events.json`, kept by hand from the organisers' own pages. Each entry has a source link; events without an announced date carry `usual` and `last` instead of `d0`.

### Traffic, conditions and share links

- **Traffic** (off until the Traffic chip is tapped): TomTom raster flow tiles, masked to the main roads. The key sits at the top of `docs/sky.js`; it is locked to `copezetic.github.io` in the TomTom dashboard (checked 2026-11-25: other sites get 403), so a custom domain must be added to that whitelist.
- **Sun, moon and river** rows in the weather sheet: sun and moon are computed in the page; river temperature and flow come from U.S. Geological Survey gauges 01431500 (Hawley) and 01432055 (near Baoba, below the power plant).
- **Lake level is linked, not shown.** Brookfield's safewaters.com terms forbid automated copying and republishing, so the sheet only links there.
- **Share links**: `?p=<place id>` opens a place, `?c=<community-slug>` a community.

### Listing links for agents (subscription feature)

- A paying agent gets a code in `docs/agents.json` (`name`, `firm`, `phone`, `url`, `until` = last paid day).
- `?home=lat,lon&t=Label&ag=code` opens the map on that home with a "Home for sale" sheet: community, straight-line distance to the lake, nearest marina / launch / beach / groceries / restaurant / coffee / fuel / park by road, and the agent's card.
- `?ag=code&make=1` is the agent's tool: tap the spot, name it, copy the link.
- An unknown or expired code opens the plain map, so removing or dating an agent in `agents.json` turns their links off. `demo` is a sample agent.
- Nothing about a home is stored here; the position and label ride in the link.

### Fishing

`docs/fishing.json` drives the Fishing sheet (`docs/fishing.js`). Kept by hand from official sources; every entry should be traceable to the sources listed in the file. `?fishing` opens the sheet.
