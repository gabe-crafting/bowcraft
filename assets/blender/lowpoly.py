import bpy, bmesh, math
from mathutils import Vector, Matrix

_mats = {}
PARTS = []
# Where each named part was placed, so a skeleton can be fitted to the parts later.
LIMBS, BOXES, CYLS = {}, {}, {}


def mat(name, rgb, rough=0.85, metal=0.0):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    col = (rgb[0], rgb[1], rgb[2], 1.0)
    bsdf.inputs[0].default_value = col
    for inp in bsdf.inputs:
        if inp.name == "Roughness":
            inp.default_value = rough
        if inp.name == "Metallic":
            inp.default_value = metal
    m.diffuse_color = col
    return m


def hexc(h):
    def lin(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin((h >> 16) & 255), lin((h >> 8) & 255), lin(h & 255))


def _obj(name, bm, material, coll):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = False
    PARTS.append(ob)
    return ob


def box(coll, name, size, loc, material, top=(1, 1), rot=(0, 0, 0), shift=(0, 0)):
    """Box of size (x, y, z) centred at loc. `top` scales the top face (taper),
    `shift` slides the top face in x/y."""
    BOXES[name] = (Vector(size), Vector(loc))
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        if v.co.z > 0:
            v.co.x = v.co.x * top[0] + shift[0] / size[0]
            v.co.y = v.co.y * top[1] + shift[1] / size[1]
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    m = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _obj(name, bm, material, coll)


def cyl(coll, name, r1, r2, depth, loc, material, verts=6, rot=(0, 0, 0), scale=(1, 1, 1)):
    CYLS[name] = (Vector(loc), depth)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r1, radius2=r2, depth=depth)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    m = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _obj(name, bm, material, coll)


def limb(coll, name, a, b, r1, r2, material, verts=6, flat=(1, 1)):
    """Tapered cylinder from point a (radius r1) to point b (radius r2)."""
    a, b = Vector(a), Vector(b)
    LIMBS[name] = (a.copy(), b.copy())
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r1, radius2=r2, depth=d.length)
    for v in bm.verts:
        v.co.x *= flat[0]
        v.co.y *= flat[1]
        v.co.z += d.length / 2
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    m = Matrix.Translation(a) @ q.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _obj(name, bm, material, coll)


def ball(coll, name, r, loc, material, seg=8, rings=6, scale=(1, 1, 1), rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
    m = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, 'Z') @ Matrix.Rotation(rot[1], 4, 'Y') @ Matrix.Rotation(rot[0], 4, 'X')
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _obj(name, bm, material, coll)


def cone(coll, name, a, b, r, material, verts=4, flat=(1, 1)):
    return limb(coll, name, a, b, r, 0.0, material, verts, flat)


def sym(fn, coll, name, *args, **kw):
    """Build a part on the right (+x... actually character's left, -x is right) and mirror it."""
    left = fn(coll, name + ".L", *args, **kw)
    right = left.copy()
    right.data = left.data.copy()
    right.name = name + ".R"
    coll.objects.link(right)
    for v in right.data.vertices:
        v.co.x = -v.co.x
    right.data.flip_normals()
    PARTS.append(right)
    return left, right


def new_collection(name):
    LIMBS.clear(); BOXES.clear(); CYLS.clear(); PARTS.clear()
    c = bpy.data.collections.get(name)
    if c:
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    return c


def finish(coll, name, offset_x):
    """Join every part of this character into one object with origin at the feet."""
    parts = [o for o in coll.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0001)
    bpy.ops.object.mode_set(mode='OBJECT')
    ob.location.x = offset_x
    PARTS.clear()
    return ob
