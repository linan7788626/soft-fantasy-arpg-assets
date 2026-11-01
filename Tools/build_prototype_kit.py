"""Build metadata only: no generated image pixels are altered."""
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import label,find_objects
import hashlib,json,uuid
ROOT=Path(__file__).resolve().parents[1]
KIT=ROOT/'Assets/NLI_Prototype_Kit'
rows=[('floor','Floor_Limestone.png'),('wall','Wall_Horizontal.png'),('sidewall','Wall_Vertical_v2.png'),('pillar','Pillar_Connector_v2.png'),('door_closed','Door_Closed_v2.png'),('door_open','Door_Open_v2.png'),('crate','Crate_Push.png'),('plate','Pressure_Plate.png')]
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
p=KIT/'Sprites/Hero_Walk_East_6.png';im=Image.open(p);a=np.array(im.getchannel('A'));labels,n=label(a>128)
regions=[]
for sl in find_objects(labels):
 if sl and (a[sl]>128).sum()>2000:
  y,x=sl;regions.append([x.start,y.start,x.stop,y.stop])
regions.sort();assert len(regions)==6
frames=[]
for i,(x0,y0,x1,y1) in enumerate(regions):
 # Six separate silhouettes, not presumed equal cells. Metadata aligns helmet and feet.
 r=[max(0,x0-4),max(0,y0-4),min(im.width,x1+4)-max(0,x0-4),min(im.height,y1+4)-max(0,y0-4)]
 head=(a[y0+100:y0+180,x0:x1]>128);ys,xs=np.where(head)
 anchor=(int(xs.min())+int(xs.max()))/2+x0
 frames.append({'index':i,'rect':r,'pivot':[(anchor-r[0])/r[2],(y1-r[1])/r[3]],'foot_y':y1,'core_bbox':[x0,y0,x1,y1]})
walk={'file':'Sprites/'+p.name,'direction':'east','fps':8,'frames':frames,'native_size':list(im.size),'sha256':sha(p),'note':'向右六帧循环测试；逐帧区域与脚底锚点已记录。当前不是四方向完整动画包。'}
m={'version':'0.1.0-prototype','style_code':'NL-ARPG-SOFT-766DF2B7','pixel_postprocessing':'none','assets':assets,'walk':walk,'assembly':'Floor repeat; independent perimeter segments; connector pillars at corners. Render rectangles do not rewrite source PNGs.','limits':['Floor is a repeating prototype texture, not a mathematically edge-identical autotile set.','Sidewall mirror is a preview assembly transform; lighting is not recomputed.','Unity import and production animation quality require engine-specific acceptance.']}
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
print('8 modules +6 walking frames; native bytes preserved')
