# Licence of the muscle-map mesh (mm_data.js)

## What the file is

`mm_data.js` is a 3D figure of the human muscles made from BodyParts3D, a database by the Database Center for Life Science (DBCLS),
Japan. Its meshes were selected, simplified (fewer triangles), cut along the body's midline and mirrored, regrouped into 16 muscle
groups, scaled to a figure 2 units tall and packed into one data file. Nothing else was added except shading values computed from the
shapes themselves.

## Which parts come from which release

- Release 4.0 (archive file `isa_BP3D_4.0_obj_99.zip`): every part of the figure except one: head, hands, feet, bones, tendons and all
  muscles other than the one below. The abs/obliques split is a cut through the release 4.0 external oblique sheath.
- Release 3.0 (archive file `BodyParts3D_3.0_obj_99.zip`): the latissimus dorsi only (source file `FMA13359.obj`, mirrored for the
  other side). In the file it is the "lats" group, plus the lower part of its sheet that is shown as "lower back".

## The two licences, as read at the source

**Release 4.0.** The archive's licence page (dbarchive.biosciencedbc.jp, English, "Last updated : 2025/02/27"; saved copy in
`raw/pages/`) says: "The license for this database is specified in the Creative Commons Attribution 4.0 International. If you use data
from this database, please be sure attribute this database as follows: "BodyParts3D, © The Database Center for Life Science licensed
under CC Attribution 4.0 International"." The release 4.0 README (`raw/bp3d/README_e.html`) says the same.

**Release 3.0.** Its README (`raw/bp3d30/README_e.html`, section 3.1, read again on 17 Nov 2026) says: "The license for this database is
the license specified in the Creative Commons Attribution-Share Alike 2.1 Japan. If you use data from this database, please be sure
attribute this database as follows: "BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike
2.1 Japan"." and "You must distribute any derivative work based on part or whole of the data from this database under this License."
The lats file's own header says: "BodyParts3D, Copyright(C) 2010-2011 The Database Center for Life Science licensed under CC
Attribution-Share Alike 2.1 Japan."

## Terms this derived file is shared under

- The parts taken from release 4.0 are shared under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.
- The latissimus dorsi part, taken from release 3.0, is shared under **Creative Commons Attribution-Share Alike 2.1 Japan
  (CC BY-SA 2.1 JP)**.
- To be safe, the combined mesh file as a whole is also shared under **CC BY-SA 2.1 Japan**: anyone who receives it may use, change and
  share it under that licence, with the credit below, and must share changed versions of it under the same licence.
- The rest of the app that displays this file is a separate work and is not covered by these terms.

## The credit (carried in the file's `credit` field and shown by the app)

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. The latissimus dorsi mesh comes
from release 3.0: BodyParts3D, Copyright© The Database Center for Life Science licensed by CC Attribution-Share Alike 2.1 Japan.
Meshes simplified, mirrored and regrouped for this app.

The licence texts are published by Creative Commons under the names above (Attribution 4.0 International; Attribution-Share Alike 2.1
Japan). No warranty is given for the data, by DBCLS or by this app.

## The notice the app shows under the credit

build.py reads the lines between the two markers below and writes them, with the `credit` field of the mesh data, into the built app (both
`dist/ComebackBlueprint.html` and `dist/artifact.html`), where Track › Regions shows them as plain text under "How the body counts". Addresses are
written out without a scheme and are never links (house rule: no hyperlinks).

<!-- app-notice -->
Licences: Creative Commons Attribution 4.0 International (creativecommons.org/licenses/by/4.0) and Creative Commons Attribution-Share Alike 2.1 Japan (creativecommons.org/licenses/by-sa/2.1/jp).
The mesh is provided as is, without warranty.
Only the mesh is under these licences; the rest of the app is not.
<!-- /app-notice -->
