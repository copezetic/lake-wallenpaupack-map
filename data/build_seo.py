"""Search pages. The map itself is a canvas a search engine cannot read, so this writes plain pages from the same data: one per
place (docs/place/), a set of guides (docs/guide/), sitemap.xml and robots.txt. Nothing is written that is not already in the
map's data files. Run after build.py and whenever the guide JSON files change."""
import json, re, os, html, math, datetime, glob
SITE = 'https://wallymap.com'; TODAY = str(datetime.date.today())
D = json.load(open('../docs/lake-data.json')); M = D['meta']; POIS = D['pois']
DETAILS = json.load(open('../docs/place-details.json')) if os.path.exists('../docs/place-details.json') else {}
POIS = [p for p in POIS if p['id'] not in DETAILS.get('redirects', {})]
for p in POIS:
    detail = DETAILS.get('places', {}).get(p['id'], {})
    facts = dict(p.get('facts', []))
    for k, v in detail.get('facts', {}).items():
        if v is None: facts.pop(k, None)
        else: facts[k] = v
    p.update(detail); p['facts'] = list(facts.items())
J = lambda f: json.load(open(f'../docs/{f}.json'))
e = lambda s: html.escape(str(s), quote=True)
CSS = """:root{--bg:#f1eadb;--ink:#22313a;--mut:#5d6a6c;--line:#cfc4aa;--card:#f8f3e7;--acc:#7a3b2e;--navy:#1d2f3d}
@media (prefers-color-scheme:dark){:root{--bg:#16202a;--ink:#e9e2d0;--mut:#a9b1ad;--line:#33424f;--card:#1d2a36;--acc:#e0a57f;--navy:#e9e2d0}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 'Cormorant Garamond',Georgia,serif}
main{max-width:760px;margin:0 auto;padding:22px 16px 60px}a{color:var(--acc)}h1{font-size:34px;line-height:1.15;margin:.3em 0 .2em}h2{font-size:23px;margin:1.5em 0 .3em;border-bottom:1px solid var(--line);padding-bottom:4px}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;font-variant:small-caps;letter-spacing:.08em;font-size:15px}.top a{text-decoration:none}
.kick{color:var(--mut);font-variant:small-caps;letter-spacing:.1em;font-size:15px}.btn{display:inline-block;background:var(--navy);color:var(--bg);padding:9px 16px;text-decoration:none;font-variant:small-caps;letter-spacing:.1em;margin:10px 8px 4px 0}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;background:var(--card);border:1px solid var(--line);padding:12px 14px;margin:14px 0}dt{color:var(--mut)}dd{margin:0;overflow-wrap:anywhere}
ul.l{list-style:none;padding:0;margin:0}ul.l li{padding:9px 0;border-bottom:1px solid var(--line)}ul.l small{color:var(--mut);display:block}
.fine{color:var(--mut);font-size:14.5px;margin-top:26px}nav.g{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0}"""
GUIDES = []   # (slug, title) filled as pages are written
def page(path, title, desc, body, ld=None, kick='Lake Wallenpaupack'):
    nav = ''.join(f'<a href="/guide/{s}.html">{e(t)}</a>' for s, t in NAV)
    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title><meta name="description" content="{e(desc[:158])}"><link rel="canonical" href="{SITE}/{path}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc[:158])}"><meta property="og:image" content="{SITE}/og.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:site_name" content="WallyMap"><meta name="twitter:image" content="{SITE}/og.jpg"><meta property="og:url" content="{SITE}/{path}"><meta property="og:type" content="article"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any"><link rel="icon" type="image/svg+xml" href="/logo.svg"><link rel="apple-touch-icon" href="/icon-180.png"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;700&display=swap" rel="stylesheet">
<style>{CSS}</style>{'<script type="application/ld+json">' + json.dumps(ld).replace('</', '<\\/') + '</script>' if ld else ''}</head>
<body><main><div class="top"><a href="/">WallyMap · the whole lake in 3D</a><a href="/guide/">All guides</a></div>
<div class="kick">{e(kick)}</div>{body}
<h2>More guides</h2><nav class="g">{nav}</nav>
<p class="fine">An independent map of Lake Wallenpaupack, not affiliated with the places shown. Details come from the sources named and can be out of date: check with the place before you go. Page built {TODAY}.</p></main></body></html>"""
    os.makedirs(os.path.dirname('../docs/' + path), exist_ok=True); open('../docs/' + path, 'w').write(doc); URLS.append(path)
URLS = []
# ---- place pages
PCAT = {'water': 'On the water', 'food': 'Food and drink', 'stay': 'Places to stay', 'nature': 'Things to do'}
def town(p):
    for k, v in p.get('facts', []):
        if k == 'Address' and ',' in v: return v.rsplit(',', 1)[1].strip()
    return ''
slugs = {}
def slug(p):
    s = re.sub(r'[^a-z0-9]+', '-', p['name'].lower().replace('&', 'and').replace("'", '')).strip('-')[:60] or 'place'
    t = re.sub(r'[^a-z0-9]+', '-', town(p).lower()).strip('-')
    if s in slugs.values() and t: s = f'{s}-{t}'
    k = s; n = 2
    while k in slugs.values(): k = f'{s}-{n}'; n += 1
    slugs[p['id']] = k; return k
PAGED = [p for p in sorted(POIS, key=lambda p: p['name']) if p['cat'] in PCAT and p.get('facts') and p['name'] not in ('Marina', 'Boat launch', 'Beach')]
for p in PAGED: slug(p)
plink = lambda pid, name=None: (f'<a href="/place/{slugs[pid]}.html">{e(name or BY[pid]["name"])}</a>' if pid in slugs else e(name or ''))
BY = {p['id']: p for p in POIS}
NAV = [('marinas', 'Marinas'), ('public-access', 'Public beaches and boat launches'), ('dock-and-dine', 'Dock and dine'), ('restaurants', 'Restaurants and bars'),
       ('places-to-stay', 'Places to stay'), ('things-to-do', 'Things to do'), ('hiking-and-outdoors', 'Hiking and outdoors'), ('fishing', 'Fishing'), ('boating-rules', 'Boating rules'),
       ('history', 'History'), ('events', 'Events'), ('beer-wine-trail', 'Beer and wine trail')]
if os.path.exists('../docs/market.json'): NAV.append(('real-estate', 'Real estate market'))
PARKS = {p['poi']: p for p in J('parks')['parks']}
for p in PAGED:
    f = dict(p.get('facts', [])); tw = town(p); near = sorted((q for q in PAGED if q is not p), key=lambda q: math.hypot(q['x'] - p['x'], q['z'] - p['z']))[:6]
    desc = f"{p['name']}: {p['kind'].lower()}{' in ' + tw if tw else ''} near Lake Wallenpaupack. " + ' '.join(f'{k}: {v}.' for k, v in p['facts'][:3]) + ' See it on the 3D lake map.'
    rows = ''.join(f'<dt>{e(k)}</dt><dd>{e(v)}</dd>' for k, v in p['facts'])
    if p.get('url'): rows += f'<dt>Website</dt><dd><a href="{e(p["url"])}" rel="nofollow noopener">{e(re.sub(r"^https?://(www\.)?", "", p["url"]).rstrip("/"))}</a></dd>'
    if p.get('sources'): rows += '<dt>Source check</dt><dd>' + e(p.get('checked','')) + ' · ' + ', '.join(f'<a href="{e(v["url"])}">{e(v["name"])}</a>' for v in p['sources']) + '</dd>'
    pk = PARKS.get(p['id'])
    body = f"""<h1>{e(p['name'])}</h1><p>{e(p['kind'])}{' in ' + e(tw) if tw else ''}, on the map of Lake Wallenpaupack.</p>
<a class="btn" href="/?p={e(p['id'])}">See it on the 3D map</a>{f'<a class="btn" href="/?park={e(pk["id"])}">{e(pk.get("button", "A closer look"))}</a>' if pk else ''}
<p>{e(p.get('blurb',''))}</p>{('<p><strong>' + e(p['notice']) + '</strong></p>') if p.get('notice') else ''}<dl>{rows}</dl>{''.join(f'<p>{e(l)}</p>' for l in (pk or {}).get('lines', []))}
<h2>Nearby</h2><ul class="l">{''.join(f'<li>{plink(q["id"])}<small>{e(q["kind"])} · {math.hypot(q["x"] - p["x"], q["z"] - p["z"]) / 1609.34:.1f} mi</small></li>' for q in near)}</ul>
<p class="fine">Base map details come from OpenStreetMap and Overture Maps; reviewed additions cite their sources above. Run this place? <a href="/?p={e(p['id'])}">Open it on the map</a> and choose “Claim or correct it”.</p>"""
    ld = {'@context': 'https://schema.org', '@type': {'food': 'FoodEstablishment', 'stay': 'LodgingBusiness'}.get(p['cat'], 'Place'), 'name': p['name'], 'url': f'{SITE}/place/{slugs[p["id"]]}.html',
          'geo': {'@type': 'GeoCoordinates', 'latitude': p['dlat'], 'longitude': p['dlon']}}
    if f.get('Address'): ld['address'] = f['Address'] + ', PA'
    if f.get('Phone'): ld['telephone'] = f['Phone']
    if p.get('url'): ld['sameAs'] = p['url']
    page(f'place/{slugs[p["id"]]}.html', f"{p['name']}{' · ' + tw if tw else ''} | Lake Wallenpaupack map", desc, body, ld, PCAT[p['cat']])
# ---- guides
def listing(ps): return '<ul class="l">' + ''.join(f'<li>{plink(p["id"])}<small>{e(p["kind"])}{" · " + e(dict(p["facts"]).get("Address", "")) if dict(p["facts"]).get("Address") else ""}</small></li>' for p in ps) + '</ul>'
def srcs(d): return ('<p class="fine">Sources: ' + ', '.join(f'<a href="{e(s["url"])}" rel="nofollow noopener">{e(s["n"])}</a>' for s in d.get('sources', [])) + f'. Checked {e(d.get("updated", ""))}.</p>') if d.get('sources') else ''
def sections(d):
    o = ''
    for s in d['sections']:
        o += f'<h2>{e(s["title"])}</h2>' + (f'<p>{e(s["text"])}</p>' if s.get('text') else '')
        o += '<ul class="l">' + ''.join(f'<li>{plink(i["poi"], i["n"]) if i.get("poi") in slugs else (f"""<a href="{e(i["url"])}" rel="nofollow noopener">{e(i["n"])}</a>""" if i.get("url") else "<b>" + e(i["n"]) + "</b>")}<small>{e(i.get("note", ""))}</small></li>' for i in s.get('items', [])) + '</ul>'
    return o
def guide(sl, title, desc, body, mapq=''):
    page(f'guide/{sl}.html', f'{title} | Lake Wallenpaupack map', desc, f'<h1>{e(title)}</h1><p>{e(desc)}</p><a class="btn" href="/{mapq}">Open the 3D map</a>{body}', kick='Guide')
cat = lambda c, kinds=None: [p for p in PAGED if p['cat'] == c and (kinds is None or p['kind'] in kinds)]
guide('marinas', 'Marinas on Lake Wallenpaupack', 'Every marina on Lake Wallenpaupack with its address, phone and website, and a traced layout of its docks on the 3D map.', listing(cat('water', ('Marina',))))
d = J('access'); guide('public-access', 'Public beaches and boat launches on Lake Wallenpaupack', d['intro'], sections(d) + f'<p class="fine">{e(d["fine"])}</p>' + srcs(d))
d = J('dine'); guide('dock-and-dine', 'Dock and dine on Lake Wallenpaupack', d['intro'], sections(d) + f'<p class="fine">{e(d["fine"])}</p>' + srcs(d))
guide('restaurants', 'Restaurants and bars around Lake Wallenpaupack', f'{len(cat("food"))} places to eat and drink around the lake, in Hawley, Honesdale, Greentown, Lake Ariel and along Route 507 and Route 6.', listing(cat('food')))
guide('places-to-stay', 'Places to stay near Lake Wallenpaupack', f'{len(cat("stay"))} hotels, inns, lodges, cabins and campgrounds around Lake Wallenpaupack, each placed on the 3D map.', listing(cat('stay')))
guide('things-to-do', 'Things to do around Lake Wallenpaupack', 'Parks, golf courses, museums, galleries, farms and historic sites around the lake.', listing(cat('nature')))
d = J('outdoors'); guide('hiking-and-outdoors', 'Hiking and the outdoors at Lake Wallenpaupack', 'Where to hike and get outside around Lake Wallenpaupack, from the organisations that look after each place.', sections(d) + f'<p class="fine">{e(d["fine"])}</p>' + srcs(d))
d = J('fishing'); guide('fishing', 'Fishing Lake Wallenpaupack', d['intro'], sections(d) + f'<p class="fine">{e(d["fine"])}</p>' + srcs(d))
d = J('boating'); guide('boating-rules', 'Boating rules on Lake Wallenpaupack', d['intro'], sections(d) + f'<p class="fine">{e(d["fine"])}</p>' + srcs(d))
d = J('markers'); guide('history', 'History around Lake Wallenpaupack', 'State historical markers around the lake and its towns, and a 1928 survey map you can lay over the modern one.',
    '<h2>State historical markers</h2><ul class="l">' + ''.join(f'<li><b>{e(m["n"])}</b><small>Marker dedicated {e(m["year"])}</small></li>' for m in d['markers']) + '</ul><p class="fine">Marker names and years are from the Pennsylvania Historical and Museum Commission dataset on data.pa.gov.</p>', '?history')
d = J('events'); ev = sorted((x for x in d['events'] if x.get('d0', '') >= TODAY), key=lambda x: x['d0'])
guide('events', 'Events around Lake Wallenpaupack', 'Upcoming events in Hawley, Honesdale and around the lake, each linked to its organiser.',
    '<ul class="l">' + ''.join(f'<li>{f"""<a href="{e(x["url"])}" rel="nofollow noopener">{e(x["n"])}</a>""" if x.get("url") else "<b>" + e(x["n"]) + "</b>"}<small>{e(datetime.date.fromisoformat(x["d0"]).strftime("%A, %B %-d, %Y"))}{" · " + e(x["where"]) if x.get("where") else ""}{". " + e(x["note"]) if x.get("note") else ""}</small></li>' for x in ev) + f'</ul><p class="fine">Dates come from the organisers\' own listings, checked {e(d["updated"])}. Confirm before you travel.</p>')
d = J('beer-wine')
body = ''.join('<h2>' + e(o['title']) + '</h2><p>' + e(o['note']) + '</p><ul class="l">' + ''.join('<li>' + plink(pid) + '<small>' + e(next(t['note'] for t in d['stops'] if t['poi']==pid)) + '</small><a href="' + e(next(t['url'] for t in d['stops'] if t['poi']==pid)) + '">Official site and current hours</a></li>' for pid in o['stops']) + '</ul>' for o in d['outings'])
body += '<p>' + e(d['transport']) + '</p><p class="fine">Sources checked ' + e(d['updated']) + '. Independent WallyMap selection. <a href="' + e(d['regional']['url']) + '">Official regional Pocono Beverage Trail</a>.</p>'
guide('beer-wine-trail', d['title'], d['intro'], body, '?trail=beer-wine')
# Keep historical shared page URLs useful after confirmed moves or renamed listings.
for old_slug, target in DETAILS.get('pageAliases', {}).items():
    if target in slugs and old_slug != slugs[target]:
        page('place/'+old_slug+'.html', 'Updated place listing | WallyMap', 'This place listing has moved or changed.', '<h1>Updated place listing</h1><p>This old listing has been replaced by '+plink(target)+'.</p><a class="btn" href="/?p='+e(target)+'">Open the current map pin</a>')
if os.path.exists('../docs/market.json'):
    exec(open('seo_market.py').read())
page('guide/index.html', 'Guides to Lake Wallenpaupack | WallyMap', 'Guides to Lake Wallenpaupack: marinas, public beaches and launches, dock and dine, restaurants, places to stay, fishing, boating rules, history and events.',
     '<h1>Guides to Lake Wallenpaupack</h1><p>Plain lists drawn from the 3D map, for when you want to read rather than explore.</p><a class="btn" href="/">Open the 3D map</a><ul class="l">' + ''.join(f'<li><a href="/guide/{s}.html">{e(t)}</a></li>' for s, t in NAV) + '</ul>', kick='WallyMap')
# drop pages for places that no longer exist
live = set(URLS)
for f in glob.glob('../docs/place/*.html') + glob.glob('../docs/guide/*.html'):
    if f[len('../docs/'):] not in live: os.remove(f)
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + f'<url><loc>{SITE}/</loc><lastmod>{TODAY}</lastmod></url>\n' + ''.join(f'<url><loc>{SITE}/{u.replace("guide/index.html", "guide/")}</loc><lastmod>{TODAY}</lastmod></url>\n' for u in URLS) + '</urlset>\n'
open('../docs/sitemap.xml', 'w').write(sm); open('../docs/robots.txt', 'w').write(f'User-agent: *\nAllow: /\nSitemap: {SITE}/sitemap.xml\n')
json.dump(slugs, open('../docs/place/index.json', 'w'), separators=(',', ':'))
print(len(PAGED), 'place pages', len(NAV), 'guides', len(URLS), 'urls')
