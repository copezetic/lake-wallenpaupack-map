"""Overpass helper: tries several servers, returns parsed JSON."""
import json, sys, time, urllib.request, urllib.parse
SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter',
           'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
def run(q, tries=3):
    for t in range(tries):
        for s in SERVERS:
            try:
                req = urllib.request.Request(s, data=urllib.parse.urlencode({'data': q}).encode(),
                                             headers={'User-Agent': 'lake-map-build/1.0'})
                return json.load(urllib.request.urlopen(req, timeout=100))
            except Exception as e:
                print('  overpass', s.split('/')[2], type(e).__name__, str(e)[:80], file=sys.stderr)
        time.sleep(10)
    raise SystemExit('overpass failed')
