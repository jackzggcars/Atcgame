'use strict';
/* =====================================================================
   RADAR / MAP VIEW (canvas 2D)
   ===================================================================== */
const MAPV={
 cx:0,cz:-170,sc:0.34,w:100,h:100,sel:0,hits:[],hover:null,onPick:null,trails:new Map(),lastTrail:0,
 C:{bg:'#0a1118',grid:'#111c26',tw:'#1d2c3a',twc:'#33495c',rw:'#2a3947',rwEdge:'#586f85',txt:'#aebfcc',dim:'#5f7384',dep:'#ffb22e',arr:'#4cc9f0',bad:'#ff5d5d',ok:'#5fd38d',veh:'#d7dde2',mag:'#ff6bd6',hold:'#e9c23a'},
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
  // grid
  const gstep=sc>0.08?100:sc>0.02?500:NM;ctx.strokeStyle=C.grid;ctx.lineWidth=1;ctx.beginPath();
  for(let x=Math.floor(this.wx(0)/gstep)*gstep;x<=this.wx(this.w);x+=gstep){const px=Math.round(this.sx(x))+0.5;ctx.moveTo(px,0);ctx.lineTo(px,this.h);}
  for(let z=Math.floor(this.wz(0)/gstep)*gstep;z<=this.wz(this.h);z+=gstep){const py=Math.round(this.sz(z))+0.5;ctx.moveTo(0,py);ctx.lineTo(this.w,py);}ctx.stroke();
  // range rings & approach axes
  const [ox,oz]=S(0,0);
  if(sc<0.05){ctx.strokeStyle='#17283a';ctx.fillStyle=C.dim;ctx.font='10px "JetBrains Mono",monospace';ctx.setLineDash([3,5]);for(let n=2;n<=14;n+=2){ctx.beginPath();ctx.arc(ox,oz,n*NM*sc,0,6.283);ctx.stroke();ctx.fillText(n+' nm',ox+n*NM*sc*0.707+3,oz-n*NM*sc*0.707-3);}ctx.setLineDash([]);}
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
  // trails
  if(t-this.lastTrail>2.5){this.lastTrail=t;for(const e of G.ents){if(e.veh||e.dead)continue;if(e.y>10){let tr=this.trails.get(e.id);if(!tr){tr=[];this.trails.set(e.id,tr);}tr.push([e.x,e.z]);if(tr.length>14)tr.shift();}}}
  // entities
  const sel=G.ents.find(e=>e.id===this.sel&&!e.dead);
  const draw=(e)=>{
   let px=this.sx(e.x),pz=this.sz(e.z);const off=px<10||px>this.w-10||pz<10||pz>this.h-10;
   const col=e.veh?(e.vt==='fire'?'#ff7a5a':C.veh):e.nordo?C.mag:(e.emerg?C.bad:(e.kind==='arr'?C.arr:C.dep));
   if(off){ if(e.veh||Math.hypot(e.x,e.z)<3000)return;
     const ex=clamp(px,14,this.w-14),ez=clamp(pz,14,this.h-14),ang=Math.atan2(pz-this.h/2,px-this.w/2);
     ctx.save();ctx.translate(ex,ez);ctx.rotate(ang);ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();ctx.restore();
     ctx.fillStyle=col;ctx.font='bold 10px "JetBrains Mono",monospace';ctx.textAlign=ex>this.w/2?'right':'left';ctx.fillText(e.cs+' '+(Math.hypot(e.x,e.z)/NM).toFixed(1)+'nm',ex+(ex>this.w/2?-14:14),ez+3);ctx.textAlign='left';
     this.hits.push({x:ex,y:ez,r:20,e});return;}
   const tr=this.trails.get(e.id);if(tr&&e.y>10){ctx.fillStyle=col;ctx.globalAlpha=0.4;tr.forEach((p,i)=>{ctx.fillRect(this.sx(p[0])-1,this.sz(p[1])-1,2,2);});ctx.globalAlpha=1;}
   // icon
   const size=e.veh?Math.max(4,6*sc*3):Math.max(7,e.type.wing*sc*0.9);
   ctx.save();ctx.translate(px,pz);ctx.rotate(e.th);
   if(e.veh){ctx.fillStyle=col;ctx.fillRect(-size,-size*0.6,size*2,size*1.2);}
   else{ctx.fillStyle=col;ctx.strokeStyle='#05090d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(size,0);ctx.lineTo(-size*0.55,-size*0.62);ctx.lineTo(-size*0.25,0);ctx.lineTo(-size*0.55,size*0.62);ctx.closePath();ctx.fill();ctx.stroke();}
   ctx.restore();
   if(!e.veh&&(e.req||e.emerg)){const pulse=(Math.sin(t*6)+1)/2;ctx.strokeStyle=e.emerg||e.nordo?C.bad:C.dep;ctx.globalAlpha=0.35+0.55*pulse;ctx.lineWidth=2;ctx.beginPath();ctx.arc(px,pz,size+5+pulse*3,0,6.283);ctx.stroke();ctx.globalAlpha=1;}
   if(e.id===this.sel){ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(px,pz,size+9,0,6.283);ctx.stroke();ctx.setLineDash([]);}
   this.hits.push({x:px,y:pz,r:Math.max(14,size+8),e});
   // data block
   const full=sc>0.075||e.id===this.sel||e===this.hover||e.y>10;
   const bx=px+size+14,bz=pz-size-12;
   const L1=e.veh?e.cs:e.cs+(e.heavy?' H':'');
   let L2='',L3='';
   if(!e.veh){L2=(e.squawk||'----')+' '+e.type.n+(e.kind==='dep'&&e.dest?' '+e.dest.c:'');
    L3=e.y>10?Math.round(e.y*FT/10)*10+'ft '+Math.round(e.v/KT)+'kt':this.phaseText(e)+(e.v>0.5?' '+Math.round(e.v/KT)+'kt':'');}
   else L3=this.phaseText(e);
   ctx.font='bold 11px "JetBrains Mono",monospace';
   const lines=full?(e.veh?[L1,L3]:[L1,L2,L3]):[L1];
   let mw=0;lines.forEach(s=>mw=Math.max(mw,ctx.measureText(s).width));
   ctx.strokeStyle=col;ctx.globalAlpha=0.6;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px+size*0.6,pz-size*0.4);ctx.lineTo(bx-3,bz+6);ctx.stroke();ctx.globalAlpha=1;
   const bh=lines.length*12+6;ctx.fillStyle=e.id===this.sel?'rgba(30,22,6,0.92)':'rgba(8,13,18,0.78)';ctx.fillRect(bx-3,bz-8,mw+8,bh);
   if(e.id===this.sel){ctx.strokeStyle=C.dep;ctx.strokeRect(bx-3,bz-8,mw+8,bh);}
   lines.forEach((s,i)=>{ctx.fillStyle=i===0?col:(i===1&&e.sqBad?C.bad:i===1?'#9fb2c1':'#7e93a4');ctx.font=(i===0?'bold ':'')+'11px "JetBrains Mono",monospace';ctx.fillText(s,bx,bz+i*12+2);});
   if(!e.veh&&e.req){const rt=PH[e.req.kind].title.split(' ')[0].toUpperCase();const blink=Math.sin(t*7)>-0.2;if(blink){ctx.fillStyle=C.dep;ctx.font='bold 10px "JetBrains Mono",monospace';ctx.fillText('● REQ',bx+mw+8,bz+2);}}
   if(e.veh&&e.req){ctx.fillStyle=C.dep;ctx.font='bold 10px "JetBrains Mono",monospace';ctx.fillText('● REQ',bx+mw+8,bz+2);}
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
