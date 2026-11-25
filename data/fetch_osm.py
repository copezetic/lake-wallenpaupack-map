#!/usr/bin/env python3
"""Fetch OpenStreetMap roads, water and places for the lake area -> osm_*.json"""
import json, ovp
a = json.load(open('area.json')); bb = f"{a['S']},{a['W']},{a['N']},{a['E']}"
Q = {
 'roads': f'[out:json][timeout:200];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"]({bb});out body;>;out skel qt;',
 'water': f'[out:json][timeout:200];(relation["natural"="water"]({bb});way["natural"="water"]({bb});way["waterway"~"^(stream|river)$"]({bb});way["natural"~"^(beach|wetland)$"]({bb}););out body;>;out skel qt;',
 'places': [f'[out:json][timeout:90];({q});out center tags;' for q in [
   f'nwr["leisure"~"^(marina|slipway|park|nature_reserve|golf_course|beach_resort|swimming_area)$"]({bb});nwr["waterway"~"^(dam|boatyard)$"]({bb});nwr["boundary"~"^(protected_area|national_park)$"]({bb});',
   f'nwr["amenity"~"^(restaurant|bar|pub|cafe|fast_food|ice_cream|fuel|boat_rental|marketplace|library|post_office|pharmacy)$"]({bb});',
   f'nwr["tourism"]({bb});',
   f'nwr["shop"]({bb});',
   f'node["place"]({bb});nwr["landuse"="residential"]["name"]({bb});']],
 'piers': f'[out:json][timeout:200];way["man_made"="pier"]({bb});out body;>;out skel qt;',
}
import sys
for k, q in Q.items():
    if len(sys.argv) > 1 and k not in sys.argv[1:]: continue
    if isinstance(q, list):
        r = {'elements': []}
        for part in q: r['elements'] += ovp.run(part)['elements']; print(' ', k, len(r['elements']), flush=True)
    else: r = ovp.run(q)
    json.dump(r, open(f'osm_{k}.json', 'w')); print(k, len(r['elements']), flush=True)
