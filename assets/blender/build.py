# Rebuild every asset in the open .blend and export the .glb files.
# In Blender: Scripting tab -> open this file -> Run Script.
import bpy, os

HERE = r"C:\Users\gabe\Projects\Games\bounty-hunter\assets\blender"
ASSETS = os.path.dirname(HERE)


def run(name):
    exec(open(os.path.join(HERE, name + ".py")).read(), {"__name__": "__main__"})


for script in ("bows", "shortbow", "ninja", "elf", "longbowman", "hunter", "anim", "preview"):
    run(script)

sc = bpy.context.scene
sc.frame_set(0)


def export(objs, active, path, **kw):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = active
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_skins=True, **kw)


for n, fn in {"Ninja": "ninja", "ElfGirl": "elf_girl", "Longbowman": "longbowman", "Hunter": "hunter"}.items():
    rig, mesh = bpy.data.objects[n + "_Rig"], bpy.data.objects[n]
    for t in rig.animation_data.nla_tracks:
        t.mute = False
    x = rig.location.x
    rig.location.x = 0
    export([rig, mesh], rig, os.path.join(ASSETS, "characters", fn + ".glb"),
           export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True)
    rig.location.x = x
    # leave the viewport showing the 45 degree shot
    for t in rig.animation_data.nla_tracks:
        t.mute = not t.name.endswith("45")

for n in ("Shortbow", "Longbow", "Recurve"):
    rig, mesh = bpy.data.objects[n + "_Rig"], bpy.data.objects[n]
    loc = rig.location.copy()
    rig.location = (0, 0, 0)
    for t in rig.animation_data.nla_tracks:
        t.mute = False
    export([rig, mesh], rig, os.path.join(ASSETS, "weapons", n.lower() + ".glb"), export_extras=True,
           export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True)
    # keep the display bows relaxed in the viewport
    for t in rig.animation_data.nla_tracks:
        t.mute = True
    rig.location = loc

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.ops.wm.save_mainfile()
print("built and exported")
