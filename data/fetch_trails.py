#!/usr/bin/env python3
"""Fetch OpenStreetMap footpaths and trails for the map area -> osm_trails.json"""
import json, ovp
a = json.load(open('area.json')); bb = f"{a['S']},{a['W']},{a['N']},{a['E']}"
q = f'[out:json][timeout:200];(way["highway"~"^(path|footway|bridleway|cycleway)$"]["footway"!~"^(sidewalk|crossing)$"]["access"!~"^(private|no)$"]({bb});way["highway"="track"]["name"]["access"!~"^(private|no)$"]({bb});relation["route"~"^(hiking|foot|bicycle|snowmobile)$"]({bb}););out body;>;out skel qt;'
r = ovp.run(q); json.dump(r, open('osm_trails.json', 'w')); print('trails', len(r['elements']))
