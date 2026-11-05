"""Build metadata only: no generated image pixels are altered."""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import label,find_objects
import hashlib,json,uuid
from wall_geometry import make_walls
ROOT=Path(__file__).resolve().parents[1]
KIT=ROOT/'Assets/NLI_Prototype_Kit'
rows=[('floor','Floor_Limestone.png'),('wall','Wall_Horizontal.png'),('sidewall','Wall_Vertical_v2.png'),('pillar','Pillar_Connector_v2.png'),('wall_cap','Wall_Cap_Soft_v4.png'),('wall_face','Wall_Face_Soft_v4.png'),('door_closed','Door_Leaf_Embedded_v5.png'),('crate','Crate_Push.png'),('plate','Pressure_Plate.png'),('plate_pressed','Pressure_Plate_Pressed.png')]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rect_for(p):
 im=Image.open(p)
 if im.mode!='RGBA':return [0,0,*im.size]
 a=np.array(im.getchannel('A'));ys,xs=np.where(a>=128)
 return [max(0,int(xs.min())-2),max(0,int(ys.min())-2),min(im.width,int(xs.max())+3)-max(0,int(xs.min())-2),min(im.height,int(ys.max())+3)-max(0,int(ys.min())-2)]
assets=[]
for id,name in rows:
 p=KIT/'Sprites'/name;im=Image.open(p)
 rect=rect_for(p)
 if id=='wall':rect[2]=round(rect[2]/4)
 if id=='sidewall':rect[3]=round(rect[3]/4)
 assets.append({'id':id,'file':'Sprites/'+name,'rect':rect,'native_size':list(im.size),'sha256':sha(p),'logical_cell':64,'alpha':im.mode=='RGBA'})
# Only the door leaf is a sprite; opening it exposes the carved wall opening.
def clip_for(filename,direction,count,kind):
 p=KIT/'Sprites'/filename;im=Image.open(p);a=np.array(im.getchannel('A'));labels,n=label(a>128)
 regions=[]
 for sl in find_objects(labels):
  if sl and (a[sl]>128).sum()>2000:
   y,x=sl;regions.append([x.start,y.start,x.stop,y.stop])
 regions.sort();assert len(regions)==count,(filename,regions)
 frames=[]
 head_widths=[]
 for i,(x0,y0,x1,y1) in enumerate(regions):
  # Unequal native silhouette regions; do not crop or rewrite the texture.
  r=[max(0,x0-4),max(0,y0-4),min(im.width,x1+4)-max(0,x0-4),min(im.height,y1+4)-max(0,y0-4)]
  head=(a[y0+100:y0+160,x0:x1]>128);ys,xs=np.where(head)
  anchor=(int(xs.min())+int(xs.max()))/2+x0
  head_widths.append(int(xs.max())-int(xs.min())+1)
  f={'index':i,'rect':r,'pivot':[(anchor-r[0])/r[2],(y1-r[1])/r[3]],'foot_y':y1,'core_bbox':[x0,y0,x1,y1]}
  if kind=='push':
   if direction in ['east','west']:
    xx=x1-18 if direction=='east' else x0+18
    strip=a[y0:y1,xx-5:xx+5]>128;yy,_=np.where(strip)
    contact=[xx,y0+float(np.median(yy))]
   else:contact=[anchor,y0+(y1-y0)*(.44 if direction=='north' else .58)]
   f['contact']=[(contact[0]-r[0])/r[2],(contact[1]-r[1])/r[3]]
  frames.append(f)
 return {'file':'Sprites/'+p.name,'direction':direction,'kind':kind,'fps':8,'idle_frame':1,'pixel_scale':40/float(np.median(head_widths)),'frames':frames,'native_size':list(im.size),'sha256':sha(p),'note':'固定每套图的头盔尺度，保留原生屈膝高度；逐帧脚底锚点与推箱接触点见清单。'}
directions=['east','south','west','north']
walks={d:clip_for(f'Hero_Walk_{d.title()}'+('_v2_6.png' if d in ['north','south'] else '_6.png'),d,6,'walk') for d in directions}
pushes={d:clip_for(f'Hero_Push_{d.title()}_4.png',d,4,'push') for d in directions}
idle_sheet=clip_for('Hero_Idle_Four.png','four',4,'idle')
idles={}
for i,d in enumerate(directions):
 idles[d]={**idle_sheet,'direction':d,'frames':[{**idle_sheet['frames'][i],'index':0}]}
m={'version':'0.2.0-direction-trial','style_code':'NL-ARPG-SOFT-766DF2B7','pixel_postprocessing':'none','assets':assets,'walk':walks['east'],'walks':walks,'mechanisms':{'plate':{'released':'plate','pressed':'plate_pressed','trigger':'crate settled on plate; release after crate leaves','transition_ms':120}},'assembly':'Floor repeat; independent perimeter segments; connector pillars at corners. Render rectangles do not rewrite source PNGs.','limits':['Floor is a repeating prototype texture, not a mathematically edge-identical autotile set.','Sidewall mirror is a preview assembly transform; lighting is not recomputed.','Four-direction walking is a small-batch trial; idle reuses a still walk frame, not a separate breathing cycle.','Unity Editor import is not validated; Godot validation is reported separately.'],'validation':{'browser_report':'../../../Prototypes/DungeonWalk/Validation/report.json','engine_report':'../../../Prototypes/GodotImport/Validation/report.json'}}
m['validation']['visual_report']='Acceptance_2026-11-05_integrated.md'
m['walls']=make_walls(Image.open(KIT/'Sprites/Wall_Cap_Soft_v4.png').size,Image.open(KIT/'Sprites/Wall_Face_Soft_v4.png').size)
m['version']='0.5.0-integrated-room'
m['assembly']='Tall rounded orthographic enclosure; doorway carved into continuous masonry beneath an unbroken wall cap; native door leaf embedded in opening; no source PNG edits.'
m['pushes']=pushes
m['idles']=idles
m['limits']=['Floor and wall materials are not certified edge-identical autotile sets.','Tall foreground walls occlude nearby actors; no gameplay visibility fade is implemented.','Idle is a dedicated static pose, not a breathing loop.','Unity Editor import remains unvalidated.']
(KIT/'Documentation/manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
(ROOT/'Prototypes/DungeonWalk/kit-data.js').write_text('const KIT='+json.dumps(m,ensure_ascii=False)+';\n')
# Conventional Unity sprite metadata for the native textures; calibrated cuts remain explicit in manifest.
template=(ROOT/'Assets/NLI_SoftFantasy_ARPG/Sprites/Characters/Hero_Poses/Hero_Row01_Pose01.png.meta').read_text()
import re
for p in KIT.rglob('*'):
 if p.name.endswith('.meta'):continue
 meta=Path(str(p)+'.meta')
 if meta.exists():continue
 guid=uuid.uuid5(uuid.NAMESPACE_URL,'nli-prototype/'+p.relative_to(ROOT).as_posix()).hex
 if p.is_dir():body=f'fileFormatVersion: 2\nguid: {guid}\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {{}}\n'
 elif p.suffix=='.png':
  body=re.sub(r'^guid: .*$',f'guid: {guid}',template,flags=re.M)
  body=re.sub(r'    spriteID: .*','    spriteID: '+uuid.uuid5(uuid.NAMESPACE_URL,'sprite/'+str(p)).hex,body)
 else:body=f'fileFormatVersion: 2\nguid: {guid}\nDefaultImporter:\n  externalObjects: {{}}\n'
 meta.write_text(body)
print(f'{len(assets)} modules + 24 walk / 16 push / 4 idle frames; native bytes preserved')
