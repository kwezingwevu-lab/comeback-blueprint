#!/usr/bin/env python3
"""P7-4b (qa_full.js): build the app with the PX8 Home Screen step switched off, into another folder, so the check can
compare that dist/artifact.html with the real one byte for byte. Switched off = no launch-screen links in place of the
placeholder and no static PNG apple-touch-icon link in the shell. The real build.py runs unchanged apart from those two
lines; its src/ is a symlink to the repo's. Usage: python3 qa/p7off.py <repo root> <empty out dir>. Prints OFF OK."""
import sys,pathlib
root,out=pathlib.Path(sys.argv[1]).resolve(),pathlib.Path(sys.argv[2]).resolve()
src=(root/'build.py').read_text(encoding='utf-8')
SU="shell=shell.replace(SU_MARK,"
assert src.count(SU)==1,'PX8 launch-screen step not found in build.py'
src=src.replace(SU,"shell=shell.replace(SU_MARK,'');_px8_off=(")
TI="assert shell.count(MARK)==1"
assert src.count(TI)==1,'shell placeholder assert not found in build.py'
src=src.replace(TI,"_ti='<link rel=\"apple-touch-icon\" href=\"apple-touch-icon.png\">\\n';assert shell.count(_ti)==1,'static touch icon link not found';shell=shell.replace(_ti,'');"+TI)
(out/'src').symlink_to(root/'src',target_is_directory=True)
f=str(out/'build.py')
exec(compile(src,f,'exec'),{'__file__':f,'__name__':'__main__'})
print('OFF OK')
