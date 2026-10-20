# Shared humanoid skeleton for the low-poly characters. Every character gets the same bone
# names and the same bone roll convention, so one set of clips plays on all of them.
# Each body part is a rigid piece bound 100% to a single bone.
import bpy, re
from mathutils import Vector, Matrix

FOOT = {"foot", "sole", "ankle_strap"}
SHIN = {"shin", "boot", "calf", "boot_cuff", "calf_muscle"}
THIGH = {"thigh"}
UPPER = {"upperarm", "shoulder", "bicep", "sleeve_cuff"}
FORE = {"forearm", "bracer", "cuff", "forearm_muscle"}
HAND = {"hand"}
NECK = {"neck", "choker"}
HEAD = {"head", "hood", "hood_crown", "eye", "eyeslit", "ear", "bangs", "fringe", "lock", "circlet", "chin",
        "lips", "nose", "brow", "jaw_beard", "chinstrap", "stubble", "sideburn", "brim", "crown",
        "crown_crease", "hat_band", "headband", "band_knot"}
HEAD_PREFIX = ("hair", "pony", "helm", "band_tail")


def _base(name):
    side = ""
    m = re.match(r"^(.*)\.(L|R)$", name)
    if m:
        name, side = m.group(1), m.group(2)
    return re.sub(r"\d+$", "", name), side


def bone_for(name, centroid_z, hip_z, neck_z):
    base, side = _base(name)
    sfx = "." + side if side else ".L"
    for group, bone in ((FOOT, "foot"), (SHIN, "shin"), (THIGH, "thigh"), (UPPER, "upperarm"),
                        (FORE, "forearm"), (HAND, "hand")):
        if base in group:
            return bone + sfx
    if base in NECK:
        return "neck"
    if base in HEAD or base.startswith(HEAD_PREFIX):
        return "head"
    f = (centroid_z - hip_z) / (neck_z - hip_z)
    return "hips" if f < 0.3 else "spine" if f < 0.6 else "chest"


def rig_character(coll, name, offset_x, scale=1.0):
    S = scale
    sc = lambda v: Vector(v) * S
    thigh_a, thigh_b = (sc(v) for v in LIMBS["thigh.L"])
    knee, hip_j = thigh_a, thigh_b
    shin_like = [LIMBS[k][0] for k in LIMBS if k.endswith(".L") and _base(k)[0] in ("shin", "boot")]
    ankle = sc(min(shin_like, key=lambda v: v.z))
    fsize, floc = BOXES["foot.L"]
    toe = sc((floc.x, floc.y - fsize.y / 2, floc.z))
    shoulder, elbow = (sc(v) for v in LIMBS["upperarm.L"])
    wrist = sc(LIMBS["forearm.L"][1])
    hsize, hloc = BOXES["hand.L"]
    hloc = sc(hloc)
    hand_tip = hloc + (hloc - wrist).normalized() * hsize.z * S / 2
    nloc, ndepth = CYLS["neck"]
    neck_bot = sc((0, 0, nloc.z - ndepth / 2))
    neck_top = sc((0, 0, nloc.z + ndepth / 2))
    head_top = neck_top + Vector((0, 0, 0.22 * S))
    hip_z = hip_j.z

    parts = [o for o in coll.objects if o.type == 'MESH']
    for o in parts:
        if S != 1.0:
            o.data.transform(Matrix.Scale(S, 4))
        c = sum((v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)
        vg = o.vertex_groups.new(name=bone_for(o.name, c.z, hip_z, neck_bot.z))
        vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    mesh_ob = finish(coll, name, 0.0)

    arm_data = bpy.data.armatures.new(name + "_Rig")
    arm = bpy.data.objects.new(name + "_Rig", arm_data)
    coll.objects.link(arm)
    arm.show_in_front = True
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    FWD, UP = Vector((0, -1, 0)), Vector((0, 0, 1))

    def bone(n, head, tail, parent=None, connect=False, roll_axis=FWD, deform=True):
        b = eb.new(n)
        b.head, b.tail = head, tail
        b.align_roll(roll_axis)
        if parent:
            b.parent = eb[parent]
            b.use_connect = connect
        b.use_deform = deform
        return b

    spine_len = neck_bot.z - hip_z
    p0 = Vector((0, 0, hip_z))
    p1 = p0 + Vector((0, 0, spine_len * 0.3))
    p2 = p0 + Vector((0, 0, spine_len * 0.6))
    bone("hips", p0, p1)
    bone("spine", p1, p2, "hips", True)
    bone("chest", p2, neck_bot, "spine", True)
    bone("neck", neck_bot, neck_top, "chest", True)
    bone("head", neck_top, head_top, "neck", True)
    m = Vector((-1, 1, 1))
    for side, k in (("L", Vector((1, 1, 1))), ("R", m)):
        f = lambda v: Vector((v.x * k.x, v.y, v.z))
        bone("thigh." + side, f(hip_j), f(knee), "hips")
        bone("shin." + side, f(knee), f(ankle), "thigh." + side, True)
        bone("foot." + side, f(ankle), f(toe), "shin." + side, True, roll_axis=UP)
        bone("upperarm." + side, f(shoulder), f(elbow), "chest")
        bone("forearm." + side, f(elbow), f(wrist), "upperarm." + side, True)
        bone("hand." + side, f(wrist), f(hand_tip), "forearm." + side, True)
    # Socket for the bow: rest frame equals the bow model's own frame, so a bow added as a
    # child of this bone with an identity transform sits in the hand the right way round.
    g = (eb["hand.L"].head + eb["hand.L"].tail) / 2
    bone("grip.L", g, g + Vector((0, 0.1, 0)), "hand.L", roll_axis=UP, deform=False)
    # where the draw-hand fingers hold the string; the bow's nock bone follows it
    t = eb["hand.R"].tail.copy()
    bone("nock.R", t, t + Vector((0, 0, -0.05)), "hand.R", deform=False)
    bpy.ops.object.mode_set(mode='OBJECT')

    mesh_ob.parent = arm
    mod = mesh_ob.modifiers.new("Armature", 'ARMATURE')
    mod.object = arm
    arm.location.x = offset_x
    return arm, mesh_ob
