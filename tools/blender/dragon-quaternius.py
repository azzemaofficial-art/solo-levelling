# Drago volante di DragonSky (public/dragons/flyer.webp).
# Modello: "Dragon Evolved" di Quaternius (CC0) — https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6
# Animazione originale del rig: CharacterArmature|Fast_Flying (20 frame @24fps), campionata a 30 fotogrammi.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/dragon-quaternius.py -- \
#     dragon-evolved.glb /tmp/dragon/f_ 30 420 "-0.72,-0.62,0.08" ""
#   poi i PNG → WebP animato (PIL: duration=28 ms, loop=0, quality=78, ritaglio sul drago).

# Drago Quaternius (CC0, rig + animazione di volo) ricolorato nella palette dell'app e
# renderizzato a sfondo trasparente. Uso: -- src.glb outprefix frames res view(x,y,z) [only]
import bpy, sys, math, mathutils
a=sys.argv[sys.argv.index('--')+1:]
src,out,frames,res=a[0],a[1],int(a[2]),int(a[3])
view=[float(v) for v in a[4].split(',')]
only=[int(v) for v in a[5].split(',')] if len(a)>5 and a[5] else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc=bpy.context.scene
arm=[o for o in sc.objects if o.type=='ARMATURE'][0]
act=bpy.data.actions['CharacterArmature|Fast_Flying']
arm.animation_data_create(); arm.animation_data.action=act
if hasattr(arm.animation_data,'action_slot') and act.slots: arm.animation_data.action_slot=act.slots[0]
# palette: corpo viola profondo, ali/ventre magenta scuro, corna oro, occhi che brillano
def mat(name, color, rough=0.45, metal=0.0, emit=None, strength=0.0):
    m=bpy.data.materials.get(name)
    if not m: return
    b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=(*color,1); b.inputs['Roughness'].default_value=rough; b.inputs['Metallic'].default_value=metal
    if emit:
        b.inputs['Emission Color'].default_value=(*emit,1); b.inputs['Emission Strength'].default_value=strength
mat('Dragon_Main',(0.10,0.035,0.24),0.42,0.15)
mat('Dragon_Secondary',(0.42,0.06,0.30),0.5,emit=(0.9,0.2,0.6),strength=0.35)
mat('Dragon_Horn',(0.95,0.72,0.30),0.3,0.6)
mat('Eye_White',(0.9,0.12,0.5),0.2,emit=(1,0.15,0.55),strength=0.9)
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=sc.render.resolution_y=res; sc.render.film_transparent=True
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=(0.35,0.3,0.65,1); bg.inputs[1].default_value=0.32
def light(name,energy,color,rot):
    L=bpy.data.lights.new(name,'SUN'); L.energy=energy; L.color=color
    ob=bpy.data.objects.new(name,L); sc.collection.objects.link(ob); ob.rotation_euler=rot
light('key',2.2,(0.9,0.85,1),(0.9,0.1,0.9)); light('rim_pink',8.0,(1,0.4,0.85),(-1.9,0.4,-2.4)); light('rim_lav',6.0,(0.6,0.55,1),(-1.6,-0.6,2.6))
# inquadratura: bbox della mesh a metà animazione
sc.frame_set(5)
dg=bpy.context.evaluated_depsgraph_get()
pts=[]
for o in sc.objects:
    if o.type=='MESH':
        e=o.evaluated_get(dg); pts+= [e.matrix_world@mathutils.Vector(c) for c in e.bound_box]
mn=mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); mx=mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
c=(mn+mx)/2; size=max(mx-mn)
cam=bpy.data.cameras.new('c'); co=bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co
cam.type='ORTHO'; cam.ortho_scale=size*1.45
d=mathutils.Vector(view).normalized(); co.location=c+d*size*4
co.rotation_euler=(c-co.location).to_track_quat('-Z','Y').to_euler()
start,end=act.frame_range
for i in range(frames):
    if only and i not in only: continue
    f=start+(end-start)*i/frames
    sc.frame_set(int(f), subframe=f-int(f))
    sc.render.filepath=f'{out}{i:02d}.png'; bpy.ops.render.render(write_still=True)
