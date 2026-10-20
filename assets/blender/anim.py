# Bow shots, generated from parameters. Each clip keys draw -> hold -> release -> recover on
# the shared skeleton. The longbow has clips at several aim pitches with identical timing, so
# the game can play them together and blend by weight for any pitch in between; the shortbow
# only shoots level, so it has a single quicker clip.
# Characters differ only in their FORM entry. The longbowman shoots with real longbow
# technique; the other three keep the looser draw they have always had.
import bpy, math
from mathutils import Vector, Matrix, Quaternion

FPS = 24
# frame, draw phase ('ready' | 'full' | 'release' | 'follow'), bow-arm drop in degrees
LONGBOW_KEYS = ((0, "ready", 0), (5, "full", 0), (7, "full", 0), (8, "release", 0), (11, "follow", 4), (20, "ready", 0))
SHORTBOW_KEYS = ((0, "ready", 0), (3, "full", 0), (4, "full", 0), (5, "release", 0), (8, "follow", 3), (14, "ready", 0))
# clip name, bow (sets where the string rests), aim pitch in degrees, keys
CLIPS = [(f"LongbowShoot_Aim{p:02d}", "Longbow", p, LONGBOW_KEYS) for p in (0, 45, 80)]
CLIPS.append(("ShortbowShoot", "Shortbow", 0, SHORTBOW_KEYS))
YAW = {"hips": -20, "spine": -15, "chest": -20}      # turn side-on, bow shoulder toward the target
LEAN = {"hips": 0.08, "spine": 0.1, "chest": 0.12}   # share of the pitch taken by leaning back
HEAD_YAW, HEAD_LOOK = 48, 0.35                       # head turns back to the target and looks up
OPEN = {"hips": 1.0, "spine": 0.5, "chest": 0.0}     # who takes an opened stance: the legs, not the chest
# How far the back has finished the draw in each phase. It carries past the release, because
# the draw keeps expanding through the shot instead of collapsing the moment the string goes.
DRAW = {"ready": 0.15, "full": 1.0, "release": 1.08, "follow": 1.12}

# A character's shooting form. The default is the draw every character used before.
FORM_DEFAULT = {
    "open": 0.0,          # degrees the hips turn further side-on, taking twist out of the spine
    "front_foot": False,  # bow-side foot holds its square angle, so the stance opens instead
    "lean": 1.0,          # share of LEAN taken when the shot is pitched up
    "close": 0.0,         # degrees the chest closes further as the back finishes the draw
    "anchor": (0.06, 0.07, -0.01),  # from the head bone: forward, toward the string side, up
    "pole": (0.7, 0.6, 0.0),        # draw elbow hint: out to the side, up, and back along the shot
    "release": (0.05, 0.05, 0.0),   # draw hand once the string is gone: back, out, up
    "follow": (0.06, 0.07, -0.04),
    "drop": 1.0,          # share of the key's bow-arm drop that actually happens
}
# Longbow form: hips opened and the front foot turned toward the target, spine stacked rather
# than leaning away from the draw, the back closing through the shot, the drawing elbow behind
# the arrow instead of flared out, an anchor on the jaw, and a bow arm that holds its line
# while the string hand slides straight back along the neck.
FORM_LONGBOW = dict(FORM_DEFAULT, open=-18, front_foot=True, lean=0.55, close=16,
                    anchor=(0.07, 0.055, 0.012), pole=(1.1, -0.3, 0.45),
                    release=(0.06, 0.02, 0.012), follow=(0.1, 0.03, 0.022), drop=0.0)
FORMS = {"Longbowman": FORM_LONGBOW}

TORSO = ("hips", "spine", "chest", "neck", "head")
ORDER = TORSO + ("thigh.L", "shin.L", "foot.L", "thigh.R", "shin.R", "foot.R",
                 "upperarm.L", "forearm.L", "hand.L", "grip.L", "upperarm.R", "forearm.R", "hand.R")


def rz(deg):
    return Matrix.Rotation(math.radians(deg), 3, 'Z')


def rx(rad):
    return Matrix.Rotation(rad, 3, 'X')


def aim_frame(y_dir, z_hint):
    """Rotation whose Y axis is y_dir and Z axis is as close to z_hint as possible."""
    y = y_dir.normalized()
    z = (z_hint - y * z_hint.dot(y)).normalized()
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


def two_bone(s, t, l1, l2, pole):
    d = t - s
    dist = min(max(d.length, abs(l1 - l2) + 1e-4), (l1 + l2) * 0.999)
    e = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(l1 * l1 - a * a, 0))
    p = (pole - e * pole.dot(e)).normalized()
    elbow = s + e * a + p * h
    return elbow, s + e * dist


def pose(arm, pitch_deg, phase, drop, string_rest, form):
    pose_bones = arm.pose.bones
    for pb in pose_bones:
        pb.rotation_mode = 'QUATERNION'
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    th = math.radians(pitch_deg)
    d = Vector((0, -math.cos(th), math.sin(th)))
    rest = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}

    def place(name, rot3):
        bpy.context.view_layer.update()
        pb = pose_bones[name]
        m = rot3.to_4x4()
        m.translation = pb.head
        pb.matrix = m
        pb.location = (0, 0, 0)

    yaw = lean = 0.0
    closed = form["close"] * DRAW[phase]
    for name in ("hips", "spine", "chest"):
        yaw += YAW[name]
        lean -= LEAN[name] * th * form["lean"]
        turn = form["open"] * OPEN[name] - (closed if name == "chest" else 0.0)
        place(name, rx(lean) @ rz(yaw + turn) @ rest[name])
    if form["front_foot"]:
        # the rear foot turns with the opened hips; the bow-side foot keeps the angle it had,
        # so a line across the toes still points at the target
        place("foot.L", rz(YAW["hips"]) @ rest["foot.L"])
    # the head is placed in world terms, so it stays on the target whatever the hips did
    place("neck", rx(lean) @ rz(yaw + HEAD_YAW * 0.4) @ rest["neck"])
    w_head = rx(lean - HEAD_LOOK * th) @ rz(yaw + HEAD_YAW)
    place("head", w_head @ rest["head"])
    bpy.context.view_layer.update()

    bones = arm.data.bones
    l1, l2 = bones["upperarm.L"].length, bones["forearm.L"].length
    hand_half = bones["hand.L"].length / 2
    # the arrow runs from the anchor at the jaw to the bow grip along the aim direction,
    # so a 0 degree shot is level whatever the character's proportions
    head_pb = pose_bones["head"]
    fwd = w_head @ Vector((0, -1, 0))
    right = w_head @ Vector((-1, 0, 0))
    ax, ay, az = form["anchor"]
    anchor = head_pb.head + fwd * ax + right * ay + Vector((0, 0, az))
    drop *= form["drop"]
    d_bow = (rx(-math.radians(drop)) @ d) if drop else d
    s_l = pose_bones["upperarm.L"].head.copy()
    reach = (l1 + l2) * 0.97 + hand_half
    v = anchor - s_l
    vd = v.dot(d)
    draw_len = -vd + math.sqrt(max(vd * vd - (v.length_squared - reach * reach), 0))
    grip_pos = anchor + d_bow * draw_len
    wrist_target = grip_pos - (grip_pos - s_l).normalized() * hand_half
    elbow, wrist = two_bone(s_l, wrist_target, l1, l2, Vector((1, 0, -0.3)))
    side = d_bow.cross(Vector((1, 0, 0)))
    place("upperarm.L", aim_frame(elbow - s_l, side))
    place("forearm.L", aim_frame(wrist - elbow, side))
    place("hand.L", aim_frame(grip_pos - wrist, side))
    # bow socket: bow's +Y faces the archer, +Z runs up the bow, in the plane of the shot
    up = Vector((0, 0, 1))
    place("grip.L", aim_frame(-d_bow, up - d_bow * up.dot(d_bow)))
    bpy.context.view_layer.update()
    grip = pose_bones["grip.L"].head.copy()

    # draw hand: fingers on the string near the bow, at the jaw when drawn, flicked back on release
    hand_r = bones["hand.R"].length / 2
    back = (anchor - grip).normalized()
    rb, rr, ru = form["release"]
    fb, fr, fu = form["follow"]
    target = {
        "ready": grip + back * (string_rest + 0.015 + hand_r),
        "full": anchor,
        "release": anchor + back * rb + right * rr + Vector((0, 0, ru)),
        "follow": anchor + back * fb + right * fr + Vector((0, 0, fu)),
    }[phase]
    s_r = pose_bones["upperarm.R"].head.copy()
    l1r, l2r = bones["upperarm.R"].length, bones["forearm.R"].length
    # elbow out to the side and up. A hint along the arrow line would be (anti)parallel to
    # the shoulder->hand line at full draw and leave the elbow free to flip between keys.
    pr, pu, pw = form["pole"]
    pole = right * pr + Vector((0, 0, pu)) - d_bow * pw
    elbow, wrist = two_bone(s_r, target + back * hand_r, l1r, l2r, pole)
    place("upperarm.R", aim_frame(elbow - s_r, pole))
    place("forearm.R", aim_frame(wrist - elbow, pole))
    place("hand.R", aim_frame(-back, pole))
    bpy.context.view_layer.update()


def build_clips(arm, form):
    ad = arm.animation_data or arm.animation_data_create()
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    made = []
    for clip, bow, pitch, keys in CLIPS:
        old = bpy.data.actions.get(f"{arm.name}|{clip}")
        if old:
            bpy.data.actions.remove(old)
        act = bpy.data.actions.new(f"{arm.name}|{clip}")
        ad.action = act
        prev = {}
        for frame, phase, drop in keys:
            pose(arm, pitch, phase, drop, STRING_REST[bow], form)
            for pb in arm.pose.bones:
                q = pb.rotation_quaternion.copy()
                if pb.name in prev and prev[pb.name].dot(q) < 0:
                    q.negate()
                pb.rotation_quaternion = q
                prev[pb.name] = q
                pb.keyframe_insert("rotation_quaternion", frame=frame)
        ad.action = None
        track = ad.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip, 0, act)
        if hasattr(strip, "action_slot") and act.slots:
            strip.action_slot = act.slots[0]
        made.append(clip)
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    return made


def string_rest(bow):
    """How far the bow's string sits behind its handle at rest."""
    me = bpy.data.objects[bow].data
    si = [i for i, m in enumerate(me.materials) if m.name == "Bow_String"][0]
    return max(me.vertices[v].co.y for p in me.polygons if p.material_index == si for v in p.vertices)


STRING_REST = {bow: string_rest(bow) for bow in {c[1] for c in CLIPS}}

scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, LONGBOW_KEYS[-1][0]
result = {}
for n in ("Ninja", "ElfGirl", "Longbowman", "Hunter"):
    result[n] = build_clips(bpy.data.objects[n + "_Rig"], FORMS.get(n, FORM_DEFAULT))
print(result)
