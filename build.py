#!/usr/bin/env python3
"""Build the single-file app and its optional install layer.
src/app_full.js is injected into src/blueprint.html -> dist/ComebackBlueprint.html (the app; works opened as a file).
src/pwa/* (manifest, service worker, icons) are copied beside it; they are used only when the app is served over
http/https (GitHub Pages), where they make it installable and usable offline. sw.js is stamped with a hash of the
app, manifest, icons and worker, so any change replaces the offline cache. The build is deterministic: same sources, same bytes."""
import pathlib,hashlib,shutil
root=pathlib.Path(__file__).parent
shell=(root/'src/blueprint.html').read_text(encoding='utf-8')
js=(root/'src/app_full.js').read_text(encoding='utf-8')
MARK='/* APP LOGIC LOADED SEPARATELY BELOW */'
assert shell.count(MARK)==1, 'shell placeholder missing or duplicated'
# The 3D muscle map (optional, 17 Nov 2026): src/mm/musclemap.js (classic script, defines window.MuscleMap), src/mm/mm_placeholder.js (MM_PLACEHOLDER)
# and the mesh, src/mm/mm_data.json or src/mm/mm_data.js ("window.MM_DATA = {...};"). The scripts go in ahead of the app script; the mesh goes in as an
# inert <script type="application/json" id="mm-data"> block that the app parses only when the first figure mounts. None present = the build as before.
import json
mm=root/'src/mm';extra=[]
if mm.is_dir():
    dj,dm=mm/'mm_data.json',mm/'mm_data.js'
    raw=dj.read_text(encoding='utf-8').strip() if dj.exists() else None
    if raw is None and dm.exists():
        t=dm.read_text(encoding='utf-8').strip();p='window.MM_DATA'
        assert t.startswith(p),'mm_data.js must start with window.MM_DATA ='
        raw=t[len(p):].lstrip().lstrip('=').strip().rstrip(';').strip()
    if raw is not None:
        d=json.loads(raw);assert d.get('v')==1 and isinstance(d.get('groups'),list),'mesh data shape'
        # every "<" in an inline JSON block is written as the six characters \u003c, so neither "</script" nor "<!--" can ever occur in it; JSON.parse reads it back unchanged
        J=lambda o:json.dumps(o,separators=(',',':')).replace('<','\\u003c')
        extra.append('<script type="application/json" id="mm-data">'+J(d)+'</script>')
        # the mesh's credit and licence notice (shown under the Track rules whether or not a figure mounts): the data's credit field, plus the lines
        # between <!-- app-notice --> and <!-- /app-notice --> in src/mm/MESH_LICENCE.md; read from the sources, never retyped in the app
        lic=mm/'MESH_LICENCE.md';notice=[]
        if lic.exists():
            lt=lic.read_text(encoding='utf-8');a,b='<!-- app-notice -->','<!-- /app-notice -->'
            if a in lt and b in lt:notice=[x.strip() for x in lt[lt.index(a)+len(a):lt.index(b)].strip().splitlines() if x.strip()]
        for x in notice:assert 'http' not in x.lower() and '<' not in x,'licence notice: plain text only'
        if isinstance(d.get('credit'),str):extra.append('<script type="application/json" id="mm-credit">'+J({'credit':d['credit'],'notice':notice})+'</script>')
    for name in ('mm_placeholder.js','musclemap.js'):
        p=mm/name
        if p.exists():
            code=p.read_text(encoding='utf-8');assert '</script' not in code.lower(),name+' contains a closing script tag'
            extra.append('<script>'+code+'</script>')
if extra:
    APP='<script>'+MARK;assert shell.count(APP)==1,'app script tag'
    shell=shell.replace(APP,'\n'.join(extra)+'\n'+APP)
out=shell.replace(MARK,js)
dist=root/'dist';dist.mkdir(exist_ok=True)
(dist/'ComebackBlueprint.html').write_text(out,encoding='utf-8')
pwa=root/'src/pwa'
ASSETS=['manifest.webmanifest','icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png']
h=hashlib.sha256(out.encode('utf-8'))
for f in ASSETS+['sw.js']:h.update((pwa/f).read_bytes())
stamp=h.hexdigest()[:12]  # any change to the app, manifest, icons or worker installs a fresh cache
for f in ASSETS:
    shutil.copyfile(pwa/f,dist/f)
sw=(pwa/'sw.js').read_text(encoding='utf-8')
assert sw.count('__BUILD__')==2,'sw.js build stamp placeholders changed'
(dist/'sw.js').write_text(sw.replace('__BUILD__',stamp),encoding='utf-8')
(dist/'index.html').write_text('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=ComebackBlueprint.html"><title>The Comeback Blueprint</title><a href="ComebackBlueprint.html">Open The Comeback Blueprint</a>\n',encoding='utf-8')
# dist/artifact.html: the same app shaped for the claude.ai artifact viewer (published to one fixed link, LEDGER 29).
# The viewer wraps the file in its own doctype/head/body skeleton and pads :root by the safe-area insets, so this copy
# carries only a name-only <title>, the font links, the styles and the body; the header stops adding its own top inset.
import re
head=out[out.index('<head>')+6:out.index('</head>')]
body=out[out.index('<body>')+6:out.rindex('</body>')]
links=re.findall(r'<link[^>]*>',re.sub(r'<noscript>[\s\S]*?</noscript>','',head))
fonts=[l for l in links if 'fonts.g' in l and 'media="print"' not in l]+[l.replace(' media="print" onload="this.media=\'all\'"','') for l in links if 'media="print"' in l]
styles=re.findall(r'<style[\s\S]*?</style>',head)
art_css='<style>:root{color-scheme:dark}html{scroll-padding-top:96px}header.app{padding-top:0;top:env(safe-area-inset-top,0px)}body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:51;background:var(--ink)}</style>'
art='<title>The Comeback Blueprint</title>\n'+'\n'.join(fonts)+'\n'+'\n'.join(styles)+'\n'+art_css+'\n'+body.strip()+'\n'
for tag in ('<!doctype','<!DOCTYPE','<html','<head>','<body'):assert tag not in art,('artifact shape',tag)
(dist/'artifact.html').write_text(art,encoding='utf-8')
print('built dist/ComebackBlueprint.html',len(out),'chars · build',stamp,'· dist/artifact.html',len(art),'chars')
