import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalize,searchEntries,cleanTrip,parseTrip,applyPlaceDetails} from '../docs/discovery.js';
const read=async file=>JSON.parse(await readFile(new URL('../docs/'+file,import.meta.url)));
test('food search includes cuisine and accented names while respecting category filters',()=>{
 const entries=[{n:'Bà & Me',p:{name:'Bà & Me',cat:'food',kind:'Restaurant',facts:[['Serves','Vietnamese']],x:0,z:0}},{n:'An unnamed pizza place',p:{name:'Example',cat:'food',kind:'Pizzeria',x:2,z:0}}];
 assert.equal(normalize('Bà & Me'),'ba and me');assert.equal(searchEntries(entries,'vietnamese')[0].n,'Bà & Me');
 assert.equal(searchEntries(entries,'pizza').length,1);assert.equal(searchEntries(entries,'pizza',{hidden:new Set(['food'])}).length,0);
});
test('shared collections reject invalid data and preserve only known unique places',()=>{
 const ids=new Set(['a','b']);assert.equal(parseTrip('invalid',ids),null);assert.equal(parseTrip('{"stops":{}}',ids),null);
 assert.deepEqual(parseTrip('{"title":"Friends","stops":["b","bad","a","b"]}',ids),{title:'Friends',stops:['b','a']});
 assert.equal(cleanTrip({stops:Array.from({length:40},(_,i)=>String(i))},new Set(Array.from({length:40},(_,i)=>String(i)))).stops.length,30);
});
test('curation redirects stale listings and does not retain explicitly removed hours',()=>{
 const D={pois:[{id:'old'},{id:'current',name:'New',facts:[['Hours','24/7'],['Address','Here']]}]};
 applyPlaceDetails(D,{redirects:{old:'current'},places:{current:{facts:{Hours:null,Phone:'555'},checked:'2026-11-27'}}});
 assert.deepEqual(D.pois.map(p=>p.id),['current']);assert.deepEqual(D.pois[0].facts,[['Address','Here'],['Phone','555']]);
});
test('all trail and itinerary stops resolve to maintained map entries with sources',async()=>{
 const D=await read('lake-data.json'),details=await read('place-details.json');applyPlaceDetails(D,details);const ids=new Set(D.pois.map(p=>p.id));
 for(const f of ['beer-wine.json','plans.json']){const d=await read(f);const stops=d.stops||d.plans.flatMap(p=>p.stops);for(const s of stops){assert.ok(ids.has(s.poi),s.poi);assert.ok(details.places[s.poi]?.sources?.length,s.poi);}}
 for(const [old,current] of Object.entries(details.redirects)){assert.ok(!ids.has(old));assert.ok(ids.has(current));}
});
test('offline manifest contains every local dependency and required Three.js modules',async()=>{
 const manifest=await read('offline-manifest.json');assert.ok(manifest.files.includes('./'));assert.ok(manifest.files.includes('visitor.js'));assert.ok(manifest.files.some(f=>f.endsWith('/OrbitControls.js')));
 for(const f of manifest.files)if(!f.startsWith('https:'))await readFile(new URL('../docs/'+(f==='./'?'index.html':f),import.meta.url));
});
