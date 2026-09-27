# Drago volante per DragonSky (public/dragons/astral.webp), generato da un modello statico.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/dragon-flap.py -- \
#     public/models/custom/floor10-astral-dragon.glb /tmp/dragon/f 16 480 "0.62,-0.78,0.16" ""
#   poi i 16 PNG → WebP animato (PIL: duration=56 ms, loop=0, quality=80, ritaglio sul drago).
#
# Il modello (Tripo) non ha scheletro: le ali si muovono ruotando i vertici lontani dal corpo
# attorno alle spalle, con un peso sfumato che lascia ferma la coda arrotolata.
# Battito d'ali procedurale su una mesh statica (Tripo, senza rig) + render a sfondo trasparente.
import bpy, sys, math, numpy as np, mathutils
args=sys.argv[sys.argv.index('--')+1:]
src, out, frames, res = args[0], args[1], int(args[2]), int(args[3])
view = [float(v) for v in args[4].split(',')] if len(args)>4 else [0.85,-0.55,0.18]
only = [int(v) for v in args[5].split(',')] if len(args)>5 and args[5] else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
o=[o for o in bpy.context.scene.objects if o.type=='MESH'][0]
me=o.data; n=len(me.vertices); base=np.empty(n*3); me.vertices.foreach_get('co',base); base=base.reshape(-1,3)
x,y,z=base[:,0],base[:,1],base[:,2]
def smooth(a,b,v): t=np.clip((v-a)/(b-a),0,1); return t*t*(3-2*t)
ay=np.abs(y)
# peso ala: cresce allontanandosi dal corpo; la coda (bassa e vicino al centro) resta ferma
# soglia laterale che dipende dall'altezza: in alto l'ala parte dalle spalle (0.15),
# in basso solo oltre la coda arrotolata (0.29), così la coda resta ferma
y0=0.15+0.14*smooth(0.08,-0.16,z)
wgt=smooth(y0,y0+0.12,ay)
hinge_y, hinge_z = 0.14, 0.16
side=np.sign(y)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x=sc.render.resolution_y=res; sc.render.film_transparent=True
sc.view_settings.view_transform='AgX' if 'AgX' in [i.identifier for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=(0.35,0.3,0.6,1); bg.inputs[1].default_value=0.9
def light(name,kind,energy,color,rot,size=None):
    L=bpy.data.lights.new(name,kind); L.energy=energy; L.color=color
    ob=bpy.data.objects.new(name,L); sc.collection.objects.link(ob); ob.rotation_euler=rot; return ob
light('key','SUN',3.2,(1,0.95,1),(0.9,0.1,0.9))
light('rim_pink','SUN',6.0,(1,0.45,0.85),(-1.9,0.4,-2.4))   # controluce rosa da dietro
light('rim_lav','SUN',4.0,(0.65,0.6,1),(-1.6,-0.6,2.6))     # controluce lavanda
cam=bpy.data.cameras.new('c'); co=bpy.data.objects.new('c',cam); sc.collection.objects.link(co); sc.camera=co
cam.type='ORTHO'; cam.ortho_scale=1.25
d=mathutils.Vector(view).normalized(); co.location=d*4
co.rotation_euler=(mathutils.Vector((0,0,0.02))-co.location).to_track_quat('-Z','Y').to_euler()
for f in range(frames):
    if only and f not in only: continue
    t=f/frames
    # colpo in giù più rapido (40% del ciclo) e risalita più lenta, come un volatile vero;
    # la fase è continua e ciclica, quindi il loop non ha scatti
    warp=t+0.08*math.sin(2*math.pi*t)
    ph=2*math.pi*warp
    ang=math.radians(32)*math.cos(ph) + math.radians(6)       # 0 = ali in alto, 0.5 = ali in basso
    fold=math.radians(9)*max(0,-math.cos(ph))**1.5              # in basso le punte si chiudono un po'
    a=ang*wgt + fold*wgt**2
    dy=np.abs(y)-hinge_y; dz=z-hinge_z
    c,s=np.cos(a),np.sin(a)
    ny=hinge_y+dy*c - dz*s; nz=hinge_z+dy*s + dz*c
    new=np.c_[x, side*ny, nz]
    # il corpo sale un filo quando le ali spingono giù
    new[:,2]-= 0.010*math.cos(ph)   # il corpo si alza quando le ali spingono giù (cos=-1)
    me.vertices.foreach_set('co',new.ravel()); me.update()
    sc.render.filepath=f'{out}{f:02d}.png'; bpy.ops.render.render(write_still=True)
