import bpy, bmesh, math
from mathutils import Vector
exec(open(r"C:\Users\gabe\Projects\Games\bounty-hunter\assets\blender\lowpoly.py").read())

# Bows stand upright along Z with the grip at the origin. The limbs bow out toward -Y
# (away from the archer) and the string runs tip to tip on the +Y side.


def sweep(coll, name, pts, widths, depths, material):
    """Four-sided tube along a polyline in the YZ plane, flat-capped at both ends."""
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        a = pts[max(i - 1, 0)]
        b = pts[min(i + 1, len(pts) - 1)]
        t = (b - a).normalized()
        n = Vector((0, -t.z, t.y))  # perpendicular to the tangent in the YZ plane
        side = Vector((1, 0, 0))
        w, d = widths[i] / 2, depths[i] / 2
        rings.append([bm.verts.new(p + side * sx * w + n * sy * d) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, material, coll)


def bow(coll, name, height, profile, segments, width, depth, wood, grip, string, horn, riser=None):
    pts, ws, ds = [], [], []
    for i in range(segments + 1):
        a = i / segments * 2 - 1
        pts.append(Vector((0, profile(a), a * height / 2)))
        taper = 1 - 0.55 * abs(a) ** 1.5
        ws.append(width * taper)
        ds.append(depth * taper)
    sweep(coll, name + "_limbs", pts, ws, ds, wood)
    y0 = profile(0)
    if riser:
        box(coll, name + "_riser", (width * 1.25, depth * 1.9, height * riser), (0, y0 + depth * 0.25, 0), wood, top=(1, 1))
    box(coll, name + "_grip", (width * 1.45, depth * 1.7, height * 0.12), (0, y0 + depth * 0.2, 0), grip)
    top, bot = pts[-1], pts[0]
    for tip, sign in ((top, 1), (bot, -1)):
        box(coll, name + "_nock" + ("T" if sign > 0 else "B"), (width * 0.75, depth * 1.1, 0.03), tip + Vector((0, 0, -sign * 0.012)), horn)
    # The string leaves each limb at its rearmost point; on a recurve it lies along the
    # curled tip from there out to the nock, on a plain bow that point is the tip itself.
    mid = segments // 2
    lo = max(range(0, mid), key=lambda i: pts[i].y)
    hi = max(range(mid + 1, segments + 1), key=lambda i: pts[i].y)
    path = pts[:lo + 1] + pts[hi:]
    path = [q + Vector((0, ds[pts.index(q)] / 2 + 0.003, 0)) for q in path]
    # a ring in the middle of the straight run, for the nock bone to pull back
    path.insert(lo + 1, (path[lo] + path[lo + 1]) / 2)
    sweep(coll, name + "_string", path, [0.006] * len(path), [0.006] * len(path), string)


def recenter_on(ob, material_name):
    """Move the mesh so the centre of the parts using `material_name` (the handle) is the origin."""
    idx = [i for i, m in enumerate(ob.data.materials) if m.name == material_name][0]
    vs = {v for p in ob.data.polygons if p.material_index == idx for v in p.vertices}
    c = sum((ob.data.vertices[v].co for v in vs), Vector()) / len(vs)
    ob.data.transform(Matrix.Translation(-c))
    return c


def _smooth(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


# Bend at full draw, in radians, for the inner and outer limb bones.
BEND_INNER, BEND_OUTER = 0.24, 0.3
DRAW_FRAMES = 10


def rig_bow(ob, centerline, z0, z1, max_pull, string_material="Bow_String"):
    """Bow rig. `bow` is the handle; each limb is two bones from the handle end (|z| = z0) to
    where the limb stops bending (|z| = z1; past it, e.g. a Mongol bow's rigid ears, everything
    rides on the outer bone). `nock` holds the middle of the string. `centerline(z)` gives the
    limb's y at height z. Bakes a `Draw` clip: frame 0 relaxed, frame DRAW_FRAMES the nock pulled
    back `max_pull` metres with the limbs bent. Call with the mesh at the origin, handle centred."""
    me = ob.data
    idx = [i for i, m in enumerate(me.materials) if m.name == string_material][0]
    sv = {v for p in me.polygons if p.material_index == idx for v in p.vertices}
    mid = [v for v in sv if abs(me.vertices[v].co.z) < 1e-4]
    nock_pos = sum((me.vertices[v].co for v in mid), Vector()) / len(mid)
    zm = (z0 + z1) / 2
    data = bpy.data.armatures.new(ob.name + "_Rig")
    rig = bpy.data.objects.new(ob.name + "_Rig", data)
    for c in ob.users_collection:
        c.objects.link(rig)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = data.edit_bones
    root = eb.new("bow")
    root.head, root.tail = Vector((0, 0, 0)), Vector((0, 0, 0.15))
    pt = lambda z: Vector((0, centerline(abs(z)), z))
    for side, sg in (("T", 1), ("B", -1)):
        inner = eb.new("limb_inner." + side)
        inner.head, inner.tail = pt(sg * z0), pt(sg * zm)
        outer = eb.new("limb_outer." + side)
        outer.head, outer.tail = pt(sg * zm), pt(sg * z1)
        for bn in (inner, outer):
            bn.align_roll(Vector((0, -1, 0)))
        inner.parent, outer.parent, outer.use_connect = root, inner, True
    nock = eb.new("nock")
    nock.head, nock.tail = nock_pos, nock_pos + Vector((0, 0.05, 0))
    nock.align_roll(Vector((0, 0, 1)))
    nock.parent = root
    bpy.ops.object.mode_set(mode='OBJECT')

    groups = {n: ob.vertex_groups.new(name=n) for n in
              ("bow", "nock", "limb_inner.T", "limb_outer.T", "limb_inner.B", "limb_outer.B")}
    groups["nock"].add(mid, 1.0, 'REPLACE')
    for v in me.vertices:
        if v.index in mid:
            continue
        side = "T" if v.co.z > 0 else "B"
        t = (abs(v.co.z) - z0) / (z1 - z0)
        w_out = _smooth(0.4, 0.6, t)
        w_in = _smooth(-0.08, 0.08, t) - w_out
        for g, w in (("bow", 1 - w_in - w_out), ("limb_inner." + side, w_in), ("limb_outer." + side, w_out)):
            if w > 1e-4:
                groups[g].add([v.index], w, 'REPLACE')
    ob.parent = rig
    ob.modifiers.new("Armature", 'ARMATURE').object = rig
    rig["max_pull"] = max_pull

    # Draw clip: the game scrubs it by pull distance (time = pull / max_pull * duration)
    bpy.context.view_layer.update()
    ad = rig.animation_data_create()
    act = bpy.data.actions.new(ob.name + "|Draw")
    ad.action = act
    for frame, k in ((0, 0.0), (DRAW_FRAMES, 1.0)):
        for n in ("limb_inner.T", "limb_outer.T", "limb_inner.B", "limb_outer.B"):
            pb = rig.pose.bones[n]
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = (-k * (BEND_INNER if "inner" in n else BEND_OUTER), 0, 0)
            pb.keyframe_insert("rotation_euler", frame=frame)
        pb = rig.pose.bones["nock"]
        pb.location = (0, k * max_pull, 0)
        pb.keyframe_insert("location", frame=frame)
    for fc in _fcurves(ad):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    ad.action = None
    track = ad.nla_tracks.new()
    track.name = "Draw"
    strip = track.strips.new("Draw", 0, act)
    if hasattr(strip, "action_slot") and act.slots:
        strip.action_slot = act.slots[0]
    for pb in rig.pose.bones:
        pb.location, pb.rotation_euler = (0, 0, 0), (0, 0, 0)
    return rig


def _fcurves(ad):
    if hasattr(ad.action, "fcurves"):
        return ad.action.fcurves
    from bpy_extras import anim_utils
    return anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot).fcurves


C_root = bpy.data.collections.get("Weapons") or bpy.data.collections.new("Weapons")
if C_root.name not in bpy.context.scene.collection.children:
    bpy.context.scene.collection.children.link(C_root)

string = mat("Bow_String", hexc(0xf4f0e8), rough=0.45)
grip = mat("Bow_Grip", hexc(0x3a2a22), rough=0.9)
horn = mat("Bow_Horn", hexc(0xe6dcc2), rough=0.5)

specs = [
    # name, wood colour (same as BowView), height, profile, segments, width, depth, riser
    ("Shortbow", 0xc49255, 1.1, lambda a: -0.14 * (1 - a * a), 6, 0.032, 0.026, None),
    ("Longbow", 0x6b3f24, 1.8, lambda a: -0.2 * (1 - a * a), 10, 0.034, 0.03, None),
    # recurve: limbs bow out, then the last quarter curls forward again past the string line
    ("Recurve", 0x8a3b2a, 1.5,
     lambda a: -0.18 * (1 - a * a) - 0.16 * max(0.0, (abs(a) - 0.7) / 0.3) ** 2, 20, 0.036, 0.022, 0.26),
]
MAX_PULL = {"Shortbow": 0.4, "Longbow": 0.6, "Recurve": 0.55}
made = {}
for i, (name, woodc, h, prof, seg, w, d, riser) in enumerate(specs):
    coll = new_collection(name)
    if coll.name in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.unlink(coll)
    if coll.name not in C_root.children:
        C_root.children.link(coll)
    wood = mat(name + "_Wood", hexc(woodc), rough=0.78)
    bow(coll, name, h, prof, seg, w, d, wood, grip, string, horn, riser)
    ob = finish(coll, name, 0.0)
    c = recenter_on(ob, "Bow_Grip")
    z0 = h * (riser / 2 if riser else 0.06)
    centerline = lambda z, prof=prof, h=h, c=c: prof(z / (h / 2)) - c.y
    rig_bow(ob, centerline, z0, h / 2, MAX_PULL[name]).location = (i * 0.8, 1.6, 1.0)
    made[name] = (len(ob.data.polygons), tuple(round(v, 2) for v in ob.dimensions))
print(made)
