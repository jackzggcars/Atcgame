'use strict';
/* =====================================================================
   RADAR / MAP VIEW (canvas 2D)
   ===================================================================== */
const MAPV={
 cx:0,cz:-170,sc:0.34,w:100,h:100,sel:0,hits:[],hover:null,onPick:null,trails:new Map(),lastTrail:0,
 C:{bg:'#04080a',grid:'#0c1a14',tw:'#1b2a24',twc:'#3d5a4c',rw:'#161d1b',rwEdge:'#8fa89b',txt:'#b9d4c4',dim:'#587064',dep:'#ffc83a',arr:'#38d6e6',bad:'#ff4a4a',ok:'#5fe08d',veh:'#d7e2dc',mag:'#ff6bd6',hold:'#e9d23a',sel:'#ffffff'},
 init(canvas){
  this.cv=canvas;this.ctx=canvas.getContext('2d');this.bind();this.resize();
 },
 resize(){
  const r=this.cv.parentElement.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);
  this.w=Math.max(10,r.width);this.h=Math.max(10,r.height);this.cv.width=this.w*d;this.cv.height=this.h*d;this.cv.style.width=this.w+'px';this.cv.style.height=this.h+'px';this.dpr=d;
 },
 fit(){this.cx=0;this.cz=-170;this.sc=Math.min(this.w/3500,this.h/760);},
 wide(){this.cx=0;this.cz=-80;this.sc=Math.min(this.w,this.h)/(2*NM*11);},
 sx(x){return (x-this.cx)*this.sc+this.w/2;},
 sz(z){return (z-this.cz)*this.sc+this.h/2;},
 wx(px){return (px-this.w/2)/this.sc+this.cx;},
 wz(py){return (py-this.h/2)/this.sc+this.cz;},
 bind(){
  const cv=this.cv;let drag=null;
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,m:0};});
  cv.addEventListener('pointermove',e=>{
   const r=cv.getBoundingClientRect();this.mx=e.clientX-r.left;this.my=e.clientY-r.top;
   if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.m+=Math.abs(dx)+Math.abs(dy);this.cx-=dx/this.sc;this.cz-=dy/this.sc;}
   else this.hover=this.pick(this.mx,this.my);
   cv.style.cursor=this.hover&&!drag?'pointer':'grab';
  });
  cv.addEventListener('pointerup',e=>{if(drag&&drag.m<5&&this.onPick){const r=cv.getBoundingClientRect();this.onPick(this.pick(e.clientX-r.left,e.clientY-r.top));}drag=null;});
  cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;const wx=this.wx(px),wz=this.wz(py);
   this.sc=clamp(this.sc*(1-e.deltaY*0.0014),0.0035,3);this.cx=wx-(px-this.w/2)/this.sc;this.cz=wz-(py-this.h/2)/this.sc;},{passive:false});
 },
 pick(px,py){
  let best=null,bd=1e9;
  for(const h of this.hits){const d=Math.hypot(h.x-px,h.y-py);if(d<h.r&&d<bd){bd=d;best=h.e;}}
  return best;
 },
 phaseText(a){
  if(a.veh)return a.phase==='INSP'?'RWY INSP':a.phase==='REQ'?'WAITING':a.phase==='GO'?'RESPONDING':a.phase==='ONSCENE'?'ON SCENE':'RETURN';
  const m={BOARDING:'BOARDING '+Math.round(a.board*100)+'%',AT_GATE:'STAND',PUSHBACK:'PUSHBACK',PUSH_TURN:'PUSHBACK',STOPPED:'HOLD POS',HOLDING:'HP '+(a.destNode?HPN[a.destNode]:''),TAXI:a.paused?'HOLDING':'TAXI',LINEUP:'LINING UP',ON_RWY:'LINED UP',ROLL:'TAKEOFF',RTO:'REJECT TO',RWY_STOP:'STOPPED RWY',CLIMB:'CLIMB',RETURN:'RETURN',APPROACH:'ILS '+G.rwy,GOAROUND:'GO-AROUND',ROLLOUT:'LANDING',BLOCKED_ROLL:'TYRE BURST',VACATED:'VACATED',PARKED:'AT STAND'};
  return m[a.phase]||a.phase;
 },
 draw(t){
  const ctx=this.ctx,C=this.C,d=this.dpr;ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle=C.bg;ctx.fillRect(0,0,this.w,this.h);
  const sc=this.sc,S=(x,z)=>[this.sx(x),this.sz(z)];this.hits=[];
  // radar scope: soft vignette, range rings centred on the field, bearing ticks
  { const g=ctx.createRadialGradient(this.w/2,this.h/2,Math.min(this.w,this.h)*0.15,this.w/2,this.h/2,Math.max(this.w,this.h)*0.75);g.addColorStop(0,'rgba(18,40,30,0.55)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,this.w,this.h); }
  { const gstep=sc>0.08?100:sc>0.02?500:NM*2;ctx.strokeStyle=C.grid;ctx.lineWidth=1;ctx.beginPath();
    for(let x=Math.floor(this.wx(0)/gstep)*gstep;x<=this.wx(this.w);x+=gstep){const px=Math.round(this.sx(x))+0.5;ctx.moveTo(px,0);ctx.lineTo(px,this.h);}
    for(let z=Math.floor(this.wz(0)/gstep)*gstep;z<=this.wz(this.h);z+=gstep){const py=Math.round(this.sz(z))+0.5;ctx.moveTo(0,py);ctx.lineTo(this.w,py);}ctx.stroke(); }
  // range rings & approach axes
  const [ox,oz]=S(0,0);
  if(sc<0.12){ctx.strokeStyle='#15402e';ctx.fillStyle='#3c7a5c';ctx.font='10px "JetBrains Mono",monospace';ctx.setLineDash([]);for(let n=1;n<=14;n+=(sc<0.05?2:1)){ctx.beginPath();ctx.arc(ox,oz,n*NM*sc,0,6.283);ctx.stroke();ctx.fillText(n+' nm',ox+n*NM*sc*0.707+3,oz-n*NM*sc*0.707-3);}ctx.setLineDash([]);}
  const act=G.rwy==='09'?-1:1;
  [-1,1].forEach(side=>{const on=side===act;ctx.strokeStyle=on?'rgba(76,201,240,0.55)':'rgba(120,140,160,0.18)';ctx.lineWidth=on?1.4:1;ctx.setLineDash(on?[10,7]:[2,7]);
   const [x0,z0]=S(side*AP.thr,0),[x1,z1]=S(side*(AP.thr+13*NM),0);ctx.beginPath();ctx.moveTo(x0,z0);ctx.lineTo(x1,z1);ctx.stroke();ctx.setLineDash([]);
   if(on){ctx.fillStyle='rgba(76,201,240,0.8)';ctx.font='10px "JetBrains Mono",monospace';ctx.textAlign='center';for(let n=2;n<=12;n+=2){const [tx,tz]=S(side*(AP.thr+n*NM),0);ctx.fillRect(tx-0.5,tz-4,1,8);if(sc<0.1)ctx.fillText(n,tx,tz+16);}ctx.textAlign='left';}});
  ctx.lineWidth=1;
  // taxiways
  ctx.lineCap='butt';
  EDGES.forEach(e=>{if(e.rwy)return;const A=NODES[e.a],B=NODES[e.b],w=(e.name==='Apron'||e.name==='Stand'?30:e.name==='Service Rd'?8:22);const [ax,az]=S(A.x,A.z),[bx,bz]=S(B.x,B.z);ctx.strokeStyle=C.tw;ctx.lineWidth=Math.max(2,w*sc);ctx.beginPath();ctx.moveTo(ax,az);ctx.lineTo(bx,bz);ctx.stroke();});
  EDGES.forEach(e=>{if(e.rwy||e.name==='Stand'||e.name==='Service Rd')return;const A=NODES[e.a],B=NODES[e.b];const [ax,az]=S(A.x,A.z),[bx,bz]=S(B.x,B.z);ctx.strokeStyle=C.twc;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ax,az);ctx.lineTo(bx,bz);ctx.stroke();});
  // apron outline + terminal
  { const [x0,z0]=S(-520,-380),[x1,z1]=S(520,-255);ctx.fillStyle='rgba(30,44,58,0.55)';ctx.fillRect(x0,z0,x1-x0,z1-z0);
    const [tx0,tz0]=S(-500,-448),[tx1,tz1]=S(500,-402);ctx.fillStyle='#16222d';ctx.strokeStyle='#2c4054';ctx.fillRect(tx0,tz0,tx1-tx0,tz1-tz0);ctx.strokeRect(tx0,tz0,tx1-tx0,tz1-tz0);
    if(sc>0.12){ctx.fillStyle=C.dim;ctx.font='11px "Barlow Condensed",sans-serif';ctx.textAlign='center';ctx.fillText('TERMINAL',(tx0+tx1)/2,(tz0+tz1)/2+4);ctx.textAlign='left';} }
  // runway
  { const busy=rwyOccupied(null);const [x0,z0]=S(-AP.half,-AP.w/2),[x1,z1]=S(AP.half,AP.w/2);
    ctx.fillStyle=busy?'#3a2a2d':C.rw;ctx.fillRect(x0,z0,x1-x0,Math.max(4,z1-z0));ctx.strokeStyle=busy?'#ff7a7a':C.rwEdge;ctx.lineWidth=1;ctx.strokeRect(x0,z0,x1-x0,Math.max(4,z1-z0));
    ctx.strokeStyle='#7f94a6';ctx.setLineDash([8,10]);ctx.beginPath();ctx.moveTo(x0,(z0+z1)/2);ctx.lineTo(x1,(z0+z1)/2);ctx.stroke();ctx.setLineDash([]);
    ctx.font='bold 13px "Barlow Condensed",sans-serif';ctx.fillStyle=G.rwy==='09'?C.dep:C.dim;ctx.fillText('09',x0+4,(z0+z1)/2+4);ctx.fillStyle=G.rwy==='27'?C.dep:C.dim;ctx.textAlign='right';ctx.fillText('27',x1-4,(z0+z1)/2+4);ctx.textAlign='left'; }
  // holding points, labels
  ['B','C','D','E'].forEach(k=>{const n=NODES['H'+k];const [hx,hz]=S(n.x,n.z);ctx.strokeStyle=C.hold;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hx-Math.max(6,13*sc),hz);ctx.lineTo(hx+Math.max(6,13*sc),hz);ctx.stroke();
   ctx.fillStyle=C.hold;ctx.font='10px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText('HP '+EXN[k][0],hx,hz-5);ctx.textAlign='left';});
  if(sc>0.07){ctx.font='11px "Barlow Condensed",sans-serif';ctx.fillStyle='#62798b';ctx.textAlign='center';
   [['Alpha',-430,-150],['Alpha',430,-150],['Bravo',-1300,-100],['Charlie',-700,-100],['Delta',700,-100],['Echo',1300,-100],['Foxtrot',-160,-225],['Golf',160,-225]].forEach(([n,x,z])=>{const [lx,lz]=S(x,z);ctx.fillText(n.toUpperCase(),lx,lz);});ctx.textAlign='left';}
  // stands
  for(let i=1;i<=6;i++){const [gx,gz]=S(GATE_X[i-1],-350);const occ=G.gates[i];ctx.strokeStyle=occ?'#5a7186':'#2b3d4e';ctx.lineWidth=1;const sz=Math.max(7,26*sc);ctx.strokeRect(gx-sz/2,gz-sz/2,sz,sz);ctx.fillStyle=occ?'#8fa6ba':'#4b6073';ctx.font='10px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText(i,gx,gz+3.5);ctx.textAlign='left';}
  const [dpx,dpz]=S(0,-110);ctx.fillStyle='#253645';ctx.fillRect(dpx-5,dpz-4,10,8);
  // history trails (radar "dots"), sampled every 2.5 s
  if(t-this.lastTrail>2.5){this.lastTrail=t;for(const e of G.ents){if(e.veh||e.dead)continue;if(e.y>10||e.v>12){let tr=this.trails.get(e.id);if(!tr){tr=[];this.trails.set(e.id,tr);}tr.push([e.x,e.z]);if(tr.length>8)tr.shift();}}}
  // sweep (wide zoom only): rotating beam + afterglow, like a real PSR display
  if(sc<0.06){const R=Math.hypot(this.w,this.h),ang=(t*0.9)%(Math.PI*2);ctx.save();ctx.translate(ox,oz);
   for(let i=0;i<24;i++){ctx.strokeStyle='rgba(60,255,140,'+(0.10*(1-i/24)).toFixed(3)+')';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(ang-i*0.028)*R,Math.sin(ang-i*0.028)*R);ctx.stroke();}
   ctx.restore();}
  // conflict detection (STCA-style): airborne pairs inside 3 nm and 1000 ft, or landing traffic vs occupied runway
  const conf=new Set();
  { const air=G.ents.filter(e=>!e.dead&&!e.veh&&e.y>30);
    for(let i=0;i<air.length;i++)for(let j=i+1;j<air.length;j++){const A=air[i],B=air[j];if(Math.hypot(A.x-B.x,A.z-B.z)<3*NM&&Math.abs(A.y-B.y)*FT<1000){conf.add(A.id);conf.add(B.id);}} }
  // entities
  const sel=G.ents.find(e=>e.id===this.sel&&!e.dead);
  const FONT=(b,sz)=>(b?'bold ':'')+(sz||11)+'px "JetBrains Mono","Consolas",monospace';
  const draw=(e)=>{
   let px=this.sx(e.x),pz=this.sz(e.z);const off=px<10||px>this.w-10||pz<10||pz>this.h-10;
   const col=e.veh?(e.vt==='fire'?'#ff7a5a':C.veh):e.nordo?C.mag:(e.emerg?C.bad:(e.kind==='arr'?C.arr:C.dep));
   if(off){ if(e.veh||Math.hypot(e.x,e.z)<3000)return;
     const ex=clamp(px,14,this.w-14),ez=clamp(pz,14,this.h-14),ang=Math.atan2(pz-this.h/2,px-this.w/2);
     ctx.save();ctx.translate(ex,ez);ctx.rotate(ang);ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-5);ctx.lineTo(-5,5);ctx.closePath();ctx.stroke();ctx.restore();
     ctx.fillStyle=col;ctx.font=FONT(true,10);ctx.textAlign=ex>this.w/2?'right':'left';ctx.fillText(e.cs+' '+(Math.hypot(e.x,e.z)/NM).toFixed(1)+'nm',ex+(ex>this.w/2?-14:14),ez+3);ctx.textAlign='left';
     this.hits.push({x:ex,y:ez,r:20,e});return;}
   const air=!e.veh&&e.y>10,isSel=e.id===this.sel,inConf=conf.has(e.id);
   const tr=this.trails.get(e.id);
   if(tr&&(air||e.v>12)){tr.forEach((p,i)=>{const k=(i+1)/tr.length;ctx.fillStyle=col;ctx.globalAlpha=0.15+0.5*k;const q=Math.max(1.5,2.5*k);ctx.fillRect(this.sx(p[0])-q/2,this.sz(p[1])-q/2,q,q);});ctx.globalAlpha=1;}
   // velocity vector (45 s) for airborne targets
   if(air&&e.v>20){const vx=px+Math.cos(e.th)*e.v*45*sc,vz=pz+Math.sin(e.th)*e.v*45*sc;ctx.strokeStyle=col;ctx.globalAlpha=0.55;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,pz);ctx.lineTo(vx,vz);ctx.stroke();ctx.globalAlpha=1;}
   const size=e.veh?Math.max(4,6*sc*3):Math.max(6,e.type.wing*sc*0.8);
   if(air&&sc<0.12){ // airborne at radar scale: hollow diamond (secondary radar return)
    const r=5;ctx.strokeStyle=inConf?C.bad:col;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(px,pz-r);ctx.lineTo(px+r,pz);ctx.lineTo(px,pz+r);ctx.lineTo(px-r,pz);ctx.closePath();ctx.stroke();ctx.fillStyle=inConf?C.bad:col;ctx.fillRect(px-1,pz-1,2,2);
   }else{
    ctx.save();ctx.translate(px,pz);ctx.rotate(e.th);
    if(e.veh){ctx.fillStyle=col;ctx.fillRect(-size,-size*0.6,size*2,size*1.2);}
    else{ctx.fillStyle=inConf?C.bad:col;ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(size*0.15,-size*0.16);ctx.lineTo(-size*0.1,-size*0.8);ctx.lineTo(-size*0.3,-size*0.8);ctx.lineTo(-size*0.15,-size*0.12);ctx.lineTo(-size*0.8,-size*0.08);ctx.lineTo(-size*0.9,-size*0.3);ctx.lineTo(-size,-size*0.3);ctx.lineTo(-size,size*0.3);ctx.lineTo(-size*0.9,size*0.3);ctx.lineTo(-size*0.8,size*0.08);ctx.lineTo(-size*0.15,size*0.12);ctx.lineTo(-size*0.3,size*0.8);ctx.lineTo(-size*0.1,size*0.8);ctx.lineTo(size*0.15,size*0.16);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.restore();
   }
   if(inConf){ctx.strokeStyle=C.bad;ctx.globalAlpha=0.5+0.5*Math.sin(t*9);ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px,pz,14,0,6.283);ctx.stroke();ctx.globalAlpha=1;}
   if(!e.veh&&(e.req||e.emerg)&&!inConf){const pulse=(Math.sin(t*6)+1)/2;ctx.strokeStyle=e.emerg||e.nordo?C.bad:C.dep;ctx.globalAlpha=0.35+0.55*pulse;ctx.lineWidth=1.5;const r=size+7+pulse*3;ctx.strokeRect(px-r,pz-r,r*2,r*2);ctx.globalAlpha=1;}
   this.hits.push({x:px,y:pz,r:Math.max(14,size+8),e});
   // data tag: flat text block with leader (no panel), EuroScope/VRC style
   if(!air&&!isSel&&e!==this.hover&&sc<0.05&&!e.req){this.hits.push({x:px,y:pz,r:14,e});return;}
   const full=sc>0.05||isSel||e===this.hover||air;
   const bx=px+size+22,bz=pz-size-16;
   let L1=e.cs+(e.heavy?'/H':''),L2='',L3='';
   if(!e.veh){
    const gs=Math.round(e.v/KT);
    if(air){const alt=Math.round(e.y*FT/100);const tr2=e.vs>0.5||(e.kind==='dep'&&e.phase!=='APPROACH')?'↑':(e.phase==='APPROACH'?'↓':'→');L2=pad(alt,3)+tr2+' '+pad(gs,3)+'kt';}
    else L2=this.phaseText(e)+(e.v>0.5?' '+gs+'kt':'');
    L3=(e.squawk||'----')+' '+e.type.n+(e.kind==='dep'&&e.dest?' '+e.dest.c:'');
   }else L2=this.phaseText(e);
   const lines=full?(e.veh?[L1,L2]:[L1,L2,L3]):[L1];
   ctx.font=FONT(false,11);let mw=0;lines.forEach(q=>mw=Math.max(mw,ctx.measureText(q).width));
   const bh=lines.length*12+4;
   ctx.strokeStyle=col;ctx.globalAlpha=0.7;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+Math.min(8,size)*0.7,pz-Math.min(8,size)*0.7);ctx.lineTo(bx-4,bz+bh-12);ctx.lineTo(bx-1,bz+bh-12);ctx.stroke();ctx.globalAlpha=1;
   if(isSel){ctx.fillStyle='rgba(255,255,255,0.10)';ctx.fillRect(bx-3,bz-9,mw+8,bh);ctx.strokeStyle=C.sel;ctx.lineWidth=1;ctx.strokeRect(bx-3.5,bz-9.5,mw+9,bh+1);}
   lines.forEach((q,i)=>{ctx.fillStyle=i===0?(inConf?C.bad:col):(i===1?'#d3e4da':'#7f978a');ctx.font=FONT(i===0,11);ctx.fillText(q,bx,bz+i*12+2);});
   if(e.req){const blink=Math.sin(t*7)>-0.2;if(blink){ctx.fillStyle=C.dep;ctx.font=FONT(true,10);ctx.fillText('◄ CALLING',bx+mw+8,bz+2);}}
   this.hits.push({x:bx+mw/2,y:bz+bh/2-8,r:Math.max(16,mw/2+4),e});
  };
  G.ents.forEach(e=>{if(!e.dead&&e.id!==this.sel)draw(e);});if(sel)draw(sel);
  // incursion warnings
  for(const e of G.ents){if(e.dead||e.veh)continue;if(e.phase==='TAXI'&&e.blowHold&&e.path&&e.path.len-e.s<140){ctx.strokeStyle=C.bad;ctx.lineWidth=3;ctx.globalAlpha=0.5+0.5*Math.sin(t*10);ctx.strokeRect(this.sx(e.x)-22,this.sz(e.z)-22,44,44);ctx.globalAlpha=1;}}
  // wind + scale overlay
  this.overlay(ctx,t);
 },
 overlay(ctx,t){
  const C=this.C;
  // scope info block (top-right), like a controller client's status line
  ctx.font='bold 11px "JetBrains Mono",monospace';ctx.textAlign='right';ctx.fillStyle='#6fe0a0';const rng=Math.round(Math.min(this.w,this.h)/2/this.sc/NM*10)/10;
  ctx.fillText('MARLOW  EGMW   RWY '+G.rwy+'   QNH '+(G.qnh||''),this.w-14,22);ctx.fillStyle='#4f8a6a';ctx.font='10px "JetBrains Mono",monospace';ctx.fillText('NORTH UP · RANGE '+(rng>=1?rng.toFixed(1)+' NM':Math.round(rng*1852)+' M')+' · TARGETS '+G.ents.filter(e=>!e.dead&&!e.veh).length,this.w-14,36);ctx.textAlign='left';
  // scale bar
  const len=this.sc>0.05?500:NM,px=len*this.sc;ctx.strokeStyle=C.txt;ctx.fillStyle=C.txt;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(14,this.h-16);ctx.lineTo(14+px,this.h-16);ctx.moveTo(14,this.h-20);ctx.lineTo(14,this.h-12);ctx.moveTo(14+px,this.h-20);ctx.lineTo(14+px,this.h-12);ctx.stroke();
  ctx.font='10px "JetBrains Mono",monospace';ctx.fillText(len===500?'500 m':'1 nm',18,this.h-24);
  // wind rose
  const cx=this.w-44,cz=this.h-44;ctx.strokeStyle='#2d4256';ctx.beginPath();ctx.arc(cx,cz,26,0,6.283);ctx.stroke();
  ctx.fillStyle=C.dim;ctx.font='9px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText('N',cx,cz-29);ctx.textAlign='left';
  const a=G.wind.dir*D2R;ctx.save();ctx.translate(cx,cz);ctx.rotate(a);ctx.strokeStyle=C.arr;ctx.fillStyle=C.arr;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(0,18);ctx.stroke();ctx.beginPath();ctx.moveTo(0,22);ctx.lineTo(-5,12);ctx.lineTo(5,12);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle=C.txt;ctx.font='bold 10px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText(pad(Math.round(G.wind.dir/10)*10%360||360,3)+'/'+Math.round(G.wind.spd),cx,cz+40);ctx.textAlign='left';
 }
};
