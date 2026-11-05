/* Source pixels are never rewritten. The manifest supplies calibrated source rectangles. */
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),strip=document.querySelector('#frames'),fx=strip.getContext('2d');
const images={},T=64,OX=100,OY=196,IDLE_FRAME=1;
let frame=IDLE_FRAME,playing=false,stepping=false,debug=false,door=false,layout='hall',last=0,acc=0,pushing=null;
let player={x:2,y:5},crate={x:5,y:4},plate={x:7,y:4};const keys=new Set();
let direction='east',plateBlend=0,actualMoving=false;
const walk=()=>KIT.walks[direction];
const selectedClip=()=>({walk:KIT.walks,idle:KIT.idles,push:KIT.pushes})[document.querySelector('#action').value][direction];
function pushState(t=performance.now()){if(!pushing)return null;const elapsed=t-pushing.started,moveTime=elapsed-pushing.approach;return{phase:elapsed<pushing.approach?'approach':moveTime<320?'push':'release',approach:Math.min(1,elapsed/pushing.approach),u:Math.max(0,Math.min(1,moveTime/320)),release:Math.max(0,Math.min(1,(moveTime-320)/100))};}
function action(){return pushing?(pushState().phase==='approach'?'walk':'push'):actualMoving?'walk':(playing||stepping)?document.querySelector('#action').value:'idle';}
const sceneClip=()=>({walk:KIT.walks,idle:KIT.idles,push:KIT.pushes})[action()][direction];
const plateDown=()=>!pushing&&crate.x===plate.x&&crate.y===plate.y;
function face(dx,dy){if(dx||dy){const next=Math.abs(dx)>=Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');if(direction!==next){direction=next;frame=IDLE_FRAME;acc=0;document.querySelector('#direction').value=direction;}}}
const GATE=KIT.walls.gate;
const northWallCells=Array.from({length:12},(_,x)=>x);

const asset=id=>KIT.assets.find(a=>a.id===id);
function sprite(c,id,x,y,w,h,flip=false){const a=asset(id),r=a.rect;c.save();if(flip){c.translate(x+w,y);c.scale(-1,1);x=0;y=0;}c.drawImage(images[id],...r,x,y,w,h);c.restore();}
// Room shape is independent of gate state; the wall gap and collision passage differ.
function room(x,y){return x>=0&&y>=0&&x<12&&y<8&&(layout!=='elbow'||x<6||y<4);}
function floor(x,y){return room(x,y)||(door&&y===-1&&x===GATE.passage);}
function obstacle(x,y){return !floor(x,y)||(layout==='puzzle'&&x===8&&(y<KIT.walls.puzzle_open_rows[0]||y>=KIT.walls.puzzle_open_rows[1]));}
function solid(x,y){const ix=Math.floor(x),iy=Math.floor(y);return obstacle(ix,iy)||(x>crate.x+.08&&x<crate.x+.92&&y>crate.y+.84&&y<crate.y+1)||(pushing&&ix===pushing.from.x&&iy===pushing.from.y);}
function reset(){player={x:2.5,y:5.5};crate={x:5,y:4};plate=layout==='elbow'?{x:4,y:4}:{x:7,y:4};if(layout==='elbow')crate={x:3,y:4};if(layout==='puzzle'){crate={x:5,y:3};plate={x:7,y:3};}door=false;pushing=null;frame=IDLE_FRAME;playing=false;stepping=false;acc=0;direction='east';plateBlend=0;actualMoving=false;document.querySelector('#direction').value=direction;keys.clear();document.querySelector('#play').textContent='动作演示';}
function move(dx,dy){face(dx,dy);const old={...player};if(!solid(player.x+dx,player.y))player.x+=dx;if(!solid(player.x,player.y+dy))player.y+=dy;return Math.hypot(player.x-old.x,player.y-old.y)>0.00001;}
function cratePosition(t=performance.now()){
 if(!pushing)return {...crate};
 const u=pushState(t).u,k=u*u*(3-2*u);
 return {x:pushing.from.x+(pushing.to.x-pushing.from.x)*k,y:pushing.from.y+(pushing.to.y-pushing.from.y)*k};
}
function finishPush(t){
 if(!pushing)return false;
 const state=pushState(t),k=state.u*state.u*(3-2*state.u);
 if(state.phase==='approach'){player.x=pushing.playerFrom.x+(pushing.contactRoot.x-pushing.playerFrom.x)*state.approach;player.y=pushing.playerFrom.y+(pushing.contactRoot.y-pushing.playerFrom.y)*state.approach;}
 else{player.x=pushing.contactRoot.x+(pushing.playerTo.x-pushing.contactRoot.x)*k;player.y=pushing.contactRoot.y+(pushing.playerTo.y-pushing.contactRoot.y)*k;}
 if(state.release===1){pushing=null;door=crate.x===plate.x&&crate.y===plate.y;}
 return !!pushing;
}
function push(){
 if(pushing||Math.hypot(crate.x+.5-player.x,crate.y+.96-player.y)>1.8)return false;
 const dx=crate.x+.5-player.x,dy=crate.y+.96-player.y;
 if(Math.hypot(dx,dy)<.2)return false;
 const nx=crate.x+(Math.abs(dx)>=Math.abs(dy)?Math.sign(dx):0),ny=crate.y+(Math.abs(dy)>Math.abs(dx)?Math.sign(dy):0);
 if(obstacle(nx,ny))return false;
 face(nx-crate.x,ny-crate.y);
 stepping=false;
 const clip=KIT.pushes[direction],f=clip.frames[0],r=f.rect,contact=boxContact(crate),scale=clip.pixel_scale;
 const contactRoot={x:(contact.x-(f.contact[0]-f.pivot[0])*r[2]*scale-OX)/T,y:(contact.y-(f.contact[1]-f.pivot[1])*r[3]*scale-OY)/T};
 const approachSteps=Math.max(1,Math.ceil(Math.hypot(contactRoot.x-player.x,contactRoot.y-player.y)*16));
 for(let i=1;i<=approachSteps;i++)if(solid(player.x+(contactRoot.x-player.x)*i/approachSteps,player.y+(contactRoot.y-player.y)*i/approachSteps))return false;
 if(obstacle(Math.floor(contactRoot.x+nx-crate.x),Math.floor(contactRoot.y+ny-crate.y)))return false;
 pushing={from:{...crate},to:{x:nx,y:ny},started:performance.now(),approach:Math.max(60,Math.hypot(contactRoot.x-player.x,contactRoot.y-player.y)/2.2*1000),playerFrom:{...player},contactRoot,playerTo:{x:contactRoot.x+nx-crate.x,y:contactRoot.y+ny-crate.y}};crate={x:nx,y:ny};return true;
}
function boxContact(box){const x=OX+box.x*T,y=OY+(box.y+1)*T-72;return direction==='east'?{x:x+2,y:y+32}:direction==='west'?{x:x+62,y:y+32}:direction==='north'?{x:x+32,y:y+58}:{x:x+32,y:y+10};}
function corners(){
 const out=[];
 for(let y=0;y<=8;y++)for(let x=0;x<=12;x++){
  const q=[room(x-1,y-1),room(x,y-1),room(x-1,y),room(x,y)],n=q.filter(Boolean).length;
  if(n===1||n===3||(n===2&&q[0]===q[3]))out.push([x,y]);
 }
 if(layout==='puzzle')out.push([8,0],[8,4],[8,5],[8,8]);
 return out;
}
function hero(c,index,x,y,h=104,clip=sceneClip(),lock=true){
 const id=clip.kind==='idle'?'idle':clip.kind==='push'?'push_'+direction:direction==='east'?'walk':'walk_'+direction;
 const s=pushing&&c===ctx&&clip.kind==='push'&&lock?pushState():null;
 if(s)index=Math.min(3,Math.floor(s.u*4));
 const f=clip.frames[index%clip.frames.length],r=f.rect,scale=clip.pixel_scale*h/104,w=r[2]*scale,height=r[3]*scale;
 const original={x,y};if(s){const contact=boxContact(cratePosition());x=contact.x-(f.contact[0]-f.pivot[0])*w;y=contact.y-(f.contact[1]-f.pivot[1])*height;}
 c.save();if(s)c.globalAlpha=1-s.release;c.drawImage(images[id],...r,x-w*f.pivot[0],y-height*f.pivot[1],w,height);c.restore();
 if(s?.release){c.save();c.globalAlpha=s.release;hero(c,0,original.x,original.y,h,KIT.idles[direction],false);c.restore();}
}
function drawWalls(foreground){
 const g=KIT.walls.layouts[layout];ctx.save();ctx.translate(OX,OY);
 const faceMask=new Path2D();faceMask.rect(...g.bounds);const opening=portalPath(2);faceMask.addPath(opening);ctx.save();ctx.clip(faceMask,'evenodd');
 for(const q of g.faces)if(q.foreground===foreground){ctx.save();ctx.transform(...q.transform);ctx.drawImage(images[q.asset],...q.src,0,0,1,1);ctx.restore();}
 ctx.restore();
 const cap=new Path2D();for(const p of g.cap_contours){cap.moveTo(...p[0]);for(const v of p.slice(1))cap.lineTo(...v);cap.closePath();}
 ctx.save();ctx.clip(cap,'evenodd');if(foreground){const region=new Path2D();for(const r of g.foreground_rects)region.rect(...r);ctx.clip(region);}
 const texture=images.wall_cap,pattern=ctx.createPattern(texture,'repeat');pattern.setTransform(new DOMMatrix().scale(KIT.walls.texture_period/texture.width,KIT.walls.texture_period/texture.height));ctx.fillStyle=pattern;ctx.fill(cap,'evenodd');ctx.restore();
 ctx.lineJoin='round';ctx.lineCap='round';for(const line of g.outlines)if(line.foreground===foreground){ctx.beginPath();ctx.moveTo(...line.points[0]);for(const p of line.points.slice(1))ctx.lineTo(...p);ctx.strokeStyle='rgba(73,68,63,.30)';ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.translate(-.5,-.5);ctx.strokeStyle='rgba(246,239,216,.40)';ctx.lineWidth=1;ctx.stroke();ctx.restore();}ctx.restore();
}
function portalPath(extend=0){const path=new Path2D(),p=GATE.opening.contour;path.moveTo(p[0][0],p[0][1]+extend);for(let i=1;i<p.length;i++)path.lineTo(p[i][0],p[i][1]+(i===p.length-1?extend:0));path.closePath();return path;}
function drawPortal(shadow=true){
 ctx.save();ctx.translate(OX,OY);const path=portalPath(),[x,y,w,h]=GATE.opening.rect;
 if(shadow){ctx.save();ctx.clip(path);const shade=ctx.createLinearGradient(0,y,0,y+h);shade.addColorStop(0,'rgba(44,36,28,.48)');shade.addColorStop(1,'rgba(44,36,28,0)');ctx.fillStyle=shade;ctx.fill(path);ctx.restore();}
 if(!door){ctx.save();ctx.clip(path);sprite(ctx,'door_closed',...GATE.opening.leaf_rect);ctx.restore();}
 const p=GATE.opening.contour;ctx.beginPath();ctx.moveTo(...p[0]);for(const q of p.slice(1))ctx.lineTo(...q);ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='rgba(65,49,31,.30)';ctx.stroke();ctx.translate(-.5,-.5);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,239,199,.45)';ctx.stroke();ctx.restore();
}
function drawNorthOcclusion(){ctx.save();ctx.beginPath();ctx.rect(OX+GATE.occlusion_rect[0],OY+GATE.occlusion_rect[1],GATE.occlusion_rect[2],GATE.occlusion_rect[3]);ctx.clip();drawWalls(false);drawPortal(false);ctx.restore();}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);const bg=document.querySelector('#background').value;ctx.fillStyle=bg==='light'?'#e8e2d7':'#25343d';ctx.fillRect(0,0,1120,780);if(bg==='checker')for(let y=0;y<780;y+=24)for(let x=0;x<1120;x+=24){ctx.fillStyle=((x+y)/24)%2?'#ddd':'#aab7be';ctx.fillRect(x,y,24,24);}
ctx.save();ctx.beginPath();for(let y=-1;y<8;y++)for(let x=0;x<12;x++)if(floor(x,y))ctx.rect(OX+x*T,OY+y*T,T,T);ctx.clip();for(let y=-6;y<8;y+=6)for(let x=0;x<12;x+=6)sprite(ctx,'floor',OX+x*T,OY+y*T,6*T,6*T);ctx.restore();
// A single projected wall volume supplies the cap, facade and orthogonal corners.
drawWalls(false);
if(debug)for(let y=0;y<8;y++)for(let x=0;x<12;x++)if(room(x,y)){ctx.strokeStyle='#de7373';ctx.strokeRect(OX+x*T,OY+y*T,T,T);}
// The doorway is a void in this wall face, under its continuous lintel and cap.
drawPortal();
sprite(ctx,'plate',OX+plate.x*T,OY+plate.y*T,T,T*.7);
if(plateBlend>0){ctx.save();ctx.globalAlpha=plateBlend;sprite(ctx,'plate_pressed',OX+plate.x*T,OY+plate.y*T,T,T*.7);ctx.restore();}
const box=cratePosition();
// Objects share a ground anchor so moving behind the crate gives correct occlusion.
const drawCrate=()=>sprite(ctx,'crate',OX+box.x*T,OY+(box.y+1)*T-72,T,72);
if(player.y<box.y+1){hero(ctx,frame,OX+player.x*T,OY+player.y*T,104);drawCrate();}else{drawCrate();}
if(player.y>=box.y+1)hero(ctx,frame,OX+player.x*T,OY+player.y*T,104);
if(player.y<0)drawNorthOcclusion();
// South-facing boundaries occlude objects behind the wall.
drawWalls(true);
if(debug){ctx.strokeStyle='#58e8d8';ctx.beginPath();ctx.moveTo(OX+player.x*T-12,OY+player.y*T);ctx.lineTo(OX+player.x*T+12,OY+player.y*T);ctx.stroke();}
fx.clearRect(0,0,1120,240);fx.fillStyle=bg==='light'?'#e8e2d7':'#25343d';fx.fillRect(0,0,1120,240);if(bg==='checker')for(let y=0;y<240;y+=24)for(let x=0;x<1120;x+=24){fx.fillStyle=((x+y)/24)%2?'#ddd':'#aab7be';fx.fillRect(x,y,24,24);}for(let i=0;i<selectedClip().frames.length;i++){hero(fx,i,90+i*180,195,170,selectedClip(),false);fx.strokeStyle=i===frame%selectedClip().frames.length?'#ffd270':'#677b80';fx.strokeRect(i*180+4,15,172,205);fx.beginPath();fx.moveTo(i*180+8,195);fx.lineTo(i*180+172,195);fx.stroke();fx.fillStyle='#f9d989';fx.fillText(String(i+1),i*180+8,232);}
const mc=document.querySelector('#mechanisms').getContext('2d');mc.clearRect(0,0,480,160);for(const [i,id] of ['plate','plate_pressed'].entries()){sprite(mc,id,20+i*240,12,130,120);mc.fillStyle='#f5e7c7';mc.fillText(i?'按下 / 激活':'松开 / 未激活',20+i*240,150);}
document.querySelector('#status').textContent=`${layout} · ${direction} · ${action()} · 第 ${(action()==='idle'?0:action()==='push'&&pushing?Math.min(3,Math.floor(pushState().u*4)):frame)+1}/${sceneClip().frames.length} 帧 · 压力板${plateDown()?'按下':'松开'} · ${door?'门已开启':'门关闭'} · 玩家 ${player.x.toFixed(2)},${player.y.toFixed(2)}`;}
function tick(t){
 const dt=Math.min((t-last)/1000,.05)||0;last=t;const pushed=finishPush(t);
 const target=plateDown()?1:0;plateBlend+=Math.sign(target-plateBlend)*Math.min(Math.abs(target-plateBlend),dt/.12);
 let dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
 let moving=pushed;actualMoving=pushed;if(!pushed&&(dx||dy)){const n=Math.hypot(dx,dy);moving=move(dx/n*dt*2.2,dy/n*dt*2.2);stepping=false;}
 actualMoving=moving;
 if(playing||moving){acc+=dt;const interval=1/Number(document.querySelector('#fps').value);if(acc>=interval){frame=(frame+1)%(playing?selectedClip().frames.length:walk().frames.length);acc%=interval;}}
 else if(!stepping){frame=IDLE_FRAME;acc=0;}
 draw();requestAnimationFrame(tick);
}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();keys.add(e.key);if(e.key.toLowerCase()==='e'&&!e.repeat)push();});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
document.querySelector('#layout').onchange=e=>{layout=e.target.value;reset();};document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'停止演示':'动作演示';};document.querySelector('#step').onclick=()=>{playing=false;stepping=true;document.querySelector('#play').textContent='动作演示';frame=(frame+1)%selectedClip().frames.length;};document.querySelector('#door').onclick=()=>{door=!door;if(!door&&player.y<0)player.y=.5;};document.querySelector('#collision').onclick=()=>debug=!debug;
document.querySelector('#action').onchange=()=>{frame=IDLE_FRAME;acc=0;};
document.querySelector('#direction').onchange=e=>{direction=e.target.value;frame=IDLE_FRAME;acc=0;};
Promise.all([...KIT.assets.map(a=>[a.id,a.file]),['walk',KIT.walk.file],['idle',KIT.idles.east.file],...Object.entries(KIT.pushes).map(([d,w])=>['push_'+d,w.file]),...Object.entries(KIT.walks).filter(([d])=>d!=='east').map(([d,w])=>['walk_'+d,w.file])].map(([id,path])=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images[id]=img;resolve();};img.onerror=()=>reject(Error('图片无法加载: '+path));img.src=KIT.embeddedImages?.[id] || '../../Assets/NLI_Prototype_Kit/'+path;}))).then(()=>{reset();window.KIT_TEST={get state(){return{frame,playing,direction,action:action(),pushPhase:pushState()?.phase,plateDown:plateDown(),plateBlend,layout,door,player:{...player},crate:{...crate},pushing:!!pushing,crateVisual:cratePosition()};},geometry:{northWallCells,gate:GATE,corners},setPlayer:(x,y)=>{player={x,y};},move,push,draw,images};document.querySelector('#qa').textContent='四方向独立待机、行走和推箱；推箱先靠近接触，再同步移动箱子。每套图使用固定尺度，保留屈膝变化。';requestAnimationFrame(tick);}).catch(e=>document.querySelector('#status').textContent=e.message);
