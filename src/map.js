'use strict';
/* =====================================================================
   RADAR / MAP VIEW (canvas 2D)
   ===================================================================== */
/* ---------- radar symbols: one outline per aircraft class (nose = +x, drawn mirrored about the axis) ---------- */
const RSYM={
 narrow:{p:[[1,0],[0.7,0.07],[0.35,0.1],[0.12,0.13],[-0.08,0.78],[-0.30,0.78],[-0.22,0.14],[-0.72,0.1],[-0.86,0.36],[-1,0.36],[-1,0]],eng:[[0.0,0.36]]},
 reg:{p:[[1,0],[0.65,0.07],[0.2,0.1],[0.05,0.62],[-0.18,0.62],[-0.12,0.12],[-0.55,0.1],[-0.7,0.15],[-0.9,0.34],[-1,0.34],[-1,0]],eng:[[-0.62,0.24]]},
 wide:{p:[[1,0],[0.72,0.1],[0.4,0.14],[0.15,0.17],[-0.12,0.95],[-0.34,0.95],[-0.25,0.19],[-0.7,0.14],[-0.84,0.42],[-1,0.42],[-1,0]],eng:[[0.0,0.42]]},
 jumbo:{p:[[1,0],[0.78,0.1],[0.55,0.2],[0.3,0.22],[0.1,0.2],[-0.12,1.0],[-0.36,1.0],[-0.26,0.2],[-0.7,0.15],[-0.84,0.46],[-1,0.46],[-1,0]],eng:[[0.04,0.4],[-0.02,0.7]]},
 frt:{p:[[1,0],[0.82,0.16],[0.55,0.3],[0.2,0.33],[-0.05,0.3],[-0.12,0.85],[-0.34,0.85],[-0.3,0.28],[-0.7,0.2],[-0.85,0.4],[-1,0.4],[-1,0]],eng:[[0.0,0.55]]},
 conc:{p:[[1,0],[0.85,0.035],[0.4,0.12],[-0.1,0.38],[-0.55,0.62],[-0.92,0.66],[-0.92,0.3],[-1,0.1],[-1,0]],eng:[[-0.6,0.3]]},
 f14:{p:[[1,0],[0.8,0.06],[0.5,0.09],[0.2,0.1],[0.0,0.14],[-0.35,0.78],[-0.5,0.78],[-0.46,0.28],[-0.7,0.3],[-0.82,0.42],[-0.95,0.42],[-0.92,0.2],[-1,0.14],[-1,0]],eng:[]},
 b2:{p:[[0.6,0],[-0.45,1.0],[-0.6,0.9],[-0.45,0.62],[-0.72,0.45],[-0.62,0.22],[-0.8,0]],eng:[]},
 light:{p:[[1,0],[0.65,0.1],[0.28,0.12],[0.25,0.95],[-0.1,0.95],[-0.1,0.14],[-0.85,0.07],[-0.9,0.38],[-1,0.38],[-1,0]],eng:[]},
 biz:{p:[[1,0],[0.72,0.07],[0.3,0.1],[-0.05,0.14],[-0.15,0.72],[-0.35,0.72],[-0.32,0.13],[-0.75,0.1],[-0.9,0.26],[-1,0.4],[-1,0]],eng:[[-0.62,0.2]]}
};
function symClass(e){
 const ty=e.type||{},n=ty.n;
 if(ty.heli)return'heli';if(ty.light)return'light';if(ty.biz)return'biz';
 if(n==='CONC')return'conc';if(n==='F14')return'f14';if(n==='B2')return'b2';
 if(n==='A3ST'||n==='B74L')return'frt';
 if(ty.eng===4)return'jumbo';if(ty.wide)return'wide';if(ty.rear||n==='E190')return'reg';return'narrow';
}
/* full-size silhouette; rotation already applied by the caller */
function drawSym(ctx,e,size,fill,t){
 const k=symClass(e);ctx.fillStyle=fill;ctx.strokeStyle='#000';ctx.lineWidth=1;
 if(k==='heli'){
  const s=size;ctx.beginPath();ctx.ellipse(s*0.1,0,s*0.55,s*0.28,0,0,6.283);ctx.fill();ctx.stroke();
  ctx.fillRect(-s*1.0,-s*0.05,s*0.75,s*0.1);ctx.fillRect(-s*1.05,-s*0.2,s*0.12,s*0.4);
  ctx.save();ctx.translate(s*0.1,0);ctx.rotate(t*9);ctx.strokeStyle=fill;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(-s*0.95,0);ctx.lineTo(s*0.95,0);ctx.moveTo(0,-s*0.95);ctx.lineTo(0,s*0.95);ctx.stroke();ctx.globalAlpha=0.35;ctx.beginPath();ctx.arc(0,0,s*0.95,0,6.283);ctx.stroke();ctx.restore();ctx.globalAlpha=1;return;}
 const Y=RSYM[k];ctx.beginPath();
 Y.p.forEach((q,i)=>{i?ctx.lineTo(q[0]*size,q[1]*size):ctx.moveTo(q[0]*size,q[1]*size);});
 for(let i=Y.p.length-2;i>=1;i--)ctx.lineTo(Y.p[i][0]*size,-Y.p[i][1]*size);
 ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='rgba(0,0,0,0.75)';for(const q of Y.eng)for(const sd of[-1,1]){ctx.beginPath();ctx.arc(q[0]*size,sd*q[1]*size,Math.max(1.1,size*0.07),0,6.283);ctx.fill();}
 if(k==='frt'){ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.ellipse(size*0.35,0,size*0.4,size*0.15,0,0,6.283);ctx.fill();}
 if(k==='f14'||k==='b2'||k==='conc'){ctx.strokeStyle=fill;ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,size*1.15,0,6.283);ctx.globalAlpha=0.35;ctx.stroke();ctx.globalAlpha=1;}
}
/* radar-scale (small, unrotated) symbol per class */
function radarSym(ctx,e,px,pz,col,t){
 const k=symClass(e);ctx.save();ctx.translate(px,pz);ctx.scale(1.3,1.3);ctx.translate(-px,-pz);ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=1.5;
 const dia=r=>{ctx.beginPath();ctx.moveTo(px,pz-r);ctx.lineTo(px+r,pz);ctx.lineTo(px,pz+r);ctx.lineTo(px-r,pz);ctx.closePath();ctx.stroke();};
 if(k==='narrow'||k==='reg'){dia(k==='reg'?4:5);ctx.fillRect(px-1,pz-1,2,2);}
 else if(k==='wide'){dia(6);ctx.beginPath();ctx.moveTo(px-9,pz);ctx.lineTo(px-6,pz);ctx.moveTo(px+6,pz);ctx.lineTo(px+9,pz);ctx.stroke();ctx.fillRect(px-1,pz-1,2,2);}
 else if(k==='jumbo'){dia(6);dia(9);ctx.fillRect(px-1,pz-1,2,2);}
 else if(k==='frt'){dia(6);ctx.beginPath();ctx.arc(px,pz,2.2,0,6.283);ctx.stroke();}
 else if(k==='biz'){dia(3.6);ctx.beginPath();ctx.moveTo(px,pz+3.6);ctx.lineTo(px,pz+8);ctx.stroke();}
 else if(k==='light'){ctx.beginPath();ctx.arc(px,pz,3.4,0,6.283);ctx.stroke();ctx.beginPath();ctx.moveTo(px-6,pz);ctx.lineTo(px+6,pz);ctx.stroke();}
 else if(k==='heli'){ctx.beginPath();ctx.arc(px,pz,3,0,6.283);ctx.stroke();ctx.save();ctx.translate(px,pz);ctx.rotate(t*7);ctx.beginPath();ctx.moveTo(-7,0);ctx.lineTo(7,0);ctx.moveTo(0,-7);ctx.lineTo(0,7);ctx.stroke();ctx.restore();}
 else{ // military / SST: rotated shapes
  ctx.save();ctx.translate(px,pz);ctx.rotate(e.th+MAPV.TH);ctx.beginPath();
  if(k==='conc'){ctx.moveTo(9,0);ctx.lineTo(-7,-6);ctx.lineTo(-4,0);ctx.lineTo(-7,6);ctx.closePath();}
  else if(k==='f14'){ctx.moveTo(8,0);ctx.lineTo(-6,-7);ctx.moveTo(8,0);ctx.lineTo(-6,7);ctx.moveTo(8,0);ctx.lineTo(-7,0);}
  else{ctx.moveTo(6,0);ctx.lineTo(-6,-9);ctx.lineTo(-3,0);ctx.lineTo(-6,9);ctx.closePath();}
  ctx.stroke();ctx.restore();}
 ctx.restore();
}
/* manual pages: radar symbol guide + visitors / special flights */
(function(){
 const svg=k=>{if(k==='heli')return'<svg viewBox="-12 -12 24 24" width="38" height="38"><ellipse cx="1" rx="5.5" ry="2.8" fill="#38d6e6" stroke="#000" stroke-width=".5"/><rect x="-11" y="-.6" width="8" height="1.2" fill="#38d6e6"/><circle r="9.5" fill="none" stroke="#38d6e6" stroke-width=".7" stroke-dasharray="2 2"/><path d="M-9 0H9M0 -9V9" stroke="#38d6e6" stroke-width="1"/></svg>';
  const Y=RSYM[k],P=Y.p.map(q=>[q[0]*10,q[1]*10]).concat(Y.p.slice(1,-1).reverse().map(q=>[q[0]*10,-q[1]*10]));
  return'<svg viewBox="-12 -12 24 24" width="38" height="38"><polygon points="'+P.map(q=>q[0].toFixed(1)+','+q[1].toFixed(1)).join(' ')+'" fill="#38d6e6" stroke="#000" stroke-width=".5"/>'+Y.eng.map(q=>[1,-1].map(sd=>'<circle cx="'+q[0]*10+'" cy="'+sd*q[1]*10+'" r=".9" fill="#000" opacity=".75"/>').join('')).join('')+'</svg>';};
 const rows=[['narrow','Narrow-body airliner','A320 / 737 family, 757'],['reg','Regional jet','E175 / E190: rear-mounted engines, short wings'],['wide','Wide-body twin','777, 787, A330, A350: long wings, bar on the radar diamond'],['jumbo','Four-engine heavy','747, A380, A340: fat nose, four engines, double diamond at radar scale'],['frt','Outsize freighter','Beluga and Dreamlifter: bulbous fuselage'],['biz','Business jet','Medevac "Lifeguard" and VIP "Executive" flights: rear engines, T-tail'],['light','Light aircraft','Flying-club Cessna: straight high wing'],['heli','Helicopter','Spinning rotor: police, air ambulance and tour flights'],['conc','Concorde','Slender delta, no tailplane'],['f14','F-14 Tomcat','Swept wings and twin tails: also the flypast display team'],['b2','B-2 Spirit','Flying wing with a sawtooth trailing edge']];
 MAN_EXTRA.push({cat:'Reference',title:'Radar symbols by aircraft type',tags:'radar symbol map icon shape airliner helicopter concorde tomcat spirit heavy wide jumbo light business',html:'<p>Every target on the radar is drawn in the shape of its aircraft class, so you can tell a jumbo from a light aircraft at a glance. At wide radar scale the shapes shrink to marks: a plain diamond is a narrow-body, a diamond with a bar a wide-body, a double diamond a four-engine heavy, a circle with a cross a helicopter, and a pointed arrow the rare military and supersonic types.</p><table class="mt">'+rows.map(r=>'<tr><td>'+svg(r[0])+'</td><td><b>'+r[1]+'</b><br>'+r[2]+'</td></tr>').join('')+'</table>'});
 MAN_EXTRA.push({cat:'Reference',title:'Visitors, flypasts and special flights',tags:'helicopter light aircraft zone transit flypast air show open day hijack 7500 medevac lifeguard vip executive diversion livery',html:'<p><b>Zone transits.</b> Helicopters and flying-club aircraft call up to cross the airfield. Northern and southern routes stay clear of the runway; a crossing route cuts across the final approach. Approve only when nothing is on short final, or tell them to orbit ("orbit, ' + 'remain outside the zone"). A crossing that forces an arrival around costs you an airprox.</p><p><b>Flypast / Open Day.</b> A NOTAM gives the time. The runway is closed for about 90 seconds: keep arrivals off final and nothing on or lined up on the runway, or the display aborts and you lose safety. A clean pass scores. On an Open Day expect more visitors and a special-livery guest arrival.</p><p><b>Hijack (squawk 7500).</b> Give an immediate, priority landing. Afterwards the aircraft stops where it vacated for about three minutes while police surround it, so keep that taxiway clear.</p><p><b>Medevac &amp; VIP.</b> "Lifeguard" and "Executive" flights ask for priority: approve and put them first. Delays and go-arounds cost points.</p><p><b>Diversions.</b> When a nearby airport closes, several aircraft arrive short of fuel. Keep them moving or they will declare a fuel emergency.</p><p><b>Special liveries.</b> Spot one-off paint jobs and heritage schemes: a "Spotter alert" appears in the messages.</p>'});
})();
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
 fit(){this.cx=0;this.cz=-170;const c=Math.abs(Math.cos(this.TH)),sn=Math.abs(Math.sin(this.TH)),hl=AP.half+250,hw=330;const W=c*hl+sn*hw,H=sn*hl+c*hw;this.sc=Math.min(this.w/(2*W),this.h/(2*H))*0.96;},
 wide(){this.cx=0;this.cz=-80;this.sc=Math.min(this.w,this.h)/(2*NM*11);},
 get TH(){return (AP.hdg-90)*Math.PI/180;},
 P(x,z){const c=Math.cos(this.TH),s=Math.sin(this.TH),dx=x-this.cx,dz=z-this.cz;return [this.w/2+(dx*c-dz*s)*this.sc,this.h/2+(dx*s+dz*c)*this.sc];},
 W(px,py){const c=Math.cos(this.TH),s=Math.sin(this.TH),X=(px-this.w/2)/this.sc,Z=(py-this.h/2)/this.sc;return [this.cx+X*c+Z*s,this.cz-X*s+Z*c];},
 poly(ctx,pts,fill,stroke){ctx.beginPath();pts.forEach((q,i)=>{const [a,b]=this.P(q[0],q[1]);i?ctx.lineTo(a,b):ctx.moveTo(a,b);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}},
 rect(ctx,x0,z0,x1,z1,fill,stroke){this.poly(ctx,[[x0,z0],[x1,z0],[x1,z1],[x0,z1]],fill,stroke);},
 strip(ctx,cx0,cz0,len,wid,rel,fill,stroke){const r=(rel||0)*Math.PI/180,c=Math.cos(r),s=Math.sin(r),hl=len/2,hw=wid/2;const q=[[-hl,-hw],[hl,-hw],[hl,hw],[-hl,hw]].map(([a,b])=>[cx0+a*c-b*s,cz0+a*s+b*c]);this.poly(ctx,q,fill,stroke);},
 bind(){
  const cv=this.cv;let drag=null;
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,m:0};});
  cv.addEventListener('pointermove',e=>{
   const r=cv.getBoundingClientRect();this.mx=e.clientX-r.left;this.my=e.clientY-r.top;
   if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.m+=Math.abs(dx)+Math.abs(dy);{const c=Math.cos(this.TH),s=Math.sin(this.TH);this.cx-=(dx*c+dy*s)/this.sc;this.cz-=(-dx*s+dy*c)/this.sc;}}
   else this.hover=this.pick(this.mx,this.my);
   cv.style.cursor=this.hover&&!drag?'pointer':'grab';
  });
  cv.addEventListener('pointerup',e=>{if(drag&&drag.m<5&&this.onPick){const r=cv.getBoundingClientRect();this.onPick(this.pick(e.clientX-r.left,e.clientY-r.top));}drag=null;});
  cv.addEventListener('wheel',e=>{e.preventDefault();const r=cv.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;const [wx,wz]=this.W(px,py);
   this.sc=clamp(this.sc*(1-e.deltaY*0.0014),0.0035,3);{const c=Math.cos(this.TH),s=Math.sin(this.TH),X=(px-this.w/2)/this.sc,Z=(py-this.h/2)/this.sc;this.cx=wx-(X*c+Z*s);this.cz=wz-(-X*s+Z*c);}},{passive:false});
 },
 pick(px,py){
  let best=null,bd=1e9;
  for(const h of this.hits){const d=Math.hypot(h.x-px,h.y-py);if(d<h.r&&d<bd){bd=d;best=h.e;}}
  return best;
 },
 phaseText(a){
  if(a.veh)return a.phase==='INSP'?'RWY INSP':a.phase==='REQ'?'WAITING':a.phase==='GO'?'RESPONDING':a.phase==='ONSCENE'?'ON SCENE':'RETURN';
  const m={BOARDING:'BOARDING '+Math.round(a.board*100)+'%',AT_GATE:'STAND',PUSHBACK:'PUSHBACK',PUSH_TURN:'PUSHBACK',STOPPED:'HOLD POS',HOLDING:'HP '+(a.destNode?HPN[a.destNode]:''),TAXI:a.paused?'HOLDING':'TAXI',LINEUP:'LINING UP',ON_RWY:'LINED UP',ROLL:'TAKEOFF',RTO:'REJECT TO',RWY_STOP:'STOPPED RWY',CLIMB:'CLIMB',RETURN:'RETURN',APPROACH:'ILS '+RWD(),GOAROUND:'GO-AROUND',ROLLOUT:'LANDING',BLOCKED_ROLL:'TYRE BURST',VACATED:'VACATED',PARKED:'AT STAND',TRANSIT:'ZONE TRANSIT',VHOLD:'HOLDING OUTSIDE',VLEAVE:'LEAVING',FLYPAST:'FLYPAST'};
  return m[a.phase]||a.phase;
 },
 draw(t){
  const ctx=this.ctx,C=this.C,d=this.dpr;ctx.setTransform(d,0,0,d,0,0);ctx.fillStyle=C.bg;ctx.fillRect(0,0,this.w,this.h);
  const sc=this.sc,S=(x,z)=>this.P(x,z),TH=this.TH;this.hits=[];
  this.environment(ctx,sc);
  // radar scope: soft vignette, range rings centred on the field, bearing ticks
  { const g=ctx.createRadialGradient(this.w/2,this.h/2,Math.min(this.w,this.h)*0.15,this.w/2,this.h/2,Math.max(this.w,this.h)*0.75);g.addColorStop(0,'rgba(18,40,30,0.55)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,this.w,this.h); }
  { const gstep=sc>0.08?100:sc>0.02?500:NM*2,gp=gstep*sc;ctx.strokeStyle=C.grid;ctx.lineWidth=1;ctx.beginPath();
    const [ox0,oz0]=S(0,0);const sx0=((ox0%gp)+gp)%gp,sz0=((oz0%gp)+gp)%gp;
    for(let x=sx0;x<=this.w;x+=gp){const px=Math.round(x)+0.5;ctx.moveTo(px,0);ctx.lineTo(px,this.h);}
    for(let z=sz0;z<=this.h;z+=gp){const py=Math.round(z)+0.5;ctx.moveTo(0,py);ctx.lineTo(this.w,py);}ctx.stroke(); }
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
  // apron outline + terminal(s)
  { ctx.lineWidth=1;this.rect(ctx,-520,-380,520,-255,'rgba(30,44,58,0.55)');
    this.rect(ctx,-500,-448,500,-402,'#16222d','#2c4054');
    if(sc>0.12){ctx.fillStyle=C.dim;ctx.font='11px "Barlow Condensed",sans-serif';ctx.textAlign='center';const [tx,tz]=S(0,-425);ctx.fillText(AIRPORT.term,tx,tz+4);ctx.textAlign='left';}
    if(sc>0.03&&AIRPORT.labels){ctx.fillStyle='#7d93a6';ctx.font='11px "Barlow Condensed",sans-serif';ctx.textAlign='center';AIRPORT.labels.forEach(([n,x,z])=>{if(n===AIRPORT.term||n==='TERMINAL')return;const [lx,lz]=S(x,z);ctx.fillText(n,lx,lz+4);});ctx.textAlign='left';} }
  // other runways of the real airport (not used in this simulation, drawn for realism)
  (AIRPORT.others||[]).forEach(o=>{this.strip(ctx,o.dx,o.dz,o.len,o.w,o.rel||0,'#10181a','#31413c');
    if(sc>0.025){ctx.fillStyle='#4d6459';ctx.font='10px "JetBrains Mono",monospace';ctx.textAlign='center';const [lx,lz]=S(o.dx,o.dz);ctx.fillText(o.name,lx,lz-6);ctx.textAlign='left';}});
  // runway
  { const busy=rwyOccupied(null);ctx.lineWidth=1;this.strip(ctx,0,0,AP.half*2,Math.max(AP.w,sc<0.08?AP.w*1.8:AP.w),0,busy?'#3a2a2d':C.rw,busy?'#ff7a7a':C.rwEdge);
    ctx.strokeStyle='#7f94a6';ctx.setLineDash([8,10]);{const [a0,a1]=S(-AP.half,0),[b0,b1]=S(AP.half,0);ctx.beginPath();ctx.moveTo(a0,a1);ctx.lineTo(b0,b1);ctx.stroke();}ctx.setLineDash([]);
    ctx.font='bold 13px "Barlow Condensed",sans-serif';ctx.textAlign='center';
    {const [ax,az]=S(-AP.half-60/Math.max(sc*3,1),0),[bx,bz]=S(AP.half+60/Math.max(sc*3,1),0);
     const ua=[Math.cos(TH),Math.sin(TH)];
     ctx.fillStyle=G.rwy==='09'?C.dep:C.dim;ctx.fillText(AIRPORT.rwy.a,ax-ua[0]*14,az-ua[1]*14+4);ctx.fillStyle=G.rwy==='27'?C.dep:C.dim;ctx.fillText(AIRPORT.rwy.b,bx+ua[0]*14,bz+ua[1]*14+4);}
    ctx.textAlign='left'; }
  // holding points, labels
  ['B','C','D','E'].forEach(k=>{const n=NODES['H'+k];const [hx,hz]=S(n.x,n.z);ctx.strokeStyle=C.hold;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(hx-Math.max(6,13*sc),hz);ctx.lineTo(hx+Math.max(6,13*sc),hz);ctx.stroke();
   ctx.fillStyle=C.hold;ctx.font='10px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText('HP '+EXN[k][0],hx,hz-5);ctx.textAlign='left';});
  const CONN_LBL=['B','C','D','E'].map(k=>[EXN[k],NODES['H'+k].x,-100]);
  if(sc>0.07){ctx.font='11px "Barlow Condensed",sans-serif';ctx.fillStyle='#62798b';ctx.textAlign='center';
   [[AIRPORT.tx.par,-430,-150],[AIRPORT.tx.par,430,-150],...CONN_LBL,[AIRPORT.tx.fox,-160,-225],[AIRPORT.tx.gol,160,-225]].forEach(([n,x,z])=>{const [lx,lz]=S(x,z);ctx.fillText(n.toUpperCase(),lx,lz);});ctx.textAlign='left';}
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
   let [px,pz]=this.P(e.x,e.z);const off=px<10||px>this.w-10||pz<10||pz>this.h-10;
   const col=e.veh?(e.vt==='fire'?'#ff7a5a':C.veh):e.nordo?C.mag:(e.emerg?C.bad:(e.vis?'#b99cff':e.kind==='arr'?C.arr:C.dep));
   if(off){ if(e.veh||Math.hypot(e.x,e.z)<3000)return;
     const ex=clamp(px,14,this.w-14),ez=clamp(pz,14,this.h-14),ang=Math.atan2(pz-this.h/2,px-this.w/2);
     ctx.save();ctx.translate(ex,ez);ctx.rotate(ang);ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-5,-5);ctx.lineTo(-5,5);ctx.closePath();ctx.stroke();ctx.restore();
     ctx.fillStyle=col;ctx.font=FONT(true,10);ctx.textAlign=ex>this.w/2?'right':'left';ctx.fillText(e.cs+' '+(Math.hypot(e.x,e.z)/NM).toFixed(1)+'nm',ex+(ex>this.w/2?-14:14),ez+3);ctx.textAlign='left';
     this.hits.push({x:ex,y:ez,r:20,e});return;}
   const air=!e.veh&&e.y>10,isSel=e.id===this.sel,inConf=conf.has(e.id);
   const tr=this.trails.get(e.id);
   if(tr&&(air||e.v>12)){tr.forEach((p,i)=>{const k=(i+1)/tr.length;ctx.fillStyle=col;ctx.globalAlpha=0.15+0.5*k;const q=Math.max(1.5,2.5*k);const [tx_,tz_]=this.P(p[0],p[1]);ctx.fillRect(tx_-q/2,tz_-q/2,q,q);});ctx.globalAlpha=1;}
   // velocity vector (45 s) for airborne targets
   if(air&&e.v>20){const vx=px+Math.cos(e.th+TH)*e.v*45*sc,vz=pz+Math.sin(e.th+TH)*e.v*45*sc;ctx.strokeStyle=col;ctx.globalAlpha=0.55;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(px,pz);ctx.lineTo(vx,vz);ctx.stroke();ctx.globalAlpha=1;}
   const size=e.veh?Math.max(4,6*sc*3):Math.max(6,e.type.wing*sc*0.8);
   if(air&&sc<0.12){ // airborne at radar scale: hollow diamond (secondary radar return)
    radarSym(ctx,e,px,pz,inConf?C.bad:col,t);
   }else{
    ctx.save();ctx.translate(px,pz);ctx.rotate(e.th+TH);
    if(e.veh){ctx.fillStyle=col;ctx.fillRect(-size,-size*0.6,size*2,size*1.2);}
    else drawSym(ctx,e,Math.max(e.type&&(e.type.heli||e.type.light)?7:6,size),inConf?C.bad:col,t);
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
  for(const e of G.ents){if(e.dead||e.veh)continue;if(e.phase==='TAXI'&&e.blowHold&&e.path&&e.path.len-e.s<140){ctx.strokeStyle=C.bad;ctx.lineWidth=3;ctx.globalAlpha=0.5+0.5*Math.sin(t*10);{const [ix,iz]=this.P(e.x,e.z);ctx.strokeRect(ix-22,iz-22,44,44);}ctx.globalAlpha=1;}}
  // thunderstorm cell on the radar
  if(G.cell){const c=G.cell,[cx,cz]=this.P(c.x,c.z),R=c.r*this.sc;const gr=ctx.createRadialGradient(cx,cz,R*0.1,cx,cz,R);gr.addColorStop(0,'rgba(255,60,50,0.55)');gr.addColorStop(0.45,'rgba(255,170,40,0.38)');gr.addColorStop(1,'rgba(60,200,90,0.18)');
   ctx.fillStyle=gr;ctx.beginPath();ctx.arc(cx,cz,R,0,6.283);ctx.fill();ctx.strokeStyle='rgba(255,120,60,0.6)';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
   ctx.fillStyle='#ffb347';ctx.font='bold 10px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText('CB '+Math.round(Math.hypot(c.vx,c.vz)*1.94)+'kt',cx,cz+4);ctx.textAlign='left';}
  // wind + scale overlay
  this.overlay(ctx,t);
 },
 environment(ctx,sc){
  const E=AIRPORT.env||{},g=E.ground;const tint={desert:'rgba(70,56,30,0.34)',urban:'rgba(44,46,56,0.34)',tropical:'rgba(18,60,34,0.30)',green:'rgba(24,52,30,0.26)'}[g];
  if(tint){ctx.fillStyle=tint;ctx.fillRect(0,0,this.w,this.h);}
  if(E.sea){const b=E.sea.b*Math.PI/180,nx=Math.sin(b),nz=-Math.cos(b),[fx,fz]=this.P(0,0),dist=E.sea.d*sc,R=Math.hypot(this.w,this.h)*2;
   const bx=fx+nx*dist,bz=fz+nz*dist,tx=-nz,tz=nx;ctx.fillStyle='#07182a';ctx.beginPath();ctx.moveTo(bx+tx*R,bz+tz*R);ctx.lineTo(bx-tx*R,bz-tz*R);ctx.lineTo(bx-tx*R+nx*R,bz-tz*R+nz*R);ctx.lineTo(bx+tx*R+nx*R,bz+tz*R+nz*R);ctx.closePath();ctx.fill();
   ctx.strokeStyle='#1d4d6e';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(bx+tx*R,bz+tz*R);ctx.lineTo(bx-tx*R,bz-tz*R);ctx.stroke();
   if(sc<0.1){ctx.fillStyle='#2b6a8f';ctx.font='10px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText(E.sea.name||'',bx+nx*80,bz+nz*80);ctx.textAlign='left';}}
 },
 overlay(ctx,t){
  const C=this.C;
  // scope info block (top-right), like a controller client's status line
  ctx.font='bold 11px "JetBrains Mono",monospace';ctx.textAlign='right';ctx.fillStyle='#6fe0a0';const rng=Math.round(Math.min(this.w,this.h)/2/this.sc/NM*10)/10;
  ctx.fillText(AIRPORT.short.toUpperCase()+'  '+AIRPORT.icao+'   RWY '+RWD()+'   QNH '+(G.qnh||''),this.w-14,22);ctx.fillStyle='#4f8a6a';ctx.font='10px "JetBrains Mono",monospace';ctx.fillText('NORTH UP · RANGE '+(rng>=1?rng.toFixed(1)+' NM':Math.round(rng*1852)+' M')+' · TARGETS '+G.ents.filter(e=>!e.dead&&!e.veh).length,this.w-14,36);ctx.textAlign='left';
  // scale bar
  const len=this.sc>0.05?500:NM,px=len*this.sc;ctx.strokeStyle=C.txt;ctx.fillStyle=C.txt;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(14,this.h-16);ctx.lineTo(14+px,this.h-16);ctx.moveTo(14,this.h-20);ctx.lineTo(14,this.h-12);ctx.moveTo(14+px,this.h-20);ctx.lineTo(14+px,this.h-12);ctx.stroke();
  ctx.font='10px "JetBrains Mono",monospace';ctx.fillText(len===500?'500 m':'1 nm',18,this.h-24);
  // wind rose
  const cx=this.w-44,cz=this.h-44;ctx.strokeStyle='#2d4256';ctx.beginPath();ctx.arc(cx,cz,26,0,6.283);ctx.stroke();
  ctx.fillStyle=C.dim;ctx.font='9px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText('N',cx,cz-29);ctx.textAlign='left';
  const a=G.wind.dir*D2R+this.TH;ctx.save();ctx.translate(cx,cz);ctx.rotate(a);ctx.strokeStyle=C.arr;ctx.fillStyle=C.arr;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-20);ctx.lineTo(0,18);ctx.stroke();ctx.beginPath();ctx.moveTo(0,22);ctx.lineTo(-5,12);ctx.lineTo(5,12);ctx.closePath();ctx.fill();ctx.restore();
  ctx.fillStyle=C.txt;ctx.font='bold 10px "JetBrains Mono",monospace';ctx.textAlign='center';ctx.fillText(pad(Math.round(WDM(G.wind)/10)*10%360||360,3)+'/'+Math.round(G.wind.spd),cx,cz+40);ctx.textAlign='left';
 }
};
