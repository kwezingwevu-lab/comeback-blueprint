#!/usr/bin/env python3
"""Inject src/app_full.js into src/blueprint.html -> dist/ComebackBlueprint.html (single-file app)."""
import pathlib
root=pathlib.Path(__file__).parent
shell=(root/'src/blueprint.html').read_text(encoding='utf-8')
js=(root/'src/app_full.js').read_text(encoding='utf-8')
MARK='/* APP LOGIC LOADED SEPARATELY BELOW */'
assert shell.count(MARK)==1, 'shell placeholder missing or duplicated'
out=shell.replace(MARK,js)
(root/'dist').mkdir(exist_ok=True)
(root/'dist/ComebackBlueprint.html').write_text(out,encoding='utf-8')
print('built dist/ComebackBlueprint.html',len(out),'bytes')
