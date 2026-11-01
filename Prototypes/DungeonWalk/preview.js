/* Source pixels are never rewritten. The manifest supplies calibrated source rectangles. */
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),strip=document.querySelector('#frames'),fx=strip.getContext('2d');
const images={},T=64,OX=100,OY=196,IDLE_FRAME=1;
let frame=IDLE_FRAME,playing=false,stepping=false,debug=false,door=false,layout='hall',last=0,acc=0,pushing=null;
let player={x:2,y:5},crate={x:5,y:4},plate={x:7,y:4};const keys=new Set();
const GATE={start:5,end:8,passage:6,width:3*T,height:192};
const northWallCells=Array.from({length:12},(_,x)=>x).filter(x=>x<GATE.start||x>=GATE.end);

const asset=id=>KIT.assets.find(a=>a.id===id);
function sprite(c,id,x,y,w,h,flip=false){const a=asset(id),r=a.rect;c.save();if(flip){c.translate(x+w,y);c.scale(-1,1);x=0;y=0;}c.drawImage(images[id],...r,x,y,w,h);c.restore();}
// Room shape is independent of gate state; the wall gap and collision passage differ.
function room(x,y){return x>=0&&y>=0&&x<12&&y<8&&(layout!=='elbow'||x<6||y<4);}
function floor(x,y){return room(x,y)||(door&&y===-1&&x===GATE.passage);}
function obstacle(x,y){return !floor(x,y)||(y===0&&(x===GATE.start||x===GATE.end-1))||(layout==='puzzle'&&x===8&&y!==4);}
function solid(x,y){const ix=Math.floor(x),iy=Math.floor(y);return obstacle(ix,iy)||(ix===crate.x&&iy===crate.y)||(pushing&&ix===pushing.from.x&&iy===pushing.from.y);}
function reset(){player={x:2.5,y:5.5};crate={x:5,y:4};plate=layout==='elbow'?{x:4,y:4}:{x:7,y:4};if(layout==='elbow')crate={x:3,y:4};door=false;pushing=null;frame=IDLE_FRAME;playing=false;stepping=false;acc=0;keys.clear();document.querySelector('#play').textContent='动作演示';}
function move(dx,dy){const old={...player};if(!solid(player.x+dx,player.y))player.x+=dx;if(!solid(player.x,player.y+dy))player.y+=dy;return Math.hypot(player.x-old.x,player.y-old.y)>0.00001;}
function cratePosition(t=performance.now()){
 if(!pushing)return {...crate};
 const u=Math.max(0,Math.min(1,(t-pushing.started)/pushing.duration)),k=u*u*(3-2*u);
 return {x:pushing.from.x+(pushing.to.x-pushing.from.x)*k,y:pushing.from.y+(pushing.to.y-pushing.from.y)*k};
}
function finishPush(t){
 if(!pushing)return false;
 const u=Math.max(0,Math.min(1,(t-pushing.started)/pushing.duration)),k=u*u*(3-2*u);
 player.x=pushing.playerFrom.x+(pushing.playerTo.x-pushing.playerFrom.x)*k;
 player.y=pushing.playerFrom.y+(pushing.playerTo.y-pushing.playerFrom.y)*k;
 if(u===1){pushing=null;door=crate.x===plate.x&&crate.y===plate.y;}
 return true;
}
function push(){
 if(pushing||Math.hypot(crate.x+.5-player.x,crate.y+.5-player.y)>1.8)return false;
 const dx=crate.x+.5-player.x,dy=crate.y+.5-player.y;
 if(Math.hypot(dx,dy)<.2)return false;
 const nx=crate.x+(Math.abs(dx)>=Math.abs(dy)?Math.sign(dx):0),ny=crate.y+(Math.abs(dy)>Math.abs(dx)?Math.sign(dy):0);
 if(obstacle(nx,ny))return false;
 stepping=false;
 pushing={from:{...crate},to:{x:nx,y:ny},started:performance.now(),duration:260,playerFrom:{...player},playerTo:{x:player.x+nx-crate.x,y:player.y+ny-crate.y}};crate={x:nx,y:ny};return true;
}
function corners(){
 const out=[];
 for(let y=0;y<=8;y++)for(let x=0;x<=12;x++){
  const q=[room(x-1,y-1),room(x,y-1),room(x-1,y),room(x,y)],n=q.filter(Boolean).length;
  if(n===1||n===3||(n===2&&q[0]===q[3]))out.push([x,y]);
 }
 if(layout==='puzzle')out.push([8,0],[8,4],[8,5],[8,8]);
 return out;
}
function hero(c,index,x,y,h=100){const f=KIT.walk.frames[index],r=f.rect,w=r[2]/r[3]*h;c.drawImage(images.walk,...r,x-w*f.pivot[0],y-h*f.pivot[1],w,h);}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);const bg=document.querySelector('#background').value;ctx.fillStyle=bg==='light'?'#e8e2d7':'#25343d';ctx.fillRect(0,0,1120,780);if(bg==='checker')for(let y=0;y<780;y+=24)for(let x=0;x<1120;x+=24){ctx.fillStyle=((x+y)/24)%2?'#ddd':'#aab7be';ctx.fillRect(x,y,24,24);}
ctx.save();ctx.beginPath();for(let y=-1;y<8;y++)for(let x=0;x<12;x++)if(floor(x,y))ctx.rect(OX+x*T,OY+y*T,T,T);if(door){const left=OX+GATE.passage*T-3,right=left+70,mid=(left+right)/2;ctx.moveTo(left,OY);ctx.lineTo(left,OY-54);ctx.quadraticCurveTo(left,OY-80,mid,OY-104);ctx.quadraticCurveTo(right,OY-80,right,OY-54);ctx.lineTo(right,OY);ctx.closePath();}ctx.clip();for(let y=-6;y<8;y+=6)for(let x=0;x<12;x+=6)sprite(ctx,'floor',OX+x*T,OY+y*T,6*T,6*T);ctx.restore();
// Wall caps share a 32px ground depth. Only real corners receive connectors.
for(let y=0;y<8;y++)for(let x=0;x<12;x++)if(room(x,y)){
 if(!room(x,y-1)&&(y!==0||northWallCells.includes(x)))sprite(ctx,'wall',OX+x*T,OY+y*T-30,T,42);
 if(!room(x-1,y))sprite(ctx,'sidewall',OX+x*T-16,OY+y*T-30,32,T);
 if(!room(x+1,y))sprite(ctx,'sidewall',OX+(x+1)*T-16,OY+y*T-30,32,T,true);
 if(debug){ctx.strokeStyle='#de7373';ctx.strokeRect(OX+x*T,OY+y*T,T,T);}
}
if(layout==='puzzle')for(let y=0;y<8;y++)if(y!==4)sprite(ctx,'sidewall',OX+8*T-16,OY+y*T-30,32,T);
for(const [x,y] of corners().filter(([,y])=>y!==8))sprite(ctx,'pillar',OX+x*T-20,OY+y*T-42,40,54);
// The arch replaces three wall segments, and its threshold aligns with the wall base.
const drawGate=()=>sprite(ctx,door?'door_open':'door_closed',OX+GATE.start*T,OY+12-GATE.height,GATE.width,GATE.height);
if(player.y>=0)drawGate();
sprite(ctx,'plate',OX+plate.x*T,OY+plate.y*T,T,T*.7);
const box=cratePosition();
// Objects share a ground anchor so moving behind the crate gives correct occlusion.
const drawCrate=()=>sprite(ctx,'crate',OX+box.x*T,OY+(box.y+1)*T-72,T,72);
if(player.y<box.y+1){hero(ctx,frame,OX+player.x*T,OY+player.y*T,104);drawCrate();}else{drawCrate();}
if(player.y>=box.y+1)hero(ctx,frame,OX+player.x*T,OY+player.y*T,104);
if(player.y<0)drawGate();
// Foreground walls and corner posts occlude the player consistently.
for(let y=0;y<8;y++)for(let x=0;x<12;x++)if(room(x,y)&&!room(x,y+1))sprite(ctx,'wall',OX+x*T,OY+(y+1)*T-30,T,42);
for(const [x,y] of corners().filter(([,y])=>y===8))sprite(ctx,'pillar',OX+x*T-20,OY+y*T-42,40,54);
if(debug){ctx.strokeStyle='#58e8d8';ctx.beginPath();ctx.moveTo(OX+player.x*T-12,OY+player.y*T);ctx.lineTo(OX+player.x*T+12,OY+player.y*T);ctx.stroke();}
fx.clearRect(0,0,1120,240);fx.fillStyle=bg==='light'?'#e8e2d7':'#25343d';fx.fillRect(0,0,1120,240);if(bg==='checker')for(let y=0;y<240;y+=24)for(let x=0;x<1120;x+=24){fx.fillStyle=((x+y)/24)%2?'#ddd':'#aab7be';fx.fillRect(x,y,24,24);}for(let i=0;i<KIT.walk.frames.length;i++){hero(fx,i,90+i*180,195,170);fx.strokeStyle=i===frame?'#ffd270':'#677b80';fx.strokeRect(i*180+4,15,172,205);fx.beginPath();fx.moveTo(i*180+8,195);fx.lineTo(i*180+172,195);fx.stroke();fx.fillStyle='#f9d989';fx.fillText(String(i+1),i*180+8,232);}
document.querySelector('#status').textContent=`${layout} · 第 ${frame+1}/${KIT.walk.frames.length} 帧 · ${door?'门已开启':'门关闭'} · 玩家 ${player.x.toFixed(2)},${player.y.toFixed(2)}`;}
function tick(t){
 const dt=Math.min((t-last)/1000,.05)||0;last=t;const pushed=finishPush(t);
 let dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
 let moving=pushed;if(!pushed&&(dx||dy)){const n=Math.hypot(dx,dy);moving=move(dx/n*dt*2.2,dy/n*dt*2.2);stepping=false;}
 if(playing||moving){acc+=dt;const interval=1/Number(document.querySelector('#fps').value);if(acc>=interval){frame=(frame+1)%KIT.walk.frames.length;acc%=interval;}}
 else if(!stepping){frame=IDLE_FRAME;acc=0;}
 draw();requestAnimationFrame(tick);
}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();keys.add(e.key);if(e.key.toLowerCase()==='e'&&!e.repeat)push();});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
document.querySelector('#layout').onchange=e=>{layout=e.target.value;reset();};document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'停止演示':'动作演示';};document.querySelector('#step').onclick=()=>{playing=false;stepping=true;document.querySelector('#play').textContent='动作演示';frame=(frame+1)%KIT.walk.frames.length;};document.querySelector('#door').onclick=()=>{door=!door;if(!door&&player.y<0)player.y=.5;};document.querySelector('#collision').onclick=()=>debug=!debug;
Promise.all([...KIT.assets.map(a=>[a.id,a.file]),['walk',KIT.walk.file]].map(([id,path])=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images[id]=img;resolve();};img.onerror=()=>reject(Error('图片无法加载: '+path));img.src=KIT.embeddedImages?.[id] || '../../Assets/NLI_Prototype_Kit/'+path;}))).then(()=>{reset();window.KIT_TEST={get state(){return{frame,playing,layout,door,player:{...player},crate:{...crate},pushing:!!pushing,crateVisual:cratePosition()};},geometry:{northWallCells,gate:GATE,corners},setPlayer:(x,y)=>{player={x,y};},move,push,draw,images};document.querySelector('#qa').textContent=KIT.walk.note;requestAnimationFrame(tick);}).catch(e=>document.querySelector('#status').textContent=e.message);
