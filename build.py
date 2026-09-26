#!/usr/bin/env python3
"""Build the single-file app and its optional install bundle.

src/app_full.js is injected into src/blueprint.html -> dist/ComebackBlueprint.html (the app; opens from a file
with no server). The install bundle next to it (manifest, service worker, icons, index redirect) only takes
effect when the folder is served over https, e.g. GitHub Pages; on file:// the app never requests it.
"""
import hashlib, pathlib, shutil
root = pathlib.Path(__file__).parent
shell = (root / 'src/blueprint.html').read_text(encoding='utf-8')
js = (root / 'src/app_full.js').read_text(encoding='utf-8')
MARK = '/* APP LOGIC LOADED SEPARATELY BELOW */'
assert shell.count(MARK) == 1, 'shell placeholder missing or duplicated'
out = shell.replace(MARK, js)
dist = root / 'dist'
dist.mkdir(exist_ok=True)
(dist / 'ComebackBlueprint.html').write_text(out, encoding='utf-8')
print('built dist/ComebackBlueprint.html', len(out.encode('utf-8')), 'bytes')

# Install bundle (PWA). The service-worker version is the page's content hash, so every build that changes
# the app changes sw.js, which is what makes installed copies pick the new build up.
pwa = root / 'src/pwa'
if pwa.is_dir():
    version = hashlib.sha256(out.encode('utf-8')).hexdigest()[:12]
    sw = (pwa / 'sw.template.js').read_text(encoding='utf-8')
    assert sw.count('__VERSION__') == 1, 'sw template version marker missing or duplicated'
    (dist / 'sw.js').write_text(sw.replace('__VERSION__', version), encoding='utf-8')
    shutil.copyfile(pwa / 'manifest.webmanifest', dist / 'manifest.webmanifest')
    (dist / 'icons').mkdir(exist_ok=True)
    for png in sorted(pwa.glob('icon-*.png')):
        shutil.copyfile(png, dist / 'icons' / png.name)
    redirect = ('<!doctype html><meta charset="utf-8"><title>The Comeback Blueprint</title>'
                '<meta http-equiv="refresh" content="0; url={u}"><link rel="canonical" href="{u}">'
                '<a href="{u}">Open The Comeback Blueprint</a>')
    (dist / 'index.html').write_text(redirect.format(u='ComebackBlueprint.html'), encoding='utf-8')
    print('built install bundle: sw.js v' + version + ', manifest, icons, index redirect')
