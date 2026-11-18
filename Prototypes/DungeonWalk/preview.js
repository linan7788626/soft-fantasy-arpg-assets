/* Source pixels are never rewritten. The manifest supplies calibrated source rectangles. */
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),strip=document.querySelector('#frames'),fx=strip.getContext('2d');
const wallOverlay=document.createElement('canvas');
wallOverlay.width=canvas.width;
wallOverlay.height=canvas.height;
const wallOverlayContext=wallOverlay.getContext('2d');
const images={},T=64,OX=100,OY=196,IDLE_FRAME=1;
let frame=IDLE_FRAME,playing=false,stepping=false,debug=false,door=false,layout='hall',last=0,acc=0,pushing=null;
let player={x:2,y:5},crate={x:5,y:4},plate={x:7,y:4};const keys=new Set();
let direction='east',plateBlend=0,actualMoving=false;
const roomNames={hall:'战斗大厅',elbow:'L 形回廊',puzzle:'机关房',arena:'史莱姆战斗房'};
const linkedRooms={hall:'elbow',elbow:'hall'};
const roomProgress=new Map();
const nativeMaterials=new Map();
const tintedMaterials=new Map();
let requireNorthRelease=false;
let arrivedInElbow=false;
let questStage='gate';
let questNotice='';
const COMBAT=KIT.combat;
const facing={east:[1,0],south:[0,1],west:[-1,0],north:[0,-1]};
const attackHalfAngle=Math.acos(COMBAT.attack_dot);
let battle=newBattle();
function newBattle(){
 const [x,y]=COMBAT.enemy_spawn;
 return {heroHp:COMBAT.hero_hp,enemyHp:COMBAT.enemy_hp,enemy:{x,y},enemyPhase:'chase',
  enemyTimer:0,elapsed:0,attack:null,hurt:0,hurtDirection:'east',invulnerable:0,enemyHurt:0,escaped:false};
}
const walk=()=>KIT.walks[direction];
function clipFor(kind){
 if(kind==='attack'||kind==='hurt')return {kind,frames:COMBAT.hero_actions[direction][kind]};
 return ({walk:KIT.walks,idle:KIT.idles,push:KIT.pushes})[kind][direction];
}
const selectedClip=()=>clipFor(document.querySelector('#action').value);
function pushState(t=performance.now()){if(!pushing)return null;const elapsed=t-pushing.started,moveTime=elapsed-pushing.approach;return{phase:elapsed<pushing.approach?'approach':moveTime<320?'push':'release',approach:Math.min(1,elapsed/pushing.approach),u:Math.max(0,Math.min(1,moveTime/320)),release:Math.max(0,Math.min(1,(moveTime-320)/100))};}
function action(){return pushing?(pushState().phase==='approach'?'walk':'push'):actualMoving?'walk':(playing||stepping)?document.querySelector('#action').value:'idle';}
const sceneClip=()=>clipFor(action());
const plateDown=()=>layout!=='arena'&&!pushing&&crate.x===plate.x&&crate.y===plate.y;
function face(dx,dy){if(dx||dy){const next=Math.abs(dx)>=Math.abs(dy)?(dx>0?'east':'west'):(dy>0?'south':'north');if(direction!==next){direction=next;frame=IDLE_FRAME;acc=0;document.querySelector('#direction').value=direction;}}}
const GATE=KIT.walls.gate;
const QUEST=KIT.quest;
const northWallCells=Array.from({length:12},(_,x)=>x);

const asset=id=>KIT.assets.find(a=>a.id===id);
function sprite(c,id,x,y,w,h,flip=false){const a=asset(id),r=a.rect;c.save();if(flip){c.translate(x+w,y);c.scale(-1,1);x=0;y=0;}c.drawImage(images[id],...r,x,y,w,h);c.restore();}
// Room shape is independent of gate state; the wall gap and collision passage differ.
function room(x,y){return x>=0&&y>=0&&x<12&&y<8&&(layout!=='elbow'||x<6||y<4);}
function floor(x,y){return room(x,y)||(door&&y===-1&&x===GATE.passage);}
function obstacle(x,y){return !floor(x,y)||(layout==='puzzle'&&x===8&&(y<KIT.walls.puzzle_open_rows[0]||y>=KIT.walls.puzzle_open_rows[1]));}
function solid(x,y){const ix=Math.floor(x),iy=Math.floor(y);return obstacle(ix,iy)||(layout!=='arena'&&x>crate.x+.08&&x<crate.x+.92&&y>crate.y+.84&&y<crate.y+1)||(pushing&&ix===pushing.from.x&&iy===pushing.from.y);}
function reset({keepInput=false}={}){player={x:2.5,y:5.5};crate={x:5,y:4};plate=layout==='elbow'?{x:4,y:4}:{x:7,y:4};if(layout==='elbow')crate={x:3,y:4};if(layout==='puzzle'){crate={x:5,y:3};plate={x:7,y:3};}door=false;pushing=null;frame=IDLE_FRAME;playing=false;stepping=false;acc=0;direction='east';plateBlend=0;actualMoving=false;document.querySelector('#direction').value=direction;if(!keepInput)keys.clear();document.querySelector('#play').textContent='动作演示';}
function move(dx,dy){
 if(dy>=0)requireNorthRelease=false;
 if(requireNorthRelease&&dy<0)dy=0;
 face(dx,dy);
 const old={...player};
 if(!solid(player.x+dx,player.y))player.x+=dx;
 if(!solid(player.x,player.y+dy))player.y+=dy;
 if(layout==='arena'&&door&&player.y<=-.8){
  battle.escaped=true;
  player.y=-.78;
  return false;
 }
 if(dy<0&&door&&player.y<=-.8&&linkedRooms[layout]){
  enterLinkedRoom();
  return false;
 }
 const moved=Math.hypot(player.x-old.x,player.y-old.y)>0.00001;
 if(moved){
  questNotice='';
  if(layout==='elbow'&&questStage==='key'&&nearQuest(QUEST.key_pos,QUEST.pickup_radius)){
   questStage='chest';
  }
 }
 return moved;
}
function nearQuest([x,y],radius){
 return Math.hypot(player.x-x,player.y-y)<=radius;
}
function interact(){
 if(pushing)return;
 if(layout==='arena'){
  if(battle.heroHp===0)retryBattle();
  else if(nearQuest(COMBAT.arena_portal,COMBAT.portal_radius))travelArena(false);
  return;
 }
 if(layout==='hall'&&questStage==='complete'&&nearQuest(COMBAT.hall_portal,COMBAT.portal_radius)){
  travelArena(true);
  return;
 }
 if(layout==='hall'&&nearQuest(QUEST.chest_pos,QUEST.open_radius)){
  if(questStage==='chest')questStage='complete';
  else if(questStage!=='complete')questNotice='宝箱锁着。需要回廊里的钥匙。';
  return;
 }
 push();
}
function drawQuestItem(id,[x,y],width){
 const rect=asset(id).rect;
 const height=width*rect[3]/rect[2];
 sprite(ctx,id,OX+x*T-width/2,OY+y*T-height,width,height);
}
function questObjective(){
 if(questNotice)return questNotice;
 if(layout==='arena'){
  if(battle.escaped)return '地牢通关 · 已穿过战斗房出口';
  if(battle.heroHp===0)return '主角倒下 · 按 R 或 E 重试战斗';
  if(battle.enemyHp===0)return '史莱姆已击败 · 从北门离开';
  return `生命 ${battle.heroHp}/${COMBAT.hero_hp} · 史莱姆 ${battle.enemyHp}/${COMBAT.enemy_hp} · 空格挥剑`;
 }
 if(questStage==='complete')return '谜题完成 · 宝箱已打开 · 靠近大厅右下的蓝色传送门按 E';
 if(questStage==='chest')return layout==='hall'
  ? '已获得钥匙 · 靠近宝箱按 E 开锁'
  : '已获得钥匙 · 穿过北门，返回大厅';
 if(questStage==='key')return layout==='elbow'
  ? '走近回廊右侧的金钥匙即可拾取'
  : '沿北门进入回廊，寻找钥匙';
 return '大厅谜题 · 按 E 把木箱推上压力板';
}
function travelArena(entering){
 if(entering)roomProgress.set('hall',{crate:{...crate},door});
 battle.attack=null;
 battle.hurt=0;
 layout=entering?'arena':'hall';
 document.querySelector('#layout').value=layout;
 document.querySelector('#door').disabled=entering;
 reset();
 questNotice='';
 requireNorthRelease=false;
 if(entering){
  door=battle.enemyHp===0;
 }else{
  const hall=roomProgress.get('hall');
  crate={...hall.crate};
  door=hall.door;
  plateBlend=plateDown()?1:0;
  player={x:9.5,y:4.6};
 }
 applyRoomPalette();
}
function retryBattle(){
 battle=newBattle();
 player={x:2.5,y:5.5};
 door=false;
}
function startAttack(){
 if(layout==='arena'&&battle.heroHp>0&&battle.enemyHp>0&&!battle.escaped&&!battle.attack&&battle.hurt===0){
  battle.attack={elapsed:0,hit:false,direction};
 }
}
function hitHero(dx,dy,distance){
 if(battle.invulnerable>0||battle.heroHp===0)return;
 battle.heroHp--;
 battle.hurtDirection=battle.attack?.direction??direction;
 battle.hurt=COMBAT.hurt_duration;
 battle.invulnerable=COMBAT.invulnerability;
 battle.attack=null;
 if(distance>.001){
  const x=player.x+dx/distance*.28;
  const y=player.y+dy/distance*.28;
  if(!solid(x,y))player={x,y};
 }
}
function updateBattle(dt){
 if(layout!=='arena'||battle.escaped)return;
 battle.elapsed+=dt;
 for(const timer of ['hurt','invulnerable','enemyHurt']){
  battle[timer]=Math.max(0,battle[timer]-dt);
 }
 const enemy=battle.enemy;
 const dx=enemy.x-player.x,dy=enemy.y-player.y;
 const distance=Math.hypot(dx,dy);
 const swing=battle.attack;
 if(swing){
  swing.elapsed+=dt;
  if(!swing.hit&&swing.elapsed>=COMBAT.attack_impact){
   swing.hit=true;
   const [fx,fy]=facing[swing.direction];
   const aimed=distance<.00001||(fx*dx+fy*dy)/distance>=COMBAT.attack_dot;
   if(aimed&&distance<=COMBAT.attack_range&&battle.enemyHp>0){
    battle.enemyHp--;
    battle.enemyHurt=.22;
    battle.enemyTimer=battle.enemyPhase==='recover'?Math.max(battle.enemyTimer,.28):.28;
    battle.enemyPhase='recover';
    if(battle.enemyHp===0)door=true;
   }
  }
  if(swing.elapsed>=COMBAT.attack_duration)battle.attack=null;
 }
 if(battle.heroHp===0||battle.enemyHp===0)return;
 if(battle.enemyPhase==='chase'){
  if(distance<=COMBAT.enemy_range+.002){
   battle.enemyPhase='windup';
   battle.enemyTimer=COMBAT.enemy_windup;
  }else{
   const delta=Math.min(dt*COMBAT.enemy_speed,distance-COMBAT.enemy_range);
   enemy.x+=dx/distance* -delta;
   enemy.y+=dy/distance* -delta;
  }
 }else{
  battle.enemyTimer-=dt;
  if(battle.enemyTimer<=0){
   if(battle.enemyPhase==='windup'){
    if(distance<=COMBAT.enemy_range+.13)hitHero(-dx,-dy,distance);
    battle.enemyPhase='recover';
    battle.enemyTimer=COMBAT.enemy_recovery;
   }else battle.enemyPhase='chase';
  }
 }
}
function applyRoomPalette(){
 for(const [id,color] of Object.entries(KIT.palette[layout])){
  const source=nativeMaterials.get(id);
  const key=id+color;
  if(!tintedMaterials.has(key)){
   const surface=document.createElement('canvas');
   surface.width=source.width;
   surface.height=source.height;
   const target=surface.getContext('2d');
   target.drawImage(source,0,0);
   target.globalCompositeOperation='multiply';
   target.fillStyle=color;
   target.fillRect(0,0,surface.width,surface.height);
   target.globalCompositeOperation='destination-in';
   target.drawImage(source,0,0);
   tintedMaterials.set(key,surface);
  }
  images[id]=tintedMaterials.get(key);
 }
}
function enterLinkedRoom(){
 roomProgress.set(layout,{crate:{...crate},door});
 layout=linkedRooms[layout];
 if(layout==='elbow')arrivedInElbow=true;
 document.querySelector('#layout').value=layout;
 document.querySelector('#door').disabled=layout==='elbow'&&arrivedInElbow;
 reset({keepInput:true});
 questNotice='';
 const saved=roomProgress.get(layout);
 if(saved)crate={...saved.crate};
 door=arrivedInElbow&&layout==='elbow' ? true : (saved?.door ?? true);
 plateBlend=plateDown()?1:0;
 player={x:GATE.passage+.5,y:.58};
 face(0,1);
 requireNorthRelease=true;
 applyRoomPalette();
}
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
 if(state.release===1){
  pushing=null;
  door=(layout==='elbow'&&arrivedInElbow)||plateDown();
  if(layout==='hall'&&plateDown()&&questStage==='gate')questStage='key';
 }
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
 if(clip.kind==='attack'||clip.kind==='hurt'){
  drawCombatPose(c,clip.frames[index%clip.frames.length],x,y,h/104);
  return;
 }
 const id=clip.kind==='idle'?'idle':clip.kind==='push'?'push_'+direction:direction==='east'?'walk':'walk_'+direction;
 const s=pushing&&c===ctx&&clip.kind==='push'&&lock?pushState():null;
 if(s)index=Math.min(3,Math.floor(s.u*4));
 const f=clip.frames[index%clip.frames.length],r=f.rect,scale=clip.pixel_scale*h/104,w=r[2]*scale,height=r[3]*scale;
 const original={x,y};if(s){const contact=boxContact(cratePosition());x=contact.x-(f.contact[0]-f.pivot[0])*w;y=contact.y-(f.contact[1]-f.pivot[1])*height;}
 c.save();if(s)c.globalAlpha=1-s.release;c.drawImage(images[id],...r,x-w*f.pivot[0],y-height*f.pivot[1],w,height);c.restore();
 if(s?.release){c.save();c.globalAlpha=s.release;hero(c,0,original.x,original.y,h,KIT.idles[direction],false);c.restore();}
}
function drawWalls(foreground,ctx=canvas.getContext('2d')){
 const g=KIT.walls.layouts[layout];ctx.save();ctx.translate(OX,OY);
 const faceMask=new Path2D();faceMask.rect(...g.bounds);const opening=portalPath(2);faceMask.addPath(opening);ctx.save();ctx.clip(faceMask,'evenodd');
 for(const q of g.faces)if(q.foreground===foreground){ctx.save();ctx.transform(...q.transform);ctx.drawImage(images[q.asset],...q.src,0,0,1,1);ctx.restore();}
 ctx.restore();
 const cap=new Path2D();for(const p of g.cap_contours){cap.moveTo(...p[0]);for(const v of p.slice(1))cap.lineTo(...v);cap.closePath();}
 ctx.save();ctx.clip(cap,'evenodd');
 const region=new Path2D();
 if(!foreground)region.rect(...g.bounds);
 for(const r of g.foreground_rects)region.rect(...r);
 ctx.clip(region,'evenodd');
 const texture=images.wall_cap,pattern=ctx.createPattern(texture,'repeat');pattern.setTransform(new DOMMatrix().scale(KIT.walls.texture_period/texture.width,KIT.walls.texture_period/texture.height));ctx.fillStyle=pattern;ctx.fill(cap,'evenodd');ctx.restore();
 ctx.lineJoin='round';ctx.lineCap='round';for(const line of g.outlines)if(line.foreground===foreground){ctx.beginPath();ctx.moveTo(...line.points[0]);for(const p of line.points.slice(1))ctx.lineTo(...p);ctx.strokeStyle='rgba(73,68,63,.30)';ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.translate(-.5,-.5);ctx.strokeStyle='rgba(246,239,216,.40)';ctx.lineWidth=1;ctx.stroke();ctx.restore();}ctx.restore();
}
function portalPath(extend=0){const path=new Path2D(),p=GATE.opening.contour;path.moveTo(p[0][0],p[0][1]+extend);for(let i=1;i<p.length;i++)path.lineTo(p[i][0],p[i][1]+(i===p.length-1?extend:0));path.closePath();return path;}
function drawPortal(shadow=true,ctx=canvas.getContext('2d')){
 ctx.save();ctx.translate(OX,OY);const path=portalPath(),[x,y,w,h]=GATE.opening.rect;
 if(shadow){ctx.save();ctx.clip(path);const shade=ctx.createLinearGradient(0,y,0,y+h);shade.addColorStop(0,'rgba(44,36,28,.48)');shade.addColorStop(1,'rgba(44,36,28,0)');ctx.fillStyle=shade;ctx.fill(path);ctx.restore();}
 if(!door){ctx.save();ctx.clip(path);sprite(ctx,'door_closed',...GATE.opening.leaf_rect);ctx.restore();}
 const p=GATE.opening.contour;ctx.beginPath();ctx.moveTo(...p[0]);for(const q of p.slice(1))ctx.lineTo(...q);ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='rgba(65,49,31,.30)';ctx.stroke();ctx.translate(-.5,-.5);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,239,199,.45)';ctx.stroke();ctx.restore();
}
function drawNorthOcclusion(ctx){
 const [x,y,w,h]=GATE.occlusion_rect;
 ctx.save();
 ctx.beginPath();
 ctx.rect(OX+x,OY+y,w,h);
 ctx.clip();
 drawWalls(false,ctx);
 drawPortal(false,ctx);
 ctx.restore();
}
function smoothstep(from,to,value){
 const t=Math.max(0,Math.min(1,(value-from)/(to-from)));
 return t*t*(3-2*t);
}
function foregroundFadeStrength(x,y){
 let strength=0;
 for(const [left,top,width] of KIT.walls.layouts[layout].foreground_rects){
  const depth=y-top;
  const distance=Math.max(left-x,0,x-left-width);
  const proximity=smoothstep(-12,16,depth)*(1-smoothstep(148,176,depth));
  strength=Math.max(strength,proximity*(1-smoothstep(0,36,distance)));
 }
 return strength;
}
function drawForegroundWalls(fade,cutaway){
 const outside=player.y<0;
 const strength=fade?(outside?1:cutaway?0:foregroundFadeStrength(player.x*T,player.y*T)):0;
 if(strength===0){
  if(outside)drawNorthOcclusion(ctx);
  if(!cutaway)drawWalls(true);
  return;
 }

 const layer=wallOverlayContext;
 layer.clearRect(0,0,wallOverlay.width,wallOverlay.height);
 if(outside)drawNorthOcclusion(layer);
 if(!cutaway)drawWalls(true,layer);

 // Fade the assembled wall as one layer so overlaps don't hide the hero.
 layer.save();
 layer.translate(OX+player.x*T,OY+player.y*T-50);
 layer.scale(82,110);
 layer.globalCompositeOperation='destination-out';
 const mask=layer.createRadialGradient(0,0,.52,0,0,1);
 for(let step=0;step<=8;step++){
  const t=step/8;
  mask.addColorStop(t,`rgba(0,0,0,${.82*strength*(1-smoothstep(0,1,t))})`);
 }
 layer.fillStyle=mask;
 layer.fillRect(-1,-1,2,2);
 layer.restore();
 ctx.drawImage(wallOverlay,0,0);
}
function drawCutawayEnds(){
 const geometry=KIT.walls.layouts[layout];
 ctx.save();
 ctx.translate(OX,OY);
 for(const [left,y,right] of geometry.cutaway_lips){
  ctx.fillStyle='rgba(26,30,35,.7)';
  ctx.fillRect(left,y,right-left,4);
  ctx.fillStyle='rgba(225,169,103,.48)';
  ctx.fillRect(left,y-2,right-left,2);
 }
 const texture=images.wall_cap;
 const pattern=ctx.createPattern(texture,'repeat');
 pattern.setTransform(new DOMMatrix().scale(KIT.walls.texture_period/texture.width,KIT.walls.texture_period/texture.height));
 for(const points of geometry.cutaway_ends){
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for(const p of points.slice(1))ctx.lineTo(...p);
  ctx.closePath();
  ctx.fillStyle=pattern;
  ctx.fill();
  ctx.lineJoin='round';
  ctx.strokeStyle='rgba(37,48,59,.28)';
  ctx.stroke();
 }
 ctx.restore();
}
function currentBattlePose(){
 const swing=battle.attack;
 if(battle.heroHp===0||battle.hurt>0){
  const frame=battle.heroHp>0&&battle.hurt>COMBAT.hurt_duration/2?0:1;
  return COMBAT.hero_actions[battle.hurtDirection].hurt[frame];
 }
 if(swing){
  const frame=swing.elapsed<COMBAT.attack_impact?0:swing.elapsed<COMBAT.attack_recover?1:2;
  return COMBAT.hero_actions[swing.direction].attack[frame];
 }
 return null;
}
function drawCombatPose(c,pose,x,y,zoom=1){
 const {id,rect,pivot,scale}=pose;
 const w=rect[2]*scale*zoom,h=rect[3]*scale*zoom;
 c.drawImage(images[id],...rect,x-w*pivot[0],y-h*pivot[1],w,h);
}
function drawBattleHero(){
 const x=OX+player.x*T,y=OY+player.y*T;
 const pose=currentBattlePose();
 if(pose)drawCombatPose(ctx,pose,x,y);
 else hero(ctx,frame,x,y);
}
function drawAttackCue(){
 const swing=battle.attack;
 if(!swing||swing.elapsed<COMBAT.attack_impact||swing.elapsed>=COMBAT.attack_recover)return;
 const [fx,fy]=facing[swing.direction];
 const angle=Math.atan2(fy,fx);
 const x=OX+player.x*T,y=OY+player.y*T;
 const radius=COMBAT.attack_range*T;
 ctx.save();
 ctx.fillStyle='rgba(255,199,97,.19)';
 ctx.beginPath();
 ctx.moveTo(x,y);
 ctx.arc(x,y,radius,angle-attackHalfAngle,angle+attackHalfAngle);
 ctx.closePath();
 ctx.fill();
 ctx.strokeStyle='rgba(255,226,142,.85)';
 ctx.lineWidth=3;
 ctx.beginPath();
 ctx.arc(x,y,radius,angle-attackHalfAngle,angle+attackHalfAngle);
 ctx.stroke();
 ctx.restore();
}
function drawSlime(){
 const {enemy,enemyHp,enemyPhase,enemyHurt,elapsed}=battle;
 if(!enemyHp&&enemyHurt===0)return;
 const windup=enemyPhase==='windup';
 ctx.save();
 if(!enemyHp)ctx.globalAlpha=enemyHurt/.22;
 if(windup&&enemyHp){
  ctx.fillStyle='rgba(243,146,66,.28)';
  ctx.beginPath();
  ctx.ellipse(OX+enemy.x*T,OY+enemy.y*T-7,38,21,0,0,Math.PI*2);
  ctx.fill();
 }
 const id=enemyHurt>0?'slime_3':windup?'slime_2':Math.floor(elapsed*5)%2?'slime_2':'slime_1';
 drawQuestItem(id,[enemy.x,enemy.y],66);
 ctx.restore();
}
function draw({wallFade=true,cutaway=true}={}){ctx.clearRect(0,0,canvas.width,canvas.height);const bg=document.querySelector('#background').value;ctx.fillStyle=bg==='light'?'#e8e2d7':'#25343d';ctx.fillRect(0,0,1120,780);if(bg==='checker')for(let y=0;y<780;y+=24)for(let x=0;x<1120;x+=24){ctx.fillStyle=((x+y)/24)%2?'#ddd':'#aab7be';ctx.fillRect(x,y,24,24);}
ctx.save();ctx.beginPath();for(let y=-1;y<8;y++)for(let x=0;x<12;x++)if(floor(x,y))ctx.rect(OX+x*T,OY+y*T,T,T);ctx.clip();for(let y=-6;y<8;y+=6)for(let x=0;x<12;x+=6)sprite(ctx,'floor',OX+x*T,OY+y*T,6*T,6*T);ctx.restore();
// A single projected wall volume supplies the cap, facade and orthogonal corners.
drawWalls(false);
if(cutaway)drawCutawayEnds();
if(debug)for(let y=0;y<8;y++)for(let x=0;x<12;x++)if(room(x,y)){ctx.strokeStyle='#de7373';ctx.strokeRect(OX+x*T,OY+y*T,T,T);}
// The doorway is a void in this wall face, under its continuous lintel and cap.
drawPortal();
if(layout!=='arena'){
 sprite(ctx,'plate',OX+plate.x*T,OY+plate.y*T,T,T*.7);
 if(plateBlend>0){ctx.save();ctx.globalAlpha=plateBlend;sprite(ctx,'plate_pressed',OX+plate.x*T,OY+plate.y*T,T,T*.7);ctx.restore();}
}
const box=cratePosition();
if(layout==='elbow'&&questStage==='key')drawQuestItem('quest_key',QUEST.key_pos,40);
const actors=[];
if(layout==='arena'){
 drawQuestItem('arena_portal',COMBAT.arena_portal,86);
 drawAttackCue();
 actors.push({depth:battle.enemy.y,paint:drawSlime},{depth:player.y,paint:drawBattleHero});
}else{
 actors.push({depth:box.y+1,paint:()=>sprite(ctx,'crate',OX+box.x*T,OY+(box.y+1)*T-72,T,72)},
  {depth:player.y,paint:()=>hero(ctx,frame,OX+player.x*T,OY+player.y*T,104)});
 if(layout==='hall'&&questStage==='complete')drawQuestItem('arena_portal',COMBAT.hall_portal,86);
}
if(layout==='hall')actors.push({
 depth:QUEST.chest_pos[1],
 paint:()=>drawQuestItem(questStage==='complete'?'chest_open':'chest_closed',QUEST.chest_pos,60),
});
actors.sort((a,b)=>a.depth-b.depth).forEach(actor=>actor.paint());
drawForegroundWalls(wallFade,cutaway);
if(debug){ctx.strokeStyle='#58e8d8';ctx.beginPath();ctx.moveTo(OX+player.x*T-12,OY+player.y*T);ctx.lineTo(OX+player.x*T+12,OY+player.y*T);ctx.stroke();}
fx.clearRect(0,0,1120,240);fx.fillStyle=bg==='light'?'#e8e2d7':'#25343d';fx.fillRect(0,0,1120,240);if(bg==='checker')for(let y=0;y<240;y+=24)for(let x=0;x<1120;x+=24){fx.fillStyle=((x+y)/24)%2?'#ddd':'#aab7be';fx.fillRect(x,y,24,24);}for(let i=0;i<selectedClip().frames.length;i++){hero(fx,i,90+i*180,195,170,selectedClip(),false);fx.strokeStyle=i===frame%selectedClip().frames.length?'#ffd270':'#677b80';fx.strokeRect(i*180+4,15,172,205);fx.beginPath();fx.moveTo(i*180+8,195);fx.lineTo(i*180+172,195);fx.stroke();fx.fillStyle='#f9d989';fx.fillText(String(i+1),i*180+8,232);}
const mc=document.querySelector('#mechanisms').getContext('2d');mc.clearRect(0,0,480,160);for(const [i,id] of ['plate','plate_pressed'].entries()){sprite(mc,id,20+i*240,12,130,120);mc.fillStyle='#f5e7c7';mc.fillText(i?'按下 / 激活':'松开 / 未激活',20+i*240,150);}
document.querySelector('#status').textContent=`${roomNames[layout]}${door&&linkedRooms[layout]?' → '+roomNames[linkedRooms[layout]]:''} · ${direction} · ${action()} · 第 ${(action()==='idle'?0:action()==='push'&&pushing?Math.min(3,Math.floor(pushState().u*4)):frame)+1}/${sceneClip().frames.length} 帧 · 压力板${plateDown()?'按下':'松开'} · ${door?'门已开启':'门关闭'} · 玩家 ${player.x.toFixed(2)},${player.y.toFixed(2)}`;}
function tick(t){
 const dt=Math.min((t-last)/1000,.05)||0;last=t;const pushed=finishPush(t);
 updateBattle(dt);
 const target=plateDown()?1:0;plateBlend+=Math.sign(target-plateBlend)*Math.min(Math.abs(target-plateBlend),dt/.12);
 let dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);
 if(dy>=0)requireNorthRelease=false;
 const battleLocks=layout==='arena'&&(battle.attack||battle.hurt>0||battle.heroHp===0);
 let moving=pushed;actualMoving=pushed;if(!pushed&&!battleLocks&&(dx||dy)){const n=Math.hypot(dx,dy);moving=move(dx/n*dt*2.2,dy/n*dt*2.2);stepping=false;}
 actualMoving=moving;
 if(playing||moving){acc+=dt;const interval=1/Number(document.querySelector('#fps').value);if(acc>=interval){frame=(frame+1)%(playing?selectedClip().frames.length:walk().frames.length);acc%=interval;}}
 else if(!stepping){frame=IDLE_FRAME;acc=0;}
 const objective=document.querySelector('#objective');
 const message=questObjective();
 if(objective.textContent!==message)objective.textContent=message;
 draw();requestAnimationFrame(tick);
}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();keys.add(e.key);if(e.key.toLowerCase()==='e'&&!e.repeat)interact();if(e.code==='Space'&&!e.repeat)startAttack();if(e.key.toLowerCase()==='r'&&layout==='arena'&&battle.heroHp===0)retryBattle();});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
function startTrial(room){
 layout=room;
 roomProgress.clear();
 requireNorthRelease=false;
 arrivedInElbow=false;
 questStage='gate';
 questNotice='';
 battle=newBattle();
 document.querySelector('#layout').value=layout;
 document.querySelector('#door').disabled=false;
 reset();
 applyRoomPalette();
}
document.querySelector('#layout').onchange=e=>startTrial(e.target.value);
document.querySelector('#restart').onclick=()=>startTrial('hall');document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'停止演示':'动作演示';};document.querySelector('#step').onclick=()=>{playing=false;stepping=true;document.querySelector('#play').textContent='动作演示';frame=(frame+1)%selectedClip().frames.length;};document.querySelector('#door').onclick=()=>{if(layout==='elbow'&&arrivedInElbow)return;door=!door;if(!door&&player.y<0)player.y=.5;};document.querySelector('#collision').onclick=()=>debug=!debug;
document.querySelector('#action').onchange=()=>{frame=IDLE_FRAME;acc=0;};
document.querySelector('#direction').onchange=e=>{if(layout==='arena'&&(battle.attack||battle.hurt>0||battle.heroHp===0)){e.target.value=direction;return;}direction=e.target.value;frame=IDLE_FRAME;acc=0;};
Promise.all([...KIT.assets.map(a=>[a.id,a.file]),['walk',KIT.walk.file],['idle',KIT.idles.east.file],...Object.entries(KIT.pushes).map(([d,w])=>['push_'+d,w.file]),...Object.entries(KIT.walks).filter(([d])=>d!=='east').map(([d,w])=>['walk_'+d,w.file])].map(([id,path])=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images[id]=img;resolve();};img.onerror=()=>reject(Error('图片无法加载: '+path));img.src=KIT.embeddedImages?.[id] || '../../Assets/NLI_Prototype_Kit/'+path;}))).then(()=>{for(const id of Object.keys(KIT.palette.hall))nativeMaterials.set(id,images[id]);reset();applyRoomPalette();window.KIT_TEST={get state(){return{frame,playing,direction,action:action(),pushPhase:pushState()?.phase,plateDown:plateDown(),plateBlend,layout,door,questStage,battle:{heroHp:battle.heroHp,enemyHp:battle.enemyHp,enemy:{...battle.enemy},enemyPhase:battle.enemyPhase,attack:battle.attack!==null,swingDirection:battle.attack?.direction??null,hurtDirection:battle.hurtDirection,pose:layout==='arena'?currentBattlePose():null,hurt:battle.hurt,escaped:battle.escaped},player:{...player},crate:{...crate},pushing:!!pushing,crateVisual:cratePosition()};},geometry:{northWallCells,gate:GATE,corners},setPlayer:(x,y)=>{player={x,y};},move,push,draw,images};document.querySelector('#qa').textContent='四方向独立待机、行走和推箱；推箱先靠近接触，再同步移动箱子。在朝向和动作中选择攻击或受击，再用下一帧检查。战斗时，出剑方向与脚下高亮的命中范围一致。';requestAnimationFrame(tick);}).catch(e=>document.querySelector('#status').textContent=e.message);
