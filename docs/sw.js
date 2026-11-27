// Ordinary browsing caches visited files. Explicit downloads commit only after every asset succeeds.
const CACHE='wallymap-runtime-v2', OFFLINE='wallymap-offline-v2', STATUS='__offline_status__';
const KEEP=u=>u.origin===location.origin || ['cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname);
const keyFor=u=>u.origin===location.origin?u.origin+u.pathname:u.href;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||!KEEP(u))return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE),offline=await caches.open(OFFLINE),key=keyFor(u);
  const saved=await cache.match(key)||await offline.match(key);
  const net=fetch(e.request).then(async r=>{if(r.ok||r.type==='opaque')await cache.put(key,r.clone());if(!r.ok&&r.type!=='opaque'&&saved)return saved;return r;});
  if(!saved)return net;
  return Promise.race([net.catch(()=>saved),new Promise(resolve=>setTimeout(()=>resolve(saved),3500))]);
 })());
});
let job=null;
async function broadcast(data){for(const c of await self.clients.matchAll({includeUncontrolled:true}))c.postMessage({type:'OFFLINE_PROGRESS',...data});}
async function download(){
 let done=0,total=0;
 try{
  const response=await fetch('offline-manifest.json',{cache:'reload'});if(!response.ok)throw Error('Could not load the download list');
  const manifest=await response.json();total=manifest.files.length;
  const cache=await caches.open(OFFLINE),runtime=await caches.open(CACHE);
  // Mark incomplete before updating: never present a partial new version as ready.
  await cache.delete(new URL(STATUS,self.registration.scope).href);
  let cursor=0;
  const completed=await Promise.allSettled(Array.from({length:4},async()=>{while(cursor<total){const file=manifest.files[cursor++],url=new URL(file,self.registration.scope);const r=await fetch(url.href,{cache:'reload',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Could not save '+file);await runtime.put(keyFor(url),r.clone());await cache.put(keyFor(url),r);done++;await broadcast({done,total});}}));
  const failed=completed.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  await cache.put(new URL(STATUS,self.registration.scope).href,new Response(JSON.stringify({complete:true,savedAt:new Date().toISOString(),bytes:manifest.bytes,version:manifest.version,total}),{headers:{'Content-Type':'application/json'}}));
  await broadcast({done,total,complete:true});
 }catch(e){await broadcast({done,total,error:e.message});}finally{job=null;}
}
self.addEventListener('message',e=>{
 if(e.data?.type==='OFFLINE_STATUS')e.waitUntil((async()=>{const cache=await caches.open(OFFLINE),r=await cache.match(new URL(STATUS,self.registration.scope).href);e.ports[0]?.postMessage(r?await r.json():{complete:false});})());
 if(e.data?.type==='DOWNLOAD_OFFLINE'){if(!job)job=download();e.ports[0]?.postMessage({started:true});e.waitUntil(job);}
});
