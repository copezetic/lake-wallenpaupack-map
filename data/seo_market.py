# run inside build_seo.py: the real estate market guide, from ../docs/market.json
MK = J('market'); MN = datetime.date(int(MK['month'][:4]), int(MK['month'][4:]), 1).strftime('%B %Y')
usd = lambda v: '—' if v is None else f'${v:,.0f}'; pct = lambda v: '' if v is None else f' ({v * 100:+.0f}% vs a year ago)'; n0 = lambda v: '—' if v is None else f'{v:,.0f}'
def mrow(x, lab): return f'<tr><th>{e(lab)}</th><td>{usd(x["price"])}</td><td>{n0(x["active"])}</td><td>{n0(x["days"])}</td><td>{usd(x["ppsf"])}</td></tr>'
TB = 'table{border-collapse:collapse;width:100%;margin:10px 0;font-size:16px}th,td{text-align:right;padding:6px 8px;border-bottom:1px solid var(--line)}th:first-child,td:first-child,tr th{text-align:left}thead th{color:var(--mut);font-weight:500;font-size:14px}.tw{overflow-x:auto}'
head = '<thead><tr><th></th><th>Median asking price</th><th>Homes for sale</th><th>Median days listed</th><th>Asking $ / sq ft</th></tr></thead>'
cty = ''.join(f'<p><b>{e(c["n"])}</b>: median asking price {usd(c["price"])}{pct(c["price_yy"])}; {n0(c["active"])} homes for sale{pct(c["active_yy"])}; a typical listing has been on the market {n0(c["days"])} days; {c["reduced_share"] * 100:.0f}% of listings had a price cut during the month.</p>' for c in MK['counties'])
hist = ''
for k, hs in MK['history'].items():
    hist += f'<h2>{e(k)}: each {MN.split()[0]} since {hs[0]["y"]}</h2><div class="tw"><table><thead><tr><th>Year</th><th>Median asking price</th><th>Homes for sale</th><th>Median days listed</th></tr></thead>' + ''.join(f'<tr><th>{h["y"]}</th><td>{usd(h["price"])}</td><td>{n0(h["active"])}</td><td>{n0(h["days"])}</td></tr>' for h in hs) + '</table></div>'
body = f'''<style>{TB}</style><h2>{MN} at a glance</h2>{cty}
<h2>Around the lake, by ZIP code</h2><div class="tw"><table>{head}{''.join(mrow(z, f"{z['n']} ({z['zip']})") for z in MK['zips'])}</table></div>
<p class="fine">ZIP codes with only a handful of listings swing widely from month to month.</p>{hist}
<h2>A second-home market</h2><ul class="l">{''.join(f'<li><b>{e(s["n"])}</b><small>{s["share"]:.1f}% of housing units are kept for seasonal or occasional use</small></li>' for s in MK['seasonal'])}</ul>
<p class="fine">Listing figures: <a href="{e(MK['source_url'])}" rel="nofollow noopener">{e(MK['source'])}</a>, residential listings data for {MN}. They describe homes listed for sale (asking prices), not recorded sale prices, and cover whole counties and ZIP codes, not just lakefront. Seasonal housing shares: U.S. Census Bureau, American Community Survey 5-year estimates. General information only, not an appraisal or advice.</p>'''
guide('real-estate', 'Lake Wallenpaupack real estate market', f'Housing market statistics for the Lake Wallenpaupack area in {MN}: asking prices, homes for sale and days on market for Pike and Wayne counties and the ZIP codes around the lake.', body)
