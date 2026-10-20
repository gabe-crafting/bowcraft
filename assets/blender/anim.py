# Longbow shot, generated from parameters. For each aim pitch it keys a draw -> hold ->
# release -> recover clip on the shared skeleton. Clips at several pitches have identical
# timing, so the game can play them together and blend by weight for any pitch in between.
import bpy, math
from mathutils import Vector, Matrix, Quaternion

FPS = 24
PITCHES = (0, 45, 80)
# frame, draw phase ('ready' | 'full' | 'release' | 'follow'), bow-arm drop in degrees
KEYS = ((0, "ready", 0), (5, "full", 0), (7, "full", 0), (8, "release", 0), (11, "follow", 4), (20, "ready", 0))
YAW = {"hips": -20, "spine": -15, "chest": -20}      # turn side-on, bow shoulder toward the target
LEAN = {"hips": 0.08, "spine": 0.1, "chest": 0.12}   # share of the pitch taken by leaning back
HEAD_YAW, HEAD_LOOK = 48, 0.35                       # head turns back to the target and looks up

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


def pose(arm, pitch_deg, phase, drop):
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
    for name in ("hips", "spine", "chest"):
        yaw += YAW[name]
        lean -= LEAN[name] * th
        place(name, rx(lean) @ rz(yaw) @ rest[name])
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
    anchor = head_pb.head + fwd * 0.06 + right * 0.07 - Vector((0, 0, 0.01))
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
    target = {
        "ready": grip + back * (STRING_REST + 0.015 + hand_r),
        "full": anchor,
        "release": anchor + back * 0.05 + right * 0.05,
        "follow": anchor + back * 0.06 + right * 0.07 - Vector((0, 0, 0.04)),
    }[phase]
    s_r = pose_bones["upperarm.R"].head.copy()
    l1r, l2r = bones["upperarm.R"].length, bones["forearm.R"].length
    # elbow out to the side and up. A hint along the arrow line would be (anti)parallel to
    # the shoulder->hand line at full draw and leave the elbow free to flip between keys.
    pole = right * 0.7 + Vector((0, 0, 0.6))
    elbow, wrist = two_bone(s_r, target + back * hand_r, l1r, l2r, pole)
    place("upperarm.R", aim_frame(elbow - s_r, pole))
    place("forearm.R", aim_frame(wrist - elbow, pole))
    place("hand.R", aim_frame(-back, pole))
    bpy.context.view_layer.update()


def build_clips(arm):
    ad = arm.animation_data or arm.animation_data_create()
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    made = []
    for pitch in PITCHES:
        clip = f"LongbowShoot_Aim{pitch:02d}"
        old = bpy.data.actions.get(f"{arm.name}|{clip}")
        if old:
            bpy.data.actions.remove(old)
        act = bpy.data.actions.new(f"{arm.name}|{clip}")
        ad.action = act
        prev = {}
        for frame, phase, drop in KEYS:
            pose(arm, pitch, phase, drop)
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


# how far the longbow's string sits behind its handle at rest
_lb = bpy.data.objects["Longbow"]
_si = [i for i, m in enumerate(_lb.data.materials) if m.name == "Bow_String"][0]
STRING_REST = max(_lb.data.vertices[v].co.y for p in _lb.data.polygons if p.material_index == _si for v in p.vertices)

scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, KEYS[-1][0]
result = {}
for n in ("Ninja", "ElfGirl", "Longbowman", "Hunter"):
    result[n] = build_clips(bpy.data.objects[n + "_Rig"])
print(result)
