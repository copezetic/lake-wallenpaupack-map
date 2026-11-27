"""Run after site generation. Builds the explicit, versioned offline download list."""
import hashlib,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'docs'
files=sorted(p for p in root.rglob('*') if p.is_file() and p.suffix in {'.html','.js','.css','.json','.png','.jpg','.svg','.webmanifest'} and p.name not in {'offline-manifest.json','sw.js'})
h=hashlib.sha256()
for p in files:h.update(str(p.relative_to(root)).encode());h.update(p.read_bytes())
external=['https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js','https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/MapControls.js','https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js']
manifest={'version':h.hexdigest()[:16],'bytes':sum(p.stat().st_size for p in files),'files':['./']+[str(p.relative_to(root)) for p in files]+external,'note':'Bytes cover local files; Three.js adds about 1.3 MB. Fonts fall back to system fonts offline.'}
(root/'offline-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(len(manifest['files']),'offline files')
