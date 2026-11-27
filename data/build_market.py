"""Real estate market figures for the lake area -> ../docs/market.json. Source: Realtor.com Economic Research data library
(monthly inventory core metrics by county and ZIP; free to use with attribution). These are figures about homes LISTED for sale
(asking prices, counts, days on market), not recorded sale prices. Re-run monthly: the library updates early each month.
  curl the three CSVs into market/ first (URLs below)."""
import csv, json, os, urllib.request
BASE = 'https://econdata.s3-us-west-2.amazonaws.com/Reports/Core/'
FILES = {'rdc_county.csv': 'RDC_Inventory_Core_Metrics_County.csv', 'rdc_zip.csv': 'RDC_Inventory_Core_Metrics_Zip.csv', 'rdc_county_hist.csv': 'RDC_Inventory_Core_Metrics_County_History.csv'}
os.makedirs('market', exist_ok=True)
import sys
if 'fetch' in sys.argv:
    for f, u in FILES.items(): urllib.request.urlretrieve(BASE + u, 'market/' + f)
COUNTY = {'42103': 'Pike County', '42127': 'Wayne County'}
ZIPS = {'18428': 'Hawley', '18464': 'Tafton', '18426': 'Greentown', '18451': 'Paupack', '18438': 'Lakeville', '18436': 'Lake Ariel', '18445': 'Newfoundland', '18431': 'Honesdale'}
num = lambda v: (float(v) if v not in ('', None) else None)
def row(r): return {'price': num(r['median_listing_price']), 'price_yy': num(r['median_listing_price_yy']), 'active': num(r['active_listing_count']), 'active_yy': num(r['active_listing_count_yy']),
                    'days': num(r['median_days_on_market']), 'days_yy': num(r['median_days_on_market_yy']), 'new': num(r['new_listing_count']), 'reduced_share': num(r['price_reduced_share']),
                    'ppsf': num(r['median_listing_price_per_square_foot']), 'sqft': num(r['median_square_feet']), 'pending': num(r['pending_listing_count'])}
out = {'source': 'Realtor.com® Economic Research', 'source_url': 'https://www.realtor.com/research/data/', 'counties': [], 'zips': [], 'history': {}}
for r in csv.DictReader(open('market/rdc_county.csv')):
    if r['county_fips'] in COUNTY: out['counties'].append({'n': COUNTY[r['county_fips']], **row(r)}); out['month'] = r['month_date_yyyymm']
for r in csv.DictReader(open('market/rdc_zip.csv')):
    if r['postal_code'] in ZIPS: out['zips'].append({'zip': r['postal_code'], 'n': ZIPS[r['postal_code']], **row(r)})
out['zips'].sort(key=lambda z: list(ZIPS).index(z['zip']))
mm = out['month'][-2:]
for r in csv.DictReader(open('market/rdc_county_hist.csv')):
    if r['county_fips'] in COUNTY and r['month_date_yyyymm'][-2:] == mm:
        out['history'].setdefault(COUNTY[r['county_fips']], []).append({'y': int(r['month_date_yyyymm'][:4]), 'price': num(r['median_listing_price']), 'active': num(r['active_listing_count']), 'days': num(r['median_days_on_market'])})
for k in out['history']: out['history'][k].sort(key=lambda h: h['y'])
# second homes: U.S. Census Bureau, American Community Survey 5-year estimates (share of housing units held for seasonal or occasional use), gathered 2026-11-26
out['seasonal'] = [{'n': 'Palmyra Township, Pike County', 'share': 59.8}, {'n': 'Paupack Township, Wayne County', 'share': 57.5}, {'n': 'Pike County', 'share': 35.4}, {'n': 'Wayne County', 'share': 30.6}]
json.dump(out, open('../docs/market.json', 'w'), indent=1); print(out['month'], len(out['counties']), len(out['zips']), {k: len(v) for k, v in out['history'].items()})
