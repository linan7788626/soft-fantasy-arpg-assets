/* Source pixels are never rewritten. The manifest supplies calibrated source rectangles. */
const canvas=document.querySelector('#stage'),ctx=canvas.getContext('2d'),strip=document.querySelector('#frames'),fx=strip.getContext('2d');
const images={},T=64,OX=100,OY=110;let frame=0,playing=true,debug=false,door=false,layout='hall',time=0,last=0,acc=0;let player={x:2,y:5},crate={x:5,y:4},plate={x:7,y:4};const keys=new Set();
const asset=id=>KIT.assets.find(a=>a.id===id);
function sprite(c,id,x,y,w,h,flip=false){const a=asset(id),r=a.rect;c.save();if(flip){c.translate(x+w,y);c.scale(-1,1);x=0;y=0;}c.drawImage(images[id],...r,x,y,w,h);c.restore();}
function floor(x,y){if(door&&y===-1&&x>=5&&x<7)return true;return x>=0&&y>=0&&x<12&&y<8&&(layout!=='elbow'||x<6||y<4);}
function solid(x,y){const ix=Math.floor(x),iy=Math.floor(y);return !floor(ix,iy)||(layout==='puzzle'&&ix===8&&iy!==4)||(ix===Math.round(crate.x)&&iy===Math.round(crate.y));}
function reset(){player={x:2.5,y:5.5};crate={x:5,y:4};plate={x:7,y:4};door=false;}
function move(dx,dy){let x=player.x+dx,y=player.y+dy;if(!solid(x,player.y))player.x=x;if(!solid(player.x,y))player.y=y;}
function push(){const dx=Math.sign(Math.round(crate.x+.5-player.x)),dy=Math.sign(Math.round(crate.y+.5-player.y));if(Math.hypot(crate.x+.5-player.x,crate.y+.5-player.y)>1.8)return;const ox=crate.x,oy=crate.y;crate={x:-20,y:-20};const nx=ox+(Math.abs(dx)>=Math.abs(dy)?dx:0),ny=oy+(Math.abs(dy)>Math.abs(dx)?dy:0);crate=solid(nx+.5,ny+.5)?{x:ox,y:oy}:{x:nx,y:ny};door=crate.x===plate.x&&crate.y===plate.y;}
function hero(c,index,x,y,h=100){const f=KIT.walk.frames[index],r=f.rect,w=r[2]/r[3]*h;c.drawImage(images.walk,...r,x-w*f.pivot[0],y-h*f.pivot[1],w,h);}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);const bg=document.querySelector('#background').value;ctx.fillStyle=bg==='light'?'#e8e2d7':'#25343d';ctx.fillRect(0,0,1120,780);if(bg==='checker')for(let y=0;y<780;y+=24)for(let x=0;x<1120;x+=24){ctx.fillStyle=((x+y)/24)%2?'#ddd':'#aab7be';ctx.fillRect(x,y,24,24);}
ctx.save();ctx.beginPath();for(let y=-1;y<8;y++)for(let x=0;x<12;x++)if(floor(x,y))ctx.rect(OX+x*T,OY+y*T,T,T);ctx.clip();for(let y=0;y<8;y+=6)for(let x=0;x<12;x+=6)sprite(ctx,'floor',OX+x*T,OY+y*T,6*T,6*T);ctx.restore();
for(let y=-1;y<8;y++)for(let x=0;x<12;x++)if(floor(x,y)){
 if(!floor(x,y-1))sprite(ctx,'wall',OX+x*T-2,OY+y*T-30,T+4,42);
 if(!floor(x-1,y))sprite(ctx,'sidewall',OX+x*T-20,OY+y*T-4,32,T+8);
 if(!floor(x+1,y))sprite(ctx,'sidewall',OX+(x+1)*T-12,OY+y*T-4,32,T+8,true);
 if(!floor(x,y+1))sprite(ctx,'wall',OX+x*T-2,OY+(y+1)*T-8,T+4,42);
 if(debug){ctx.strokeStyle='#de7373';ctx.strokeRect(OX+x*T,OY+y*T,T,T);}
}
if(layout==='puzzle')for(let y=0;y<8;y++)if(y!==4)sprite(ctx,'sidewall',OX+8*T,OY+y*T,32,T);
for(const [x,y] of [[0,0],[12,0],[0,8],[12,8]])if(floor(Math.min(x,11),Math.min(y,7)))sprite(ctx,'pillar',OX+x*T-20,OY+y*T-42,40,60);
sprite(ctx,'plate',OX+plate.x*T,OY+plate.y*T,T,T*.7);sprite(ctx,'crate',OX+crate.x*T,OY+crate.y*T-16,T,T);sprite(ctx,door?'door_open':'door_closed',OX+5*T,OY-106,T*2,128);
hero(ctx,frame,OX+player.x*T,OY+player.y*T,104);
ctx.strokeStyle='#58e8d8';ctx.beginPath();ctx.moveTo(OX+player.x*T-12,OY+player.y*T);ctx.lineTo(OX+player.x*T+12,OY+player.y*T);ctx.stroke();
fx.clearRect(0,0,1120,240);fx.fillStyle=bg==='light'?'#e8e2d7':'#25343d';fx.fillRect(0,0,1120,240);for(let i=0;i<KIT.walk.frames.length;i++){hero(fx,i,90+i*180,195,170);fx.strokeStyle=i===frame?'#ffd270':'#677b80';fx.strokeRect(i*180+4,15,172,205);fx.beginPath();fx.moveTo(i*180+8,195);fx.lineTo(i*180+172,195);fx.stroke();fx.fillStyle='#f9d989';fx.fillText(String(i+1),i*180+8,232);}
document.querySelector('#status').textContent=`${layout} · 第 ${frame+1}/${KIT.walk.frames.length} 帧 · ${door?'门已开启':'门关闭'} · 玩家 ${player.x.toFixed(2)},${player.y.toFixed(2)}`;}
function tick(t){const dt=Math.min((t-last)/1000,.05)||0;last=t;let dx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),dy=(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0);if(dx||dy){const n=Math.hypot(dx,dy);move(dx/n*dt*2.2,dy/n*dt*2.2);}if(playing){acc+=dt;const interval=1/Number(document.querySelector('#fps').value);if(acc>=interval){frame=(frame+1)%KIT.walk.frames.length;acc%=interval;}}draw();requestAnimationFrame(tick);}
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();keys.add(e.key);if(e.key.toLowerCase()==='e'&&!e.repeat)push();});window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());
document.querySelector('#layout').onchange=e=>{layout=e.target.value;reset();};document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'暂停循环':'播放循环';};document.querySelector('#step').onclick=()=>{playing=false;frame=(frame+1)%KIT.walk.frames.length;};document.querySelector('#door').onclick=()=>door=!door;document.querySelector('#collision').onclick=()=>debug=!debug;
Promise.all([...KIT.assets.map(a=>[a.id,a.file]),['walk',KIT.walk.file]].map(([id,path])=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{images[id]=img;resolve();};img.onerror=()=>reject(Error('图片无法加载: '+path));img.src=KIT.embeddedImages?.[id] || '../../Assets/NLI_Prototype_Kit/'+path;}))).then(()=>{reset();window.KIT_TEST={get state(){return{frame,playing,layout,door,player:{...player},crate:{...crate}};},setPlayer:(x,y)=>{player={x,y};},move,push,draw,images};document.querySelector('#qa').textContent=KIT.walk.note;requestAnimationFrame(tick);}).catch(e=>document.querySelector('#status').textContent=e.message);
