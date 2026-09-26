#!/usr/bin/env python3
"""Build the single-file app and its optional install layer.
src/app_full.js is injected into src/blueprint.html -> dist/ComebackBlueprint.html (the app; works opened as a file).
src/pwa/* (manifest, service worker, icons) are copied beside it; they are used only when the app is served over
http/https (GitHub Pages), where they make it installable and usable offline. sw.js is stamped with a hash of the
built app so each new build replaces the offline cache. The build is deterministic: same sources, same bytes."""
import pathlib,hashlib,shutil
root=pathlib.Path(__file__).parent
shell=(root/'src/blueprint.html').read_text(encoding='utf-8')
js=(root/'src/app_full.js').read_text(encoding='utf-8')
MARK='/* APP LOGIC LOADED SEPARATELY BELOW */'
assert shell.count(MARK)==1, 'shell placeholder missing or duplicated'
out=shell.replace(MARK,js)
dist=root/'dist';dist.mkdir(exist_ok=True)
(dist/'ComebackBlueprint.html').write_text(out,encoding='utf-8')
stamp=hashlib.sha256(out.encode('utf-8')).hexdigest()[:12]
pwa=root/'src/pwa'
for f in ['manifest.webmanifest','icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png']:
    shutil.copyfile(pwa/f,dist/f)
sw=(pwa/'sw.js').read_text(encoding='utf-8')
assert sw.count('__BUILD__')==2,'sw.js build stamp placeholders changed'
(dist/'sw.js').write_text(sw.replace('__BUILD__',stamp),encoding='utf-8')
(dist/'index.html').write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=ComebackBlueprint.html"><title>The Comeback Blueprint</title><a href="ComebackBlueprint.html">Open The Comeback Blueprint</a>\n',encoding='utf-8')
print('built dist/ComebackBlueprint.html',len(out),'chars · build',stamp)
