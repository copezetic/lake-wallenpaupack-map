"""Utilities and services directory -> ../docs/services.json. Trades and services a homeowner or renter needs (plumbers,
electricians, septic, trash, property managers, emergency services), taken from Overture Maps places inside the map area. These are
NOT map pins: they show only in the 'Utilities & services' panel and its guide page. Nothing is checked or recommended."""
import json, re
A = json.load(open('area.json'))
GROUPS = [
 ('Emergency services', ['fire_station', 'police_station', 'ambulance_or_ems_service', 'hospital', 'urgent_care_clinic']),
 ('Plumbing and heating', ['plumbing', 'hvac_service', 'hvac_supplier', 'fireplace_service']),
 ('Electricians and generators', ['electrician', 'electrical_supply_store']),
 ('Septic, wells and water', ['septic_service', 'well_drilling']),
 ('Trash and recycling', ['garbage_collection_service', 'b2b_cleaning_and_waste_management']),
 ('Propane and heating fuel', ['propane_supplier', 'b2b_oil_and_gas', 'b2b_oil_and_gas_equipment']),
 ('Property management and cleaning', ['property_management', 'home_cleaning', 'cleaning_service', 'carpet_cleaning']),
 ('Builders, roofers and repairs', ['contractor', 'building_or_construction_service', 'roofing', 'painting', 'carpenter', 'handyman', 'altering_and_remodeling_contractor', 'flooring_contractor', 'appliance_repair_service']),
 ('Excavation and paving', ['excavation_service', 'paving_contractor']),
 ('Yard, trees and lawn', ['landscaping', 'lawn_service', 'landscape_architect']),
 ('Pests, locks and damage repair', ['pest_control_service', 'key_and_locksmith', 'fire_and_water_damage_restoration']),
 ('Towing', ['towing_service']),
 ('Veterinarians', ['veterinarian']),
]
SKIP = re.compile(r'blue rhino|propane exchange|minutekey|auxiliary|learning center|garden center', re.I)
KIND = {k: g for g, ks in GROUPS for k in ks}; out = {g: [] for g, _ in GROUPS}; seen = set()
for l in open('places_overture.geojsonl'):
    f = json.loads(l); p = f['properties']; pr = (p.get('taxonomy') or {}).get('primary') or ''; n = (p.get('names') or {}).get('primary')
    if pr not in KIND or not n or (p.get('confidence') or 0) < 0.6 or SKIP.search(n): continue
    if p.get('operating_status') in ('permanently_closed', 'temporarily_closed'): continue
    lon, lat = f['geometry']['coordinates'][:2]
    if not (A['W'] <= lon <= A['E'] and A['S'] <= lat <= A['N']): continue
    key = re.sub(r'[^a-z0-9]', '', n.lower())[:18]
    if key in seen: continue
    seen.add(key)
    if n.isupper() and len(n) > 4: n = n.title()
    ad = (p.get('addresses') or [{}])[0]; a = (ad.get('freeform') or '') + (', ' + ad['locality'] if ad.get('locality') and ad.get('freeform') else (ad.get('locality') or ''))
    it = {'n': n.strip(), 'lat': round(lat, 5), 'lon': round(lon, 5)}
    if a: it['a'] = a
    if p.get('phones'): it['ph'] = p['phones'][0]
    if p.get('websites'): it['url'] = p['websites'][0]
    out[KIND[pr]].append(it)
groups = [{'t': g, 'items': sorted(v, key=lambda x: x['n'].lower())} for g, v in out.items() if v]
json.dump({'_note': 'Trades and services inside the map area, from Overture Maps place data. Not pins. Not checked, licensed-verified or recommended.',
           'intro': 'Who to call around the lake. These are listings from public map data, in alphabetical order: nobody has checked licences, insurance or quality, and being listed is not a recommendation.',
           'fine': 'From Overture Maps place data; phone numbers and addresses can be out of date. Run one of these businesses, or missing from the list? Email info@wallymap.com.',
           'updated': __import__('datetime').date.today().isoformat(), 'groups': groups}, open('../docs/services.json', 'w'), separators=(',', ':'))
for g in groups: print(len(g['items']), g['t'], '|', ', '.join(i['n'] for i in g['items'][:4]))
