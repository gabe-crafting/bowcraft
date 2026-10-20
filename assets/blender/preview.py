# Preview only (not exported): a rigged longbow and a rigged shortbow in each character's bow
# hand. The string nock follows the draw-hand fingers until the release frame, then snaps back.
# The shortbow shows while the ShortbowShoot NLA track is on, the longbow otherwise.
import bpy
from mathutils import Matrix

CHARS = ("Ninja", "ElfGirl", "Longbowman", "Hunter")
# bow, release frame (matches the keys in anim.py), visible when ShortbowShoot is muted?
BOWS = (("Longbow", 8, True), ("Shortbow", 5, False))
SHORT_TRACK = 'animation_data.nla_tracks["ShortbowShoot"].mute'

sc = bpy.context.scene
prev = bpy.data.collections.get("Preview") or bpy.data.collections.new("Preview")
if prev.name not in sc.collection.children:
    sc.collection.children.link(prev)
for o in list(prev.objects):
    bpy.data.objects.remove(o, do_unlink=True)


def constant_keys(ad):
    if hasattr(ad.action, "fcurves"):
        curves = ad.action.fcurves
    else:
        from bpy_extras import anim_utils
        curves = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot).fcurves
    for fc in curves:
        for k in fc.keyframe_points:
            k.interpolation = 'CONSTANT'


def show_with_track(ob, char_rig, when_muted):
    drv = ob.driver_add("hide_viewport").driver
    drv.type = 'SCRIPTED'
    var = drv.variables.new()
    var.name, var.type = "muted", 'SINGLE_PROP'
    var.targets[0].id_type, var.targets[0].id = 'OBJECT', char_rig
    var.targets[0].data_path = SHORT_TRACK
    drv.expression = "not muted" if when_muted else "muted"


for bow, release, when_muted in BOWS:
    bow_mesh, bow_rig = bpy.data.objects[bow], bpy.data.objects[bow + "_Rig"]
    max_pull = bow_rig["max_pull"]
    for n in CHARS:
        char_rig = bpy.data.objects[n + "_Rig"]
        rig = bpy.data.objects.new(f"Preview{bow}_{n}_Rig", bow_rig.data)
        prev.objects.link(rig)
        rig.parent, rig.parent_type, rig.parent_bone = char_rig, 'BONE', "grip.L"
        rig.matrix_parent_inverse = Matrix.Identity(4)
        rig.location = (0, -char_rig.data.bones["grip.L"].length, 0)  # bone parenting starts at the tail
        mesh = bpy.data.objects.new(f"Preview{bow}_{n}", bow_mesh.data)
        prev.objects.link(mesh)
        mesh.parent = rig
        mesh.modifiers.new("Armature", 'ARMATURE').object = rig
        bpy.context.view_layer.update()  # creates rig.pose
        c = rig.pose.bones["nock"].constraints.new('COPY_LOCATION')
        c.target, c.subtarget = char_rig, "nock.R"
        for frame, value in ((0, 1.0), (release, 0.0)):
            c.influence = value
            c.keyframe_insert("influence", frame=frame)
        constant_keys(rig.animation_data)  # the string snaps back on the release frame
        # limbs bend with the pull, same mapping as the bow's baked Draw clip
        for bn in ("limb_inner.T", "limb_outer.T", "limb_inner.B", "limb_outer.B"):
            pb = rig.pose.bones[bn]
            pb.rotation_mode = 'XYZ'
            bend = 0.24 if "inner" in bn else 0.3  # BEND_INNER, BEND_OUTER in bows.py
            drv = pb.driver_add("rotation_euler", 0).driver
            drv.type = 'SCRIPTED'
            var = drv.variables.new()
            var.name, var.type = "pull", 'TRANSFORMS'
            tgt = var.targets[0]
            tgt.id, tgt.bone_target = rig, "nock"
            tgt.transform_type, tgt.transform_space = 'LOC_Y', 'LOCAL_SPACE'
            drv.expression = f"-{bend} * min(max(pull / {max_pull}, 0), 1)"
        for ob in (rig, mesh):
            show_with_track(ob, char_rig, when_muted)
print("preview bows:", [o.name for o in prev.objects])
