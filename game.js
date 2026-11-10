(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const W=14,H=14,TAU=Math.PI*2;
let cw=innerWidth,ch=innerHeight,dpr=1,tileW=58,tileH=29,cam={x:0,y:0};
let keys={},held={x:0,y:0},lastFrame=0,toastTimer=0,nearTarget=null,interactTarget=null,walkTarget=null,walkPath=[];
const initial={hp:100,focus:3,core:false,medkit:false,power:true,terminal:false,lights:true,guardStun:0,guardDistracted:0,alarm:0,noise:0,escaped:false,steps:0,choices:0,crateMoved:false,plantHarvested:false,logs:false,exitOpen:false};
let state={...initial};
const player={x:2.1,y:10.1,face:1,walk:0,anim:0};
const props=[
 {id:'power',x:3,y:3,name:'Распределительный щит',type:'ЭНЕРГОУЗЕЛ',desc:'Потрескивающий щит держит оранжерею под напряжением. На крышке наклейка: «не отключать при цветении».',kind:'panel',blocking:true},
 {id:'terminal',x:9,y:3,name:'Архивный терминал',type:'ТЕРМИНАЛ',desc:'Стекло запотело изнутри. В журнале наверняка есть запись о ядре памяти.',kind:'terminal',blocking:true},
 {id:'core',x:10,y:5,name:'Ядро памяти',type:'ЦЕЛЬ ОПЕРАЦИИ',desc:'Стеклянная капсула пульсирует тусклым зелёным. Внутри — последние воспоминания станции.',kind:'core',blocking:true},
 {id:'plant',x:6,y:8,name:'Лунная орхидея',type:'ЖИВОЙ ОБЪЕКТ',desc:'Редкое растение раскрывает лепестки в темноте. Пыльца щекочет нос — может быть, она действует на охранного дрона.',kind:'plant',blocking:true},
 {id:'crate',x:5,y:6,name:'Транспортный контейнер',type:'ПЕРЕМЕЩАЕМЫЙ ОБЪЕКТ',desc:'Тяжёлый ящик перекрывает узкий проход. За ним что-то поблёскивает.',kind:'crate',blocking:true},
 {id:'locker',x:2,y:7,name:'Аптечный шкафчик',type:'КОНТЕЙНЕР',desc:'Дверца заперта на простой магнитный замок. Внутри может быть аптечка.',kind:'locker',blocking:true},
 {id:'radio',x:4,y:10,name:'Садовый динамик',type:'ОКРУЖЕНИЕ',desc:'Старый динамик подключён к системе оповещения. Он ещё работает.',kind:'radio',blocking:true},
 {id:'exit',x:11,y:10,name:'Шлюз наружу',type:'ВЫХОД',desc:'Снаружи туман и свобода. Шлюз заперт изнутри.',kind:'exit',blocking:true},
 {id:'guard',x:8,y:9,name:'Сторожевой дрон',type:'УГРОЗА',desc:'Он патрулирует между клумбами. Сенсор реагирует на свет, звук и движение.',kind:'guard',blocking:false,patrol:0}
];
const wallBlocks=[];for(let x=0;x<W;x++){wallBlocks.push({x,y:0},{x,y:H-1})}for(let y=1;y<H-1;y++){wallBlocks.push({x:0,y},{x:W-1,y})}
const blocked=(x,y)=>{if(x<.55||y<.55||x>W-1.55||y>H-1.55)return true;return props.some(p=>p.blocking&&Math.abs(p.x-x)<.62&&Math.abs(p.y-y)<.62)||wallBlocks.some(b=>Math.abs(b.x-x)<.55&&Math.abs(b.y-y)<.55)};
function resize(){cw=innerWidth;ch=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.floor(cw*dpr);canvas.height=Math.floor(ch*dpr);canvas.style.width=cw+'px';canvas.style.height=ch+'px';ctx.setTransform(dpr,0,0,dpr,0,0);tileW=Math.min(cw<760?38:65,cw/(cw<760?10.3:19),ch/(cw<760?7.1:10.2));tileW=Math.max(tileW,18);tileH=tileW*.5}
addEventListener('resize',resize,{passive:true});resize();
const iso=(x,y)=>({x:(x-y)*tileW*.5,y:(x+y)*tileH*.5});
function screen(x,y,z=0){const p=iso(x,y);return{x:p.x-cam.x+cw/2,y:p.y-cam.y+ch*.52-z}}
const polygon=(points,fill,stroke=null,lw=1)=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}};
function ellipse(x,y,rx,ry,color,blur=0){ctx.save();if(blur){ctx.shadowColor=color;ctx.shadowBlur=blur}ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();ctx.restore()}
function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
function glow(x,y,r,color){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}}
function drawTile(x,y){const p=screen(x,y);const hw=tileW/2,hh=tileH/2;let color=((x*7+y*13)%5===0)?'#182d27':'#142821';if((x+y)%7===0)color='#172b24';polygon([{x:p.x,y:p.y},{x:p.x+hw,y:p.y+hh},{x:p.x,y:p.y+tileH},{x:p.x-hw,y:p.y+hh}],color,'#9cc0a50b',.7);
 if((x*13+y*7)%29===2){line(p.x-4,p.y+hh+2,p.x+3,p.y+hh-1,'#93b09b15',1)}
 if((x+y)%8===1&&x>0&&y>0){ellipse(p.x+((x%3)-1)*5,p.y+hh+2,1.3,1,'#b3c99820')}
}
function drawWall(x,y){const p=screen(x,y),hw=tileW*.5,hh=tileH*.5,h=tileW*.42;polygon([{x:p.x-hw,y:p.y+hh},{x:p.x,y:p.y+tileH},{x:p.x,y:p.y+tileH+h},{x:p.x-hw,y:p.y+hh+h}], '#17241f','#8ba68b18');polygon([{x:p.x,y:p.y+tileH},{x:p.x+hw,y:p.y+hh},{x:p.x+hw,y:p.y+hh+h},{x:p.x,y:p.y+tileH+h}], '#0d1a17','#8ba68b10');polygon([{x:p.x-hw,y:p.y+hh},{x:p.x,y:p.y},{x:p.x+hw,y:p.y+hh},{x:p.x,y:p.y+tileH}], '#26382e','#a6c5a51c');line(p.x-hw,p.y+hh,p.x,p.y+tileH,'#b5c5a40d',1)}
function drawProps(p){const s=screen(p.x,p.y),z=tileW;
 if(p.kind==='panel'||p.kind==='terminal'||p.kind==='exit'){
  const isExit=p.kind==='exit',isTerm=p.kind==='terminal';
  ellipse(s.x,s.y+tileH*.43,z*.39,z*.15,'#03080780');
  let ww=z*(isExit?.52:.48),hh=z*.52;rounded(s.x-ww/2,s.y-hh*.48,ww,hh,5,isExit?'#1a2c25':'#24352e','#8198893c');
  rounded(s.x-ww*.38,s.y-hh*.36,ww*.76,hh*.55,3,isExit?'#10211b':(isTerm?'#23443b':'#1b3930'),'#a5c6a834');
  if(isExit){line(s.x-ww*.29,s.y-hh*.32,s.x-ww*.29,s.y+hh*.12,'#76907d66',1.5);line(s.x+ww*.29,s.y-hh*.32,s.x+ww*.29,s.y+hh*.12,'#76907d66',1.5);ellipse(s.x+ww*.3,s.y-hh*.03,2,2,state.core?'#c8f17b':'#de9d63',5)}
  else{rounded(s.x-ww*.28,s.y-hh*.3,ww*.56,hh*.31,2,state.power?(state.terminal?'#88c479':'#76b28a'):'#4c5043');line(s.x-ww*.2,s.y+hh*.03,s.x+ww*.19,s.y+hh*.03,'#d7f0c65c',1);ellipse(s.x+ww*.3,s.y-hh*.38,2,2,state.power?'#c8f17b':'#d26359',7)}
  if(isTerm&&state.terminal)glow(s.x,s.y-hh*.2,z*.45,'#70d78d20');
 }else if(p.kind==='core'){
  ellipse(s.x,s.y+tileH*.45,z*.31,z*.13,'#030807a0');
  rounded(s.x-z*.22,s.y-z*.52,z*.44,z*.48,5,'#182822','#94b6a346');
  rounded(s.x-z*.14,s.y-z*.47,z*.28,z*.32,7,'#89b98926','#d6e5c747');
  ellipse(s.x,s.y-z*.31,z*.075,z*.08,state.core?'#60715d':'#c8f17b',10);
  if(!state.core)glow(s.x,s.y-z*.3,z*.55,'#8bd47831');
 }else if(p.kind==='plant'){
  ellipse(s.x,s.y+tileH*.35,z*.3,z*.12,'#03080780');
  for(let i=0;i<5;i++){let a=i*TAU/5;let ex=s.x+Math.cos(a)*z*.18,ey=s.y-z*.14+Math.sin(a)*z*.12;ctx.save();ctx.translate(ex,ey);ctx.rotate(a*.28);ellipse(0,0,z*.08,z*.19,'#3f7a58');ellipse(0,-z*.11,z*.045,z*.12,'#77b979');ctx.restore()}
  ellipse(s.x,s.y-z*.18,z*.095,z*.095,'#d5eaa1',12);ellipse(s.x,s.y-z*.18,z*.04,z*.04,'#f3edc3',4);
 }else if(p.kind==='crate'){
  const lifted=state.crateMoved?z*.28:0;
  polygon([{x:s.x-z*.28,y:s.y-z*.2-lifted},{x:s.x,y:s.y-z*.34-lifted},{x:s.x+z*.28,y:s.y-z*.2-lifted},{x:s.x,y:s.y-z*.06-lifted}], '#806648','#d0b18137');
  polygon([{x:s.x-z*.28,y:s.y-z*.2-lifted},{x:s.x,y:s.y-z*.06-lifted},{x:s.x,y:s.y+z*.22-lifted},{x:s.x-z*.28,y:s.y+z*.06-lifted}], '#493d2d','#c9a87726');
  polygon([{x:s.x,y:s.y-z*.06-lifted},{x:s.x+z*.28,y:s.y-z*.2-lifted},{x:s.x+z*.28,y:s.y+z*.06-lifted},{x:s.x,y:s.y+z*.22-lifted}], '#65523a','#c9a87726');
  line(s.x-z*.2,s.y-z*.09-lifted,s.x-z*.2,s.y+z*.09-lifted,'#d3b98444',2);line(s.x+z*.2,s.y-z*.11-lifted,s.x+z*.2,s.y+z*.09-lifted,'#d3b98444',2);
 }else if(p.kind==='locker'){
  rounded(s.x-z*.22,s.y-z*.48,z*.44,z*.52,4,'#596952','#bfca9c48');rounded(s.x-z*.16,s.y-z*.43,z*.32,z*.4,2,'#28362b','#d5d9ad30');ellipse(s.x+z*.1,s.y-z*.22,2,2,'#c8f17b',3);
 }else if(p.kind==='radio'){
  ellipse(s.x,s.y+tileH*.3,z*.27,z*.1,'#03080780');rounded(s.x-z*.2,s.y-z*.38,z*.4,z*.48,5,'#34453c','#a9bb9b40');rounded(s.x-z*.13,s.y-z*.3,z*.26,z*.12,3,'#182822','#bdc8ac30');for(let i=0;i<4;i++)line(s.x-z*.14,s.y-z*.09+i*3,s.x+z*.13,s.y-z*.09+i*3,'#abb99655',1);ellipse(s.x+z*.1,s.y-z*.27,2,2,'#d68a5f',4);
 }else if(p.kind==='guard')drawGuard(p,s,z);
}
function drawGuard(p,s,z){const stun=state.guardStun>0,dist=state.guardDistracted>0;ellipse(s.x,s.y+tileH*.3,z*.31,z*.12,'#030807a0');
 const bob=Math.sin(performance.now()*.006)*2;ellipse(s.x,s.y-z*.16+bob,z*.17,z*.23,stun?'#52655d':'#728177');rounded(s.x-z*.14,s.y-z*.43+bob,z*.28,z*.27,8,stun?'#43584e':'#8c9b8c','#d0d5b94c');
 rounded(s.x-z*.11,s.y-z*.37+bob,z*.22,z*.09,5,dist?'#9ccf92':(stun?'#c8f17b':'#df625c'),10);line(s.x-z*.25,s.y-z*.14+bob,s.x-z*.4,s.y-z*.03+bob,'#78887c',3);line(s.x+z*.25,s.y-z*.14+bob,s.x+z*.4,s.y-z*.03+bob,'#78887c',3);
 if(!stun&&!dist){ctx.save();ctx.globalAlpha=.12;ctx.fillStyle='#ff6960';ctx.beginPath();ctx.moveTo(s.x,s.y-z*.37);ctx.lineTo(s.x-z*.95,s.y-z*1.9);ctx.lineTo(s.x+z*.9,s.y-z*1.9);ctx.closePath();ctx.fill();ctx.restore()}
}
function drawPlayer(){const s=screen(player.x,player.y),z=tileW,bob=Math.sin(player.anim*9)*1.7;ellipse(s.x,s.y+tileH*.31,z*.26,z*.11,'#010604aa');
 // backpack and coat silhouette
 ctx.save();ctx.translate(s.x,s.y+bob);polygon([{x:-z*.18,y:-z*.36},{x:0,y:-z*.49},{x:z*.18,y:-z*.36},{x:z*.16,y:-z*.05},{x:0,y:z*.02},{x:-z*.16,y:-z*.05}],'#617465','#c2d0b532');
 rounded(-z*.1,-z*.41,z*.2,z*.13,5,'#455849','#9eae9a44');ellipse(0,-z*.53,z*.105,z*.12,'#d0bea0');rounded(-z*.08,-z*.55,z*.16,z*.045,3,'#222e27');
 const lamp=state.lights?1:.35;ellipse(player.face>0?z*.13:-z*.13,-z*.51,2,2,'#d6eeaa',5*lamp);ctx.restore();
}
function drawFloorDetails(){// worn path and greenhouse glass reflections
 const pts=[[1,10],[2,10],[3,10],[4,10],[5,9],[6,9],[7,8],[8,7],[9,6],[10,6],[10,7],[10,8],[10,9],[10,10],[11,10]];
 for(const [x,y] of pts){let p=screen(x,y);polygon([{x:p.x,y:p.y+tileH*.48},{x:p.x+tileW*.12,y:p.y+tileH*.58},{x:p.x,y:p.y+tileH*.67},{x:p.x-tileW*.12,y:p.y+tileH*.58}],'#9fb4880b')}
}
function drawLightAtmosphere(){for(const q of [[3,3,'#bdd98120'],[9,3,'#67c8891c'],[6,8,'#b3da7920'],[11,10,'#f0aa6530']]){const p=screen(q[0],q[1]);glow(p.x,p.y-tileW*.18,tileW*1.2,q[2])}
 // fine dust motes, deterministic drifting
 const now=performance.now()*.0001;for(let i=0;i<28;i++){let x=((i*137.5+Math.sin(now+i)*19)%cw+cw)%cw,y=((i*83+now*24)%ch);ellipse(x,y,1,1,'#d1e8bd23')}
}
function render(){ctx.clearRect(0,0,cw,ch);const bg=ctx.createLinearGradient(0,0,0,ch);bg.addColorStop(0,'#1a3027');bg.addColorStop(.55,'#13271f');bg.addColorStop(1,'#0b1c17');ctx.fillStyle=bg;ctx.fillRect(0,0,cw,ch);
 // camera follows the player but keeps the playfield just below the HUD
 const target=iso(player.x,player.y);cam.x+=(target.x-cam.x)*.09;cam.y+=(target.y+tileH*.1-cam.y)*.09;
 for(let d=0;d<W+H;d++)for(let x=0;x<W;x++){let y=d-x;if(y<0||y>=H)continue;drawTile(x,y)}
 drawFloorDetails();
 // distant greenhouse frames
 for(let x=2;x<12;x+=3){let p=screen(x,1);line(p.x,p.y-tileW*.95,p.x,p.y+tileH*.15,'#a8c9a317',2);line(p.x-tileW*.28,p.y-tileW*.81,p.x+tileW*.3,p.y-tileW*.81,'#b4d2a41a',1)}
 const all=[...wallBlocks.map(b=>({...b,kind:'wall'})),...props.map(p=>({...p,kind:p.kind}))].sort((a,b)=>(a.x+a.y)-(b.x+b.y));
 for(const o of all){if(o.kind==='wall')drawWall(o.x,o.y);else drawProps(o)}
 drawPlayer();drawLightAtmosphere();
 // gentle color grade overlay
 const shade=ctx.createRadialGradient(cw*.5,ch*.48,Math.min(cw,ch)*.16,cw*.5,ch*.48,Math.max(cw,ch)*.72);shade.addColorStop(0,'transparent');shade.addColorStop(1,'#02080555');ctx.fillStyle=shade;ctx.fillRect(0,0,cw,ch);
 if(nearTarget&&!interactTarget){const s=screen(nearTarget.x,nearTarget.y);rounded(s.x-34,s.y-tileW*.85,68,22,6,'#081811d9','#d6e8d92c');ctx.fillStyle='#d9e8d9';ctx.font=`${Math.max(8,tileW*.15)}px Manrope`;ctx.textAlign='center';ctx.fillText('E · '+nearTarget.name,s.x,s.y-tileW*.7)}
}
function loop(ts){const dt=Math.min(.04,(ts-lastFrame)/1000||0);lastFrame=ts;update(dt);render();requestAnimationFrame(loop)}
function update(dt){player.anim+=dt;state.guardStun=Math.max(0,state.guardStun-dt);state.guardDistracted=Math.max(0,state.guardDistracted-dt);
 let dx=held.x,dy=held.y;if(keys.arrowup||keys.w)dy-=1;if(keys.arrowdown||keys.s)dy+=1;if(keys.arrowleft||keys.a)dx-=1;if(keys.arrowright||keys.d)dx+=1;
 if(dx||dy){const n=Math.hypot(dx,dy);dx/=n;dy/=n;player.face=dx>=0?1:-1;const speed=2.15;tryMove(dx*speed*dt,dy*speed*dt);player.walk+=dt;walkTarget=null;walkPath=[]}else player.walk=0;
 if(walkTarget&&!interactTarget){while(walkPath.length&&Math.hypot(walkPath[0].x-player.x,walkPath[0].y-player.y)<.035)walkPath.shift();const waypoint=walkPath[0]||walkTarget,tx=waypoint.x-player.x,ty=waypoint.y-player.y,dist=Math.hypot(tx,ty),range=walkTarget.id? .98:.28;if(!walkPath.length&&dist<range){const t=walkTarget;walkTarget=null;openInteraction(t)}else if(dist>.01){const step=Math.min(dist,1.75*dt),px=player.x,py=player.y;tryMove(tx/dist*step,ty/dist*step);player.face=tx>=0?1:-1;player.walk+=dt;if(Math.hypot(player.x-px,player.y-py)<.001){walkTarget=null;walkPath=[];showToast('Путь перекрыт. Попробуйте подойти с другой стороны.')}}}
 const guard=props.find(p=>p.id==='guard');if(guard){if(state.guardStun<=0&&state.guardDistracted<=0){guard.patrol+=dt;guard.x=8+Math.sin(guard.patrol*.28)*.65;guard.y=9+Math.cos(guard.patrol*.42)*.5}
 const gd=Math.hypot(player.x-guard.x,player.y-guard.y);if(gd<1.25&&state.guardStun<=0&&state.guardDistracted<=0){state.hp=Math.max(0,state.hp-10*dt);state.alarm=Math.min(100,state.alarm+5*dt);if(Math.floor(performance.now()/1000)%3===0)showToast('Дрон заметил вас — отступите или отвлеките его');if(state.hp<=0){state.hp=36;showToast('Вы пришли в себя у входа. Дрон не отступил.');player.x=2.1;player.y=10.1}}}
 const candidates=props.filter(p=>Math.hypot(player.x-p.x,player.y-p.y)<1.55).sort((a,b)=>Math.hypot(player.x-a.x,player.y-a.y)-Math.hypot(player.x-b.x,player.y-b.y));nearTarget=candidates[0]||null;
 updateHud();}
function tryMove(dx,dy){let nx=player.x+dx,ny=player.y+dy;if(!blocked(nx,player.y))player.x=nx;if(!blocked(player.x,ny))player.y=ny;if(Math.abs(dx)+Math.abs(dy)>.03)state.steps+=Math.abs(dx)+Math.abs(dy)}
function findWalkPath(target){
  const step=.1,goalRadius=target.id ? .75 : .08,key=(i,j)=>`${i},${j}`,heuristic=(x,y)=>Math.max(0,Math.hypot(target.x-x,target.y-y)-goalRadius);
  const start={i:0,j:0,x:player.x,y:player.y,g:0,parent:null},open=[{...start,f:heuristic(start.x,start.y)}],best=new Map([[key(0,0),start]]),dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  let found=null,iterations=0;
  while(open.length&&iterations++<10000){open.sort((a,b)=>a.f-b.f);const current=open.shift(),known=best.get(key(current.i,current.j));if(!known||current.g!==known.g)continue;
    if((current.i||current.j)&&Math.hypot(target.x-current.x,target.y-current.y)<goalRadius){found=current;break}
    for(const [di,dj] of dirs){const i=current.i+di,j=current.j+dj,x=player.x+i*step,y=player.y+j*step;if(blocked(x,y))continue;if(di&&dj&&(blocked(current.x+di*step,current.y)||blocked(current.x,current.y+dj*step)))continue;
      const g=current.g+step*(di&&dj?Math.SQRT2:1),k=key(i,j),prior=best.get(k);if(prior&&prior.g<=g)continue;
      const node={i,j,x,y,g,parent:current};best.set(k,node);open.push({...node,f:g+heuristic(x,y)});
    }
  }
  if(!found)return null;const path=[];for(let node=found;node&&node.parent;node=node.parent)path.push({x:node.x,y:node.y});return path.reverse();
}
function setWalkTarget(target){walkTarget=target;walkPath=findWalkPath(target)||[];if(!walkPath.length){walkTarget=null;showToast('Не удалось найти свободный путь. Попробуйте другую сторону.');return false}showToast('Иду к объекту…');return true}
function showToast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100)}
function updateHud(){ $('healthFill').style.width=state.hp+'%';$('healthValue').textContent=Math.round(state.hp);$('focusFill').style.width=(state.focus/3*100)+'%';$('focusValue').textContent=state.focus;
 $('conditionText').textContent=state.hp<45?'Ранена':state.alarm>55?'Тревога':state.guardStun>0?'В безопасности':'В норме';
 const items=[];if(state.core)items.push('Ядро');if(state.medkit)items.push('Аптечка');if(state.logs)items.push('Код доступа');if(state.plantHarvested)items.push('Пыльца');$('inventory').innerHTML=items.map(x=>`<span class="item-chip">${x}</span>`).join('')||'—';
 const progress=state.escaped?100:state.core?78:state.terminal?49:state.power?23:9;$('objectiveFill').style.width=progress+'%';
 if(state.escaped){$('missionKicker').textContent='ОПЕРАЦИЯ · ЗАВЕРШЕНА';$('missionStep').textContent='03 / 03';$('missionTitle').textContent='Вы вышли из тумана';$('missionText').textContent='Ваш выбор изменил судьбу станции. Но не все её истории закончились.'}
 else if(state.core){$('missionKicker').textContent='ОПЕРАЦИЯ · ПОСЛЕДНИЙ ШАГ';$('missionStep').textContent='02 / 03';$('missionTitle').textContent='Доберитесь до шлюза';$('missionText').textContent='Ядро у вас. Выход на юго-востоке — решите, как миновать дрона.'}
 else if(state.terminal){$('missionText').textContent='Архив открыт. Ядро памяти находится в витрине у северной стены.'}
 else if(!state.power){$('missionText').textContent='Нет питания. Восстановите ток на щите или найдите другой путь.'}
}
function openInteraction(target){if(!target)return;interactTarget=target;walkTarget=null;const panel=$('interaction');$('targetType').textContent=target.type;$('targetName').textContent=target.name;$('targetDescription').textContent=target.desc;
 const list=[];const add=(title,sub,fn,primary=false)=>list.push({title,sub,fn,primary});
 if(target.id==='power'){
  if(!state.power)add('Восстановить питание','Включить щит. Терминал и свет снова заработают.',()=>{state.power=true;state.lights=true;state.alarm=Math.max(0,state.alarm-8);showToast('Питание восстановлено. Оранжерея проснулась.')},true);
  else add('Отключить освещение','Погасить свет. Дрон хуже видит, но терминал отключится.',()=>{state.power=false;state.lights=false;state.guardDistracted=Math.max(state.guardDistracted,9);showToast('Темнота укрывает вас. Дрон сбит с толку.')});
  add('Перегрузить цепь','Оглушить дрона на 12 секунд. Станция заметит скачок.',()=>{state.guardStun=12;state.alarm=Math.min(100,state.alarm+22);state.noise++;showToast('Вспышка! Дрон отключён на 12 секунд.')});
  add('Изучить схему','Система охлаждения подключена к той же линии.',()=>showToast('Подсказка: свет можно погасить, не отключая питание полностью.'));
 }else if(target.id==='terminal'){
  if(!state.power)add('Подать резервное питание','Потратить 1 фокус, чтобы запустить терминал.',()=>{if(state.focus<1){showToast('Не хватает фокуса. Включите щит.');return}state.focus--;state.terminal=true;state.logs=true;showToast('Резервная батарея запустила архив. Код доступа записан.')});
  else if(!state.terminal){add('Тихо подключиться','Прочитать журнал и получить код шлюза.',()=>{state.terminal=true;state.logs=true;showToast('Журнал: «ядро в витрине; код шлюза — 0417».')},true);add('Взломать тревожную сеть','Отключить сенсоры на время, но поднять тревогу.',()=>{state.terminal=true;state.logs=true;state.guardStun=9;state.alarm+=25;showToast('Сенсоры ослепли. У вас есть несколько секунд.')})}
  else add('Проверить журнал','Запись: «Не буди сад. Он помнит всё».',()=>showToast('Последняя запись: «не буди сад. Он помнит всё».'));
 }else if(target.id==='core'){
  if(state.core)add('Осмотреть пустую витрину','Ядро теперь у вас. Выйдите через шлюз.',()=>showToast('Воспоминания станции — в вашем рюкзаке.'));
  else{add('Бережно извлечь ядро','Потратить 1 фокус. Без шума и тревоги.',()=>{if(state.focus<1){showToast('Фокус исчерпан. Можно вырвать ядро силой.');return}state.focus--;state.core=true;state.alarm=Math.min(100,state.alarm+3);showToast('Ядро извлечено. Почти бесшумно.')},true);add('Вырвать из капсулы','Быстро, но громко. Дрон услышит.',()=>{state.core=true;state.alarm=Math.min(100,state.alarm+35);state.guardDistracted=Math.max(0,state.guardDistracted);showToast('Стекло треснуло. Дрон направился к витрине!')});}
 }else if(target.id==='plant'){
  if(!state.plantHarvested)add('Собрать пыльцу','Получить одноразовый отвлекающий порошок.',()=>{state.plantHarvested=true;state.focus=Math.min(3,state.focus+1);showToast('Пыльца собрана. Фокус восстановлен.')},true);
  else add('Рассеять пыльцу','Отвлечь дрона на 18 секунд.',()=>{state.plantHarvested=false;state.guardDistracted=18;showToast('Дрон следует за светящимися спорами.')});
  add('Понюхать цветок','Пыльца вызывает тёплое воспоминание.',()=>{state.focus=Math.min(3,state.focus+1);showToast('На миг вы вспомнили сад своего детства. +1 фокус.')});
 }else if(target.id==='crate'){
  if(!state.crateMoved)add('Сдвинуть контейнер','Открыть короткий проход. Шум привлечёт дрона.',()=>{state.crateMoved=true;target.blocking=false;target.x=5.8;state.noise++;state.alarm=Math.min(100,state.alarm+8);showToast('Ящик сдвинут. За ним — следы пыльцы.')},true);
  else add('Осмотреть за ящиком','На полу вы находите маркировку «Север».',()=>showToast('Старый груз шёл из северного архива.'));
  add('Подслушать вибрации','За стеной гудит резервный насос.',()=>showToast('Кажется, где-то есть второй источник питания.'));
 }else if(target.id==='locker'){
  if(!state.medkit){add('Аккуратно вскрыть','Потратить 1 фокус, не поднимая тревогу.',()=>{if(state.focus<1){showToast('Не хватает фокуса. Попробуйте силой.');return}state.focus--;state.medkit=true;showToast('Аптечка добавлена в снаряжение.')},true);add('Выбить дверцу','Получить аптечку, но привлечь внимание.',()=>{state.medkit=true;state.alarm+=12;state.noise++;showToast('Дверца поддалась. Шум разнёсся по теплице.')})}
  else add('Использовать аптечку','Восстановить 45 здоровья.',()=>{state.medkit=false;state.hp=Math.min(100,state.hp+45);showToast('Здоровье восстановлено.')},true);
 }else if(target.id==='radio'){
  add('Включить зов журавлей','Отправить дрона проверить дальнюю теплицу.',()=>{state.guardDistracted=20;state.alarm=Math.min(100,state.alarm+4);showToast('Дрон двинулся на звук. Действуйте быстро.')},true);
  add('Настроить частоту','Поймать тихую передачу из внешнего мира.',()=>showToast('«...если кто-то слышит, не трогайте цветы...»'));
 }else if(target.id==='guard'){
  if(state.guardStun>0)add('Пройти мимо','Дрон отключён ещё на несколько секунд.',()=>{closeInteraction();showToast('Двигайтесь, пока он не перезапустился.')},true);
  else{add('Тихо обезвредить','Потратить 1 фокус. Оглушить на 16 секунд.',()=>{if(state.focus<1){showToast('Не хватает фокуса. Сначала найдите пыльцу.');return}state.focus--;state.guardStun=16;state.alarm=Math.min(100,state.alarm+4);showToast('Дрон обезврежен бесшумно.')},true);add('Бросить предмет в сторону','Создать шум и увести дрона на 9 секунд.',()=>{state.guardDistracted=9;state.alarm=Math.min(100,state.alarm+10);showToast('Дрон отвлечён шумом.')});}
 }else if(target.id==='exit'){
  if(state.core){add('Открыть шлюз и уйти','Завершить операцию. Ваши действия повлияют на исход.',()=>finishGame(),true)}
  else{add('Проверить замок','Нужен код из архива или грубая сила.',()=>showToast(state.logs?'Код доступа 0417 подойдёт.':'Ищите код в архивном терминале.'),true);if(state.logs)add('Ввести код 0417','Открыть шлюз бесшумно.',()=>{state.exitOpen=true;showToast('Шлюз разблокирован. Осталось забрать ядро.')});add('Взломать замок','Силой открыть только после получения ядра.',()=>showToast('Наружный механизм блокирует выход. Найдите ядро для ручного сброса.'))}
 }
 $('choices').innerHTML='';for(const choice of list){const b=document.createElement('button');b.className='choice'+(choice.primary?' primary':'');b.innerHTML=`<div>${choice.title}<small>${choice.sub||''}</small></div><span>↗</span>`;b.addEventListener('click',()=>{state.choices++;choice.fn();updateHud();if(state.escaped)return;closeInteraction();updateHud()});$('choices').appendChild(b)}
 panel.classList.add('open');panel.setAttribute('aria-hidden','false');
}
function closeInteraction(){interactTarget=null;$('interaction').classList.remove('open');$('interaction').setAttribute('aria-hidden','true')}
function finishGame(){state.escaped=true;closeInteraction();const stealth=state.alarm<30,kind=state.alarm>60?'Шумный побег':stealth?'Чистый выход':'Станция встревожена';$('endingTitle').textContent=stealth?'Тишина сохранена':state.alarm>60?'Станция проснулась':'Вы вышли из тумана';$('endingText').textContent=state.alarm>60?'Вы вырвали ядро и оставили позади тревогу. Но в сохранённой памяти теперь звучит предупреждение.':stealth?'Вы прошли через оранжерею почти бесшумно. В ядре памяти — шанс рассказать, что здесь произошло.':'Дрон не смог вас остановить. Станция осталась позади, но несколько её секретов вы унесли с собой.';$('endingStats').innerHTML=`<span>МАРШРУТ<b>${kind}</b></span><span>ФОКУС<b>${state.focus} / 3</b></span><span>СЛЕДЫ<b>${Math.round(state.alarm)}%</b></span>`;$('ending').classList.add('open');$('ending').setAttribute('aria-hidden','false');updateHud()}
function act(){if(interactTarget){closeInteraction();return}if(nearTarget){openInteraction(nearTarget);return}const target=props.filter(p=>p.id!=='guard'||state.guardStun>0).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];if(target)setWalkTarget(target);else showToast('Поблизости нет объектов')}
function worldAt(px,py){const ix=px-cw/2+cam.x,iy=py-ch*.52+cam.y;const sum=iy/(tileH/2),diff=ix/(tileW/2);return{x:(sum+diff)/2,y:(sum-diff)/2}}
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')e.preventDefault();if(interactTarget)return;const {x,y}=worldAt(e.clientX,e.clientY);let best=null,bestDist=Infinity;for(const p of props){const d=Math.hypot(x-p.x,y-p.y);if(d<1.15&&d<bestDist){best=p;bestDist=d}}if(best){if(Math.hypot(player.x-best.x,player.y-best.y)<1.65)openInteraction(best);else setWalkTarget(best)}else if(x>.6&&x<W-1.6&&y>.6&&y<H-1.6){setWalkTarget({x,y});}});
addEventListener('keydown',e=>{const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();if(key==='e'||key===' '){if(!e.repeat)act();return}if(key==='escape'){closeInteraction();return}keys[key]=true});addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false});addEventListener('blur',()=>{keys={};held={x:0,y:0}});
document.querySelectorAll('.pad').forEach(button=>{const d=button.dataset.dir;const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};const start=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);held={x:dirs[d][0],y:dirs[d][1]}};const stop=e=>{if(e)e.preventDefault();held={x:0,y:0}};button.addEventListener('pointerdown',start);button.addEventListener('pointerup',stop);button.addEventListener('pointercancel',stop);button.addEventListener('lostpointercapture',stop)});
$('actBtn').addEventListener('pointerdown',e=>{e.preventDefault();act()});$('closeInteraction').addEventListener('click',closeInteraction);$('restartBtn').addEventListener('click',()=>location.reload());
let audio=null,osc=null,gain=null;const soundButton=$('soundBtn');soundButton.addEventListener('click',()=>{if(!audio){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){showToast('Звук недоступен в этом браузере');return}audio=new Audio();osc=audio.createOscillator();gain=audio.createGain();osc.type='sine';osc.frequency.value=55;gain.gain.value=0;osc.connect(gain);gain.connect(audio.destination);osc.start()}if(audio.state==='suspended')audio.resume();const on=gain.gain.value===0;gain.gain.setTargetAtTime(on?.018:0,audio.currentTime,.25);soundButton.textContent=on?'♫':'♩';showToast(on?'Тихий звуковой фон включён':'Звук выключен')});
updateHud();requestAnimationFrame(loop);
})();
