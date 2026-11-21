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
# Fonts (P1): the latin woff2 faces in src/fonts are inlined as data: URIs, so no font is ever fetched (the artifact viewer allows fonts only from
# data: or Google; a file opened offline has no network). The OFL notice travels with them: each copyright line plus the licence text as a CSS
# comment, and a plain-text credit on the Guide view. The harness strips style[data-fonts] for a fallback-font run (FONTS=0).
import base64
FONT_MARK='<!-- FONT FACES: build.py inlines the woff2 files in src/fonts here, so no font ever comes from the network -->'
LATIN='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD'
FACES=[('IBM Plex Mono','400','ibmplexmono-400-latin.woff2'),('IBM Plex Mono','500','ibmplexmono-500-latin.woff2'),('IBM Plex Mono','600','ibmplexmono-600-latin.woff2'),
       ('Manrope','400 800','manrope-latin.woff2'),('Space Grotesk','500 700','spacegrotesk-latin.woff2')]  # the two variable faces keep the weight ranges Google served
fdir=root/'src/fonts'
ofl=[(fdir/f).read_text(encoding='utf-8').replace('\r\n','\n') for f in ('OFL-manrope.txt','OFL-spacegrotesk.txt','OFL-ibmplexmono.txt')]
bodies=[o.split('\n',2)[2].strip() for o in ofl];assert len({' '.join(x.split()) for x in bodies})==1,'the three OFL texts differ below the copyright line'
lic='/* Fonts: Manrope, Space Grotesk and IBM Plex Mono, inlined unchanged (latin subsets as Google Fonts serves them).\n'+'\n'.join(o.split('\n',1)[0] for o in ofl)+'\n\n'+bodies[0]+'\n*/'
assert '*/' not in lic[:-2],'licence text would close the comment'
css=lic+'\n'+'\n'.join("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2');unicode-range:%s}"%(fam,w,base64.b64encode((fdir/f).read_bytes()).decode('ascii'),LATIN) for fam,w,f in FACES)
assert shell.count(FONT_MARK)==1,'font placeholder missing or duplicated'
shell=shell.replace(FONT_MARK,'<style data-fonts>\n'+css+'\n</style>')
# Home Screen (PX8): a static PNG apple-touch-icon in the shell (iOS ignores an SVG data: icon) and one launch screen per iPhone size in
# src/pwa/startup.json (rendered by src/pwa/make-icons.js). Links only, in <head>: the artifact copy below carries no <link>, so it is unchanged.
import json
SCREENS=json.loads((root/'src/pwa/startup.json').read_text(encoding='utf-8'))['screens']
STARTUP=['startup-%dx%d.png'%(s['w']*s['dpr'],s['h']*s['dpr']) for s in SCREENS]
assert len(set(STARTUP))==len(STARTUP),'two launch screens share a size'
SU_MARK='<!-- STARTUP IMAGES: build.py links the iPhone launch screens in src/pwa/startup.json here (PX8) -->'
assert shell.count(SU_MARK)==1,'launch-screen placeholder missing or duplicated'
shell=shell.replace(SU_MARK,'\n'.join('<link rel="apple-touch-startup-image" media="(device-width: %dpx) and (device-height: %dpx) and (-webkit-device-pixel-ratio: %d) and (orientation: portrait)" href="%s">'%(s['w'],s['h'],s['dpr'],f) for s,f in zip(SCREENS,STARTUP)))
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
ASSETS=['manifest.webmanifest','icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png']+STARTUP
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
# carries only a name-only <title>, the styles, the font script and the body; the header stops adding its own top inset.
import re
head=out[out.index('<head>')+6:out.index('</head>')]
body=out[out.index('<body>')+6:out.rindex('</body>')]
styles=re.findall(r'<style[\s\S]*?</style>|<script[\s\S]*?</script>',head)  # styles and the font script (P1-R2-1), in order
art_css='<style>:root{color-scheme:dark}html{scroll-padding-top:96px}header.app{padding-top:0;top:env(safe-area-inset-top,0px)}body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:51;background:var(--ink)}</style>'
art='<title>The Comeback Blueprint</title>\n'+'\n'.join(styles)+'\n'+art_css+'\n'+body.strip()+'\n'
for tag in ('<!doctype','<!DOCTYPE','<html','<head>','<body'):assert tag not in art,('artifact shape',tag)
for doc in (out,art):assert 'fonts.googleapis' not in doc and 'fonts.gstatic' not in doc,'a Google Fonts reference is back in a dist file'
(dist/'artifact.html').write_text(art,encoding='utf-8')
print('built dist/ComebackBlueprint.html',len(out),'chars · build',stamp,'· dist/artifact.html',len(art),'chars')
