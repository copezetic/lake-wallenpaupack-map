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
    overturemaps download --bbox=-75.445,41.250,-75.020,41.605 -f geojsonseq -t building -o buildings.geojsonl
    overturemaps download --bbox=-75.445,41.250,-75.020,41.605 -f geojsonseq -t place -o places_overture.geojsonl
    python build.py                          # writes docs/lake-data.json and docs/tiles/

Needs Python with `numpy`, `shapely`, `pillow` and `overturemaps`.

The detailed map runs from Promised Land State Park and the interstate in the south to Honesdale in the north
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

### Town guides, sponsors, homes, trails, boating and the tour (`docs/extras.js`)

- **Town guides**: the Towns chip (or `?town=honesdale|hawley|greentown`) lists every place in and around a town by category. A place counts if it is within the town's radius, or carries the town in its address and is within about twice that.
- **Sponsored places** (`docs/sponsors.json`): `poi` (a place id), `until` (last paid day) and optional `blurb`, `photo`, `photoCredit`, `url`. A sponsor not in the map data can be added with an `add` block (`name`, `cat`, `kind`, `lat`, `lon`). Sponsored pins are larger, always shown, listed first in their town guide, and always marked "Sponsored". Lapsed entries simply stop showing.
- **Homes and open houses** (`docs/listings.json`): `ag` (a current code in `agents.json`), `t`, `lat`, `lon`, optional `price`, `note`, `url`, `until`, and `open: [{d, time}]`. They show as pins on the main map and under an "Open houses" / "Homes for sale" chip.
- Entries marked `"demo": true` in either file show only when the address carries `?demo`, for showing a prospect what they would get.
- **Trails**: `python fetch_trails.py` pulls named footpaths and hiking routes from OpenStreetMap; the build writes them as `trails` and the viewer draws them dotted. The Trails chip lists them above `docs/outdoors.json` (hiking places, winter, ice), which is kept by hand with a source on each entry.
- **Boating** (`docs/boating.json`): speed and no-wake rules from 58 Pa. Code §§ 103.3 and 111.52, fuel docks (only marinas that say so on their own sites) and pump-outs. `bandFeet` draws the statewide 100-foot no-wake strip along the lake shore. No depth contours: no openly licensed survey was found (checked 2026-11-26).
- **Opening hours**: a place card says "Open now" or "Closed now" only when the map data has hours in a form the page understands (13 places on 2026-11-26).
- **Overview tour**: `?tour` hides the controls and plays a captioned fly-through (about 80 seconds) for screen recording. Add `&wx=clear&day` for fair daytime weather, `&loop` to repeat, `&wait=5` for a longer pause before it starts. The last card's wording is in `docs/tour.json`. Esc leaves the tour.

## Business pages, guides and the old map (added 2026-11-26)

- `docs/business.json` — wording for the For businesses page and the claim form. `contact.email` / `contact.form` / `contact.price` are what the public sees (empty = "Enquiries open soon"); `demo` is the placeholder shown with `?demo`; `counter.goatcounter` switches visitor counting on.
- `docs/card.html?p=<place id>&n=<name>` — printable 4×6 QR card for one place.
- `docs/access.json`, `docs/dine.json` — public access and dock-and-dine guides; every entry sourced.
- `docs/plans.json` — day plans, hidden until `approved` is true (`?plans=preview` to review).
- `docs/historic.jpg` + `historic.json` — the 1927–28 and 1935 USGS sheets warped onto the map by `data/build_historic.py` (source GeoTIFFs in `data/historic/`, not committed).
- `docs/sw.js`, `manifest.webmanifest`, `icon-*.png` — add-to-home-screen and a saved copy for weak signal (network first).
- Tour variants: `?tour=hawley` (one town), `?tour&biz=<place id>` (one business as a featured pin); upright windows stand further back. Record with `data/record_tour.mjs`.
- Guest links: `?host` lets a rental host drop a pin and copy a `?stay=lat,lon&t=name` link for guests (no account, nothing stored).
- `?embed[&p=<place id>]` — a stripped copy for a business's own site (iframe code is offered from the claim form and the For businesses page).
- `docs/weekend.html` — makes the "This weekend at the lake" picture from `events.json` (portrait, square or story); download and post.
- `docs/essentials.json` — hospital, pharmacy, groceries, gas, EV, ATMs, restrooms from OSM plus drive distances (OSRM); rebuild with `data/fetch_essentials.py`.
- `docs/tags.json` — owner-supplied tags (dog friendly, good for kids, open late) for the Find by… sheet; "On the lake" and "Arrive by boat" are worked out by the viewer.
- `docs/markers.json` — PHMC state historical markers (public domain, data.pa.gov xt8f-pzzz), shown in the History sheet with the 1928 map.
- `docs/parks.json` — closer looks. The animal park is hand-kept (`hand: true`); golf courses, marinas and campgrounds are rebuilt by `data/build_looks.py` from OSM.
- Sponsors can carry an `offer` {text, until}; the Boating sheet has a trip measurer (`?measure`).
- `docs/falls.json` — waterfalls: a pin plus an illustrated moving cascade along the creek line (`?falls` flies to it).
- `docs/links.json` — owners' own reservation and ordering links for food places; without one a card shows Call plus search links to OpenTable, DoorDash, Uber Eats and Grubhub. Interstates (ref "I nn") are drawn bolder and named by the viewer.

## Immersion (added 2026-11-26)

- `docs/immersive.js` — rides (`?ride=boat|507|6|train`), browser-made sound, the moving-water and cloud-shadow skin, house lights after dark, the Time & season sheet (`?hour=21.5`, `?season=fall|winter`), the dam wall and a few landmark buildings at their mapped height.
- `docs/rides.json` and `docs/patches.json` — built by `data/build_rides.py`: the lake's centreline, PA 507 and US 6 chained from the road data, the rail line and dam outline from OSM, and ~6 m elevation (Terrarium zoom 14) for the dam and the falls gorge. Rerun it after `build.py` whenever the area changes.
- Seasons repaint the ground, water and trees (`SEASONS` in `index.html`); the clock override lives in `sky.js` (`setClock`).

## Visitor tools (2026-11-27)

- The masthead groups Explore, Conditions and Map controls; search occupies a full row on phones. `docs/visitor.css` preserves the illustrated map style.
- `docs/discovery.js` searches names, categories, cuisines, towns, sourced tags and keywords. Browse results filter map pins; distances are explicitly straight-line from the map centre or a permitted location fix.
- `docs/visitor.js` saves up to 30 places in a named, ordered weekend in local browser storage. Shared `?trip=` links preview a collection without replacing the recipient's saved places. Import adds to their collection. No account or backend storage is used.
- Owner corrections and short visitor reports open an email addressed to `dewitt.hutchins@gmail.com`. The visitor must send it from their own mail app; opening the app is never represented as a submission.
- `docs/place-details.json` holds dated, field-specific source checks, access notes, closures, official gallery links and redirects for superseded listings. Both the interactive map and `data/build_seo.py` merge this over the base dataset, so rebuilding the terrain cannot discard the review work. Source checks are not site visits. Owner photography can use the existing `photo` / `photoCredit` fields; official gallery links avoid copying photographs without permission.
- `docs/beer-wine.json` defines seven sourced stops and three smaller outings. Open `?trail=beer-wine` (optional `&outing=hawley|lake|honesdale`) or `/guide/beer-wine-trail.html`. WallyMap's selection links to the official regional Pocono Beverage Trail and is not a passport or official affiliation.
- Reviewed `docs/plans.json` suggestions are now public. Family plans are explicitly seasonal. Any stop can be saved to a weekend.
- `?lite=1` selects lightweight mode (persisted when chosen from Map): lower rendering resolution, a 30 fps ceiling, no decorative wildlife, trees or immersive effects. Buildings, pins, search, routes and visitor tools remain. `?lite=0` restores full detail. Hidden pages skip the main render work.
- Save for offline explicitly downloads the map, all building tiles, guides and required Three.js modules. Progress reaches Ready only after every file succeeds. Weather, traffic, river gauges, mail, external websites and photo galleries require internet. Cached forecasts are labeled with their refresh time. Browser storage may be evicted; offline status is a browser download confirmation, not a guarantee of future storage retention.

After changing site files, run from `data/`:

    python3 build_seo.py
    python3 build_offline.py

`build_offline.py` hashes the final site and writes `docs/offline-manifest.json`. Re-run it after any site change. The download's local byte count excludes external Three.js files (about 1.3 MB). System fonts remain available when external font files are not cached.
