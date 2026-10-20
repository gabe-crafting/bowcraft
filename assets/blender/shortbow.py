import bpy, math
from mathutils import Vector
exec(open(r"C:\Users\gabe\Projects\Games\bounty-hunter\assets\blender\lowpoly.py").read())
src = open(r"C:\Users\gabe\Projects\Games\bounty-hunter\assets\blender\bows.py").read()
exec(src.split("C_root =")[0])  # sweep() and bow() only

# Mongol-style composite bow, 0.9 m, handle at the origin (half the longbow). Upright along Z, grip at the origin,
# limbs bow forward (-Y), rigid ears (siyah) at the ends run back along the string line and
# hook forward at the nocks; the string rests on the limb/ear joints.
coll = new_collection("Shortbow")
if coll.name in bpy.context.scene.collection.children:
    bpy.context.scene.collection.children.unlink(coll)
weapons = bpy.data.collections["Weapons"]
if coll.name not in weapons.children:
    weapons.children.link(coll)

horn = mat("Shortbow_Limb", hexc(0x2b211c), rough=0.6)
ear_wood = mat("Shortbow_Wood", hexc(0xc49255), rough=0.78)
riser_mat = mat("Shortbow_Riser", hexc(0x7a3f28), rough=0.7)
wrap = mat("Shortbow_Wrap", hexc(0x6a3a22), rough=0.95)
string = mat("Bow_String", hexc(0xf4f0e8), rough=0.45)

J = 0.3       # height of the limb/ear joint
SEG = 14
limb_pts, lw, ld = [], [], []
for i in range(SEG + 1):
    z = (i / SEG * 2 - 1) * J
    t = z / J
    # deep forward C, flattened a little through the grip
    y = -0.012 - 0.11 * (1 - t * t) * (1 - 0.25 * math.exp(-(t / 0.25) ** 2))
    limb_pts.append(Vector((0, y, z)))
    taper = 1 - 0.3 * abs(t)
    lw.append(0.03 * taper)
    ld.append(0.02 * taper)
sweep(coll, "Shortbow_limbs", limb_pts, lw, ld, horn)

# riser: thicker brown block over the grip section
riser = [p for p in limb_pts if abs(p.z) <= 0.1]
sweep(coll, "Shortbow_riser", riser, [0.036] * len(riser), [0.034] * len(riser), riser_mat)

ear = [Vector((0, -0.012, J)), Vector((0, -0.02, 0.37)), Vector((0, -0.034, 0.43)), Vector((0, -0.068, 0.455))]
ear_w = [0.024, 0.026, 0.024, 0.016]
ear_d = [0.022, 0.03, 0.028, 0.018]
for sign, tag in ((1, "T"), (-1, "B")):
    pts = [Vector((0, p.y, p.z * sign)) for p in ear]
    sweep(coll, "Shortbow_ear" + tag, pts, ear_w, ear_d, ear_wood)
    # sinew wraps at the joint and at both ends of the riser
    cyl(coll, "Shortbow_jointwrap" + tag, 0.022, 0.022, 0.05, Vector((0, -0.014, sign * (J - 0.01))), wrap, verts=6)
    rp = riser[-1] if sign > 0 else riser[0]
    cyl(coll, "Shortbow_riserwrap" + tag, 0.025, 0.025, 0.03, rp, wrap, verts=6)

# string: from the top nock down the ear, across the joints, to the bottom nock
top = [p + Vector((0, 0.016, 0)) for p in ear[:3]]
path = [Vector((0, p.y, -p.z)) for p in reversed(top)] + [Vector((0, top[0].y, 0))] + top
sweep(coll, "Shortbow_string", path, [0.005] * len(path), [0.005] * len(path), string)

ob = finish(coll, "Shortbow", 0.0)
c = recenter_on(ob, "Shortbow_Riser")
# limbs bend between the riser (|z| = 0.1) and the rigid ears (|z| = J)
centerline = lambda z: -0.012 - 0.11 * (1 - (z / J) ** 2) * (1 - 0.25 * math.exp(-((z / J) / 0.25) ** 2)) - c.y
rig_bow(ob, centerline, 0.1, J, 0.4).location = (0.0, 1.6, 1.0)
print(len(ob.data.polygons), tuple(round(v, 3) for v in ob.dimensions))
