'use strict';
/* =====================================================================
   RARE AIRCRAFT — Concorde, Grumman F-14 Tomcat, Northrop B-2 Spirit.
   Hand-built from the real planform dimensions.  Same contract as R3.buildAC (acmodel.js):
   root.userData {gear,strobes,beacon,land,beam,fans,props,fus,dims}, engines/wings/fins tagged for the FX system.
   Extra: userData.anim(e,dt,t) — Concorde nose droop, Tomcat wing sweep.
   ===================================================================== */
(function(){
const V3=THREE.Vector3,TAU=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t;
const spow=(x,p)=>Math.sign(x)*Math.pow(Math.abs(x),p);
const lin=c=>new THREE.Color(c).convertSRGBToLinear();
const cvs=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];};
const MC={};
function mat(key,c,o){return MC[key]||(MC[key]=new THREE.MeshStandardMaterial(Object.assign({color:lin(c),roughness:0.5,metalness:0.2},o||{})));}
function ctex(c){const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;}
function skinTex(base,line,seed,W,H){
 const[c,x]=cvs(W||512,H||512);x.fillStyle=base;x.fillRect(0,0,c.width,c.height);
 let s=seed||7;const R=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
 for(let i=0;i<70;i++){x.fillStyle='rgba(0,0,0,'+(0.02+R()*0.05)+')';x.fillRect(R()*c.width,R()*c.height,10+R()*70,6+R()*30);}
 x.strokeStyle=line;x.lineWidth=1;
 for(let i=0;i<26;i++){const px=R()*c.width;x.beginPath();x.moveTo(px,0);x.lineTo(px+(R()-0.5)*6,c.height);x.stroke();}
 for(let i=0;i<20;i++){const py=R()*c.height;x.beginPath();x.moveTo(0,py);x.lineTo(c.width,py+(R()-0.5)*6);x.stroke();}
 return ctex(c);
}
/* lofted body of superelliptic sections. st: [{x,w,h,yc,p}] ascending x; ring starts at the top (+y) */
function loft(st,seg,m){
 const P=[],U=[],I=[],x0=st[0].x,x1=st[st.length-1].x,R=seg+1;
 st.forEach(s=>{const p=2/(s.p||2.3);for(let j=0;j<=seg;j++){const th=TAU*j/seg;P.push(s.x,(s.yc||0)+s.h*spow(Math.cos(th),p),s.w*spow(Math.sin(th),p));U.push(j/seg,(s.x-x0)/(x1-x0));}});
 for(let k=0;k<st.length-1;k++)for(let j=0;j<seg;j++){const a=k*R+j,b=a+1,c=a+R,d=c+1;I.push(a,b,c,b,d,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();
 {const k=Math.floor((st.length-1)/2),a=k*R,b=a+1,c=a+R,p=g.attributes.position.array;
  const e1=[p[b*3]-p[a*3],p[b*3+1]-p[a*3+1],p[b*3+2]-p[a*3+2]],e2=[p[c*3]-p[a*3],p[c*3+1]-p[a*3+1],p[c*3+2]-p[a*3+2]];
  if(e1[2]*e2[0]-e1[0]*e2[2]<0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const q=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=q;}g.computeVertexNormals();}}
 const me=new THREE.Mesh(g,m);me.castShadow=true;me.receiveShadow=true;return me;
}
function interp(tab,x){
 if(x<=tab[0][0])return tab[0].slice(1);if(x>=tab[tab.length-1][0])return tab[tab.length-1].slice(1);
 for(let i=0;i<tab.length-1;i++)if(x<=tab[i+1][0]){const t=(x-tab[i][0])/(tab[i+1][0]-tab[i][0]);return tab[i].slice(1).map((v,k)=>lerp(v,tab[i+1][k+1],t));}
}
function stations(tab,xa,xb,n,p){const out=[];for(let i=0;i<=n;i++){const x=lerp(xa,xb,i/n),v=interp(tab,x);out.push({x,w:v[0],h:v[1],yc:v[2],p:v[3]||p||2.3});}return out;}
/* half-width of a section at height y (for placing flank decals on the skin) */
function zAt(tab,x,y){const v=interp(tab,x),w=v[0],h=v[1],yc=v[2],p=v[3]||2.3;const c=clamp(Math.abs((y-yc)/h),0,0.999);return w*Math.pow(1-Math.pow(c,p),1/p);}
function slab(secs,side,m,K){const g=R3.liftSurface(secs,side,K||12);const me=new THREE.Mesh(g,m);me.castShadow=true;me.receiveShadow=true;return me;}
function box(w,h,d,m,x,y,z){const me=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);me.position.set(x,y,z);return me;}
function cylX(r0,r1,len,m,x,y,z,seg){const g=new THREE.CylinderGeometry(r1,r0,len,seg||14);g.rotateZ(Math.PI/2);const me=new THREE.Mesh(g,m);me.position.set(x,y,z);return me;}
function sph(sx,sy,sz,m,x,y,z){const me=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),m);me.scale.set(sx,sy,sz);me.position.set(x,y,z);return me;}
function textTex(txt,font,col,w,h,o){o=o||{};const[c,x]=cvs(w,h);x.clearRect(0,0,w,h);x.font=font;x.fillStyle=col;x.textAlign='center';x.textBaseline='middle';
 try{if(o.sp)x.letterSpacing=o.sp;}catch(e){}x.fillText(txt,w/2,h/2+(o.dy||0));return ctex(c);}
function decalMat(t){return new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:0.55,metalness:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});}
function flankDecal(parent,t,w,h,x,y,zs){
 const g=new THREE.PlaneGeometry(w,h),m=decalMat(t);
 const r=new THREE.Mesh(g,m);r.position.set(x,y,zs);parent.add(r);
 const l=new THREE.Mesh(g,m);l.position.set(x,y,-zs);l.rotation.y=Math.PI;parent.add(l);
}
function finDecal(parent,t,w,h,x,y,zs){
 const g=new THREE.PlaneGeometry(w,h),m=decalMat(t);
 const r=new THREE.Mesh(g,m);r.position.set(x,y,zs);parent.add(r);
 const l=new THREE.Mesh(g,m);l.position.set(x,y,-zs);l.rotation.y=Math.PI;parent.add(l);
}
function wheel(R,w,x,y,z){const g=new THREE.Group();
 const t=new THREE.Mesh(new THREE.CylinderGeometry(R,R,w,22),mat('tire',0x131416,{roughness:0.95,metalness:0}));t.rotation.x=Math.PI/2;g.add(t);
 const h=new THREE.Mesh(new THREE.CylinderGeometry(R*0.58,R*0.58,w*1.04,16),mat('hub',0xb4bbc1,{metalness:0.9,roughness:0.3}));h.rotation.x=Math.PI/2;g.add(h);
 g.position.set(x,y,z);return g;}
function strutBetween(parent,A,B,r,m){const d=new V3().subVectors(B,A),l=d.length();const me=new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.1,l,10),m||mat('steel',0x9aa2a9,{metalness:0.8,roughness:0.38}));
 me.position.copy(A).addScaledVector(d,0.5);me.quaternion.setFromUnitVectors(new V3(0,1,0),d.normalize());parent.add(me);}
function leg(parent,x,topY,groundY,z,R,w,cfg){
 const axY=groundY+R;strutBetween(parent,new V3(x,topY,z),new V3(x,axY+R*0.4,z),0.11);
 strutBetween(parent,new V3(x+0.12,topY*0.6+axY*0.4,z),new V3(x+0.12,topY*0.4+axY*0.6+0.0,z),0.04);
 const rows=cfg.rows||1,n=cfg.n||1,sp=w*1.15;
 for(let r=0;r<rows;r++)for(let k=0;k<n;k++){const xx=x+(rows>1?(r-0.5)*R*2.2:0),zz=z+(n>1?(k-(n-1)/2)*sp:0);parent.add(wheel(R,w,xx,axY,zz));}
 if(rows>1||n>1){const ax=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,Math.max(0.3,(n-1)*sp+0.2),8),mat('steel',0x9aa2a9,{metalness:0.8,roughness:0.38}));ax.rotation.x=Math.PI/2;ax.position.set(x,axY,z);parent.add(ax);}
}
function lite(body,M,col,x,y,z,r,sc){const g=new THREE.Group();g.position.set(x,y,z);g.add(new THREE.Mesh(new THREE.SphereGeometry(r||0.15,8,6),new THREE.MeshBasicMaterial({color:col,toneMapped:false})));
 const sp=new THREE.Sprite(M.glowM.clone());sp.material.color.setHex(col);sp.scale.set(sc||3,sc||3,1);g.add(sp);body.add(g);return g;}
function pickReg(list,a){return list[(a.id*7+3)%list.length];}

/* ---------------------------------------------------------------------------
   CONCORDE  (61.66 m, span 25.6 m, ogival delta, droop nose, four Olympus 593)
   --------------------------------------------------------------------------- */
const CF=[
 [-30.83,0.07,0.07,0.95],[-29.5,0.28,0.30,0.88],[-26,0.80,0.90,0.52],[-21,1.22,1.40,0.18],[-14,1.43,1.62,0.0],[8,1.43,1.62,0.0],
 [13,1.38,1.54,-0.04],[17,1.20,1.30,-0.14],[19.5,1.08,1.14,-0.20],[22,0.88,0.90,-0.32],[25,0.62,0.62,-0.50],[28,0.34,0.34,-0.72],[30.2,0.14,0.14,-0.84],[30.83,0.04,0.04,-0.86]];
function buildConcorde(a,M,body,dims){
 const L=61.66,al=a.al,BA=al.liv==='BA';
 const paint=mat('conc_wh',0xf3f4f2,{roughness:0.34,metalness:0.12});
 const belly=mat('conc_bel',0xc9cdd0,{roughness:0.4,metalness:0.15});
 const HX=19;
 body.add(loft(stations(CF,-30.83,HX,46,2.2),44,paint));
 const nose=new THREE.Group(),hv=interp(CF,HX);nose.position.set(HX,hv[2],0);body.add(nose);
 {const st=stations(CF,HX,30.83,22,2.2).map(s=>({x:s.x-HX,w:s.w,h:s.h,yc:s.yc-hv[2],p:s.p}));nose.add(loft(st,44,paint));
  const gl=mat('conc_gl',0x0e161d,{roughness:0.05,metalness:0.8,envMapIntensity:2.2});
  nose.add(sph(1.9,0.13,0.86,gl,2.7,0.62,0));
  nose.add(sph(0.9,0.26,0.1,gl,3.2,0.30,0.9),sph(0.9,0.26,0.1,gl,3.2,0.30,-0.9));
  nose.add(cylX(0.012,0.04,1.6,mat('pit',0x888e96,{metalness:0.8}),11.6,-0.66,0,8));
  nose.add(sph(0.5,0.16,0.16,mat('conc_nose',0x1a1c1f,{roughness:0.5}),10.6,-0.62,0)); }
 body.add(box(36,0.04,1.8,belly,-2,-1.6,0));
 {const[c,x]=cvs(2048,64);x.clearRect(0,0,2048,64);x.fillStyle='#0c1218';
  for(let i=0;i<58;i++){const px=40+i*(1968/58);x.beginPath();x.ellipse(px,32,10,15,0,0,TAU);x.fill();}
  flankDecal(body,ctex(c),30,0.95,-2.5,0.42,zAt(CF,-2.5,0.42)+0.01);}
 {const[c,x]=cvs(2048,64);x.clearRect(0,0,2048,64);
  x.fillStyle=BA?'#14285a':'#213a8f';x.fillRect(0,12,2048,22);x.fillStyle=BA?'#c8102e':'#d9232d';x.fillRect(0,36,2048,12);
  flankDecal(body,ctex(c),50,1.0,-1,-0.45,zAt(CF,-1,-0.45)+0.01);}
 flankDecal(body,textTex(BA?'British Airways':'AIR FRANCE','bold '+(BA?'150':'160')+'px Georgia, serif',BA?'#14285a':'#213a8f',1100,200),9.0,1.55,9.6,0.9,zAt(CF,9.6,0.9)+0.01);
 flankDecal(body,textTex('CONCORDE','bold 130px Arial, sans-serif','#8a8d92',900,180,{sp:'18px'}),5.0,0.9,-17.5,0.85,zAt(CF,-17.5,0.85)+0.01);
 const reg=a.reg||(BA?pickReg(['G-BOAC','G-BOAA','G-BOAB','G-BOAD','G-BOAE','G-BOAF','G-BOAG'],a):pickReg(['F-BTSD','F-BVFA','F-BVFB','F-BVFC','F-BTSC'],a));a.reg=reg;
 flankDecal(body,textTex(reg,'bold 150px Arial, sans-serif','#2a2d31',700,200),3.0,0.8,-25.5,0.55,zAt(CF,-25.5,0.55)+0.01);
 // ogival delta wing
 const wm=mat('conc_w',0xeceeee,{roughness:0.4,metalness:0.12});
 const zr=1.0,zt=12.8,N=14,secs=[];
 const z0=1.4,xroot=17.2,xtip=-11.4;const sl=z=>lerp(4.3,1.3,Math.pow(clamp((z-z0)/(zt-z0),0,1),0.8));
 const zs=[];for(let i=0;i<=N;i++)zs.push(lerp(zr,zt,Math.pow(i/N,0.9)));
 let cum=0;const cx=[0];for(let i=1;i<=N;i++){cum+=sl((zs[i]+zs[i-1])/2)*(zs[i]-zs[i-1]);cx.push(cum);}
 const kx=(xroot-xtip)/cx[N];
 for(let i=0;i<=N;i++){const z=zs[i],xle=xroot-cx[i]*kx,v=(z-zr)/(zt-zr),xte=lerp(-12.7,-14.2,v)-0.4*Math.sin(v*Math.PI);
  secs.push({x:xle,y:lerp(-1.0,-0.85,v),z:z,c:Math.max(1.0,xle-xte),tc:lerp(0.032,0.03,v),cam:-0.004,tw:0,ny:1,nz:0,u:v});}
 for(const sd of[-1,1]){const g=new THREE.Group();g.userData.part='wing';g.userData.side=sd;g.add(slab(secs,sd,wm,12));body.add(g);}
 // two nacelles, each with two Olympus 593 (twin intakes / twin nozzles)
 body.userData.engs=[];
 const nac=mat('conc_nac',0xe6e8e8,{roughness:0.38,metalness:0.25,side:THREE.DoubleSide}),dark=mat('dk',0x1a1c1f,{roughness:0.7,metalness:0.4});
 for(const sd of[-1,1]){
  const g=new THREE.Group();g.userData.part='eng';g.userData.side=sd;g.userData.eR=1.3;g.userData.eL=17;
  const stn=[{x:-9.2,w:1.45,h:0.82,yc:0,p:3.2},{x:-6,w:2.25,h:0.90,yc:0,p:4},{x:0,w:2.40,h:0.95,yc:0,p:4},{x:6,w:2.35,h:0.9,yc:0.02,p:3.6},{x:7.5,w:2.28,h:0.86,yc:0.02,p:3.0},{x:8.0,w:2.2,h:0.84,yc:0.0,p:3.0}];
  g.add(loft(stn,32,nac));
  for(const k of[-1,1]){
   g.add(box(0.12,1.55,1.5,dark,8.04,0,k*1.17));
   g.add(cylX(0.62,0.5,3.0,mat('noz',0x5d574f,{metalness:0.85,roughness:0.42}),-10.4,0,k*1.17,16));
   g.add(cylX(0.28,0.46,0.5,dark,-12.0,0,k*1.17,14));}
  g.add(box(0.1,1.6,0.5,mat('spl',0xe6e8e8),8.0,0,0));
  g.position.set(-3.0,-1.45,sd*5.0);body.userData.engs.push(g);body.add(g);}
 // fin & rudders
 const fm=mat('conc_fin'+(BA?'b':'w'),BA?0x14285a:0xf3f4f2,{roughness:0.34,metalness:0.12});
 const fh=7.0,fs=[0,0.35,0.7,1].map(f=>({x:lerp(-14.5,-21.8,f),y:1.3+fh*f,z:0,c:lerp(12.6,3.0,f),tc:lerp(0.05,0.04,f),cam:0,tw:0,ny:0,nz:1,u:f}));
 const fg=new THREE.Group();fg.userData.part='tail';fg.add(slab(fs,1,fm,12));body.add(fg);
 if(BA){const[c,x]=cvs(512,320);x.fillStyle='#14285a';x.fillRect(0,0,512,320);
  x.strokeStyle='#fff';x.lineWidth=64;x.beginPath();x.moveTo(0,0);x.lineTo(512,320);x.moveTo(512,0);x.lineTo(0,320);x.stroke();
  x.strokeStyle='#c8102e';x.lineWidth=22;x.beginPath();x.moveTo(0,0);x.lineTo(512,320);x.moveTo(512,0);x.lineTo(0,320);x.stroke();
  x.fillStyle='#fff';x.fillRect(0,112,512,96);x.fillRect(208,0,96,320);x.fillStyle='#c8102e';x.fillRect(0,136,512,48);x.fillRect(232,0,48,320);
  finDecal(body,ctex(c),5.2,3.2,-22.6,4.8,0.23);}
 else{const[c,x]=cvs(256,320);x.fillStyle='#213a8f';x.fillRect(0,0,86,320);x.fillStyle='#fff';x.fillRect(86,0,84,320);x.fillStyle='#d9232d';x.fillRect(170,0,86,320);
  finDecal(body,ctex(c),3.6,4.6,-22.4,4.2,0.23);}
 body.add(cylX(0.18,0.2,0.8,mat('bump',0x2a2d31),-30.0,0.6,0,10));
 body.add(sph(5.5,0.2,0.5,paint,-17,1.5,0));
 const gear=new THREE.Group(),gy=-dims.gearH;
 for(const sd of[-1,1])leg(gear,-3.0,-1.5,gy,sd*5.0,0.62,0.42,{n:2,rows:2});
 leg(gear,18.5,-1.3,gy,0,0.5,0.34,{n:2,rows:1});
 body.add(gear);
 const strobes=[lite(body,M,0xffffff,xtip-1.4,-0.86,-zt,0.16,5),lite(body,M,0xffffff,xtip-1.4,-0.86,zt,0.16,5),lite(body,M,0xffffff,-30.4,0.95,0,0.16,5)];
 lite(body,M,0xff2a2a,xtip-0.6,-0.86,-zt,0.14,2.2);lite(body,M,0x2aff5a,xtip-0.6,-0.86,zt,0.14,2.2);
 const beacon=lite(body,M,0xff1a1a,0,1.75,0,0.2,5);
 const land=lite(body,M,0xfff6dc,18.5,-1.2,0.35,0.22,6);
 const anim=(e,dt)=>{let tg=0;
  const lan=['APPROACH','ROLLOUT'].includes(e.phase)||(e.phase==='GOAROUND'&&e.y<150);
  if(e.y<3000){if(lan)tg=0.218;else if(e.y<250||e.y<3)tg=0.09;}
  const u=nose.userData;u.d=(u.d===undefined?tg:u.d)+(tg-u.d)*Math.min(1,dt*0.55);nose.rotation.z=-u.d;};
 return{strobes,beacon,land,gear,anim,L,half:zt,mainX:-3.0,mz:5.0,lex:xroot,rootC:27};
}

/* ---------------------------------------------------------------------------
   GRUMMAN F-14 TOMCAT  (19.1 m, span 19.55 m forward / 11.65 m swept, twin canted fins)
   --------------------------------------------------------------------------- */
const FF=[[-1.2,1.55,0.62,0.0,3.2],[0.6,1.32,0.80,0.04,2.6],[2.8,1.02,0.88,0.04,2.4],[4.8,0.84,0.80,0.0,2.3],[6.2,0.64,0.60,-0.04,2.2],[7.5,0.42,0.42,-0.07,2.1],[8.6,0.22,0.22,-0.09,2.1],[9.4,0.04,0.04,-0.1,2.1]];
function buildF14(a,M,body,dims){
 const al=a.al,sq=al.sq;
 const grey=new THREE.MeshStandardMaterial({map:skinTex('#8c9296','rgba(40,44,48,0.35)',a.id*13+5),roughness:0.62,metalness:0.18});
 const lgrey=mat('f14_lg',0xc5cacd,{roughness:0.6,metalness:0.18});
 const rad=mat('f14_rad',0x9a9690,{roughness:0.5,metalness:0.1});
 const dark=mat('dk',0x1a1c1f,{roughness:0.7,metalness:0.4}),steel=mat('steel',0x9aa2a9,{metalness:0.8,roughness:0.38});
 body.add(loft(stations(FF,-1.2,7.2,22,2.4),30,grey));
 body.add(loft(stations(FF,7.2,9.4,8,2.1),30,rad));
 const PB=[[-9.4,1.2,0.34,-0.12,3.4],[-6,1.45,0.40,-0.1,3.4],[-3,1.58,0.44,-0.04,3.4],[-1.2,1.55,0.50,-0.02,3.2]];
 body.add(loft(stations(PB,-9.4,-1.2,16,3.4),24,grey));
 body.userData.engs=[];
 const NS=[[-9.0,0.62,0.62,0,2.4],[-7,0.74,0.70,0,2.8],[-3,0.82,0.74,0,3.4],[1,0.74,0.66,-0.02,3.6],[2.6,0.66,0.60,-0.02,3.4]];
 for(const sd of[-1,1]){
  const g=new THREE.Group();g.userData.part='eng';g.userData.side=sd;g.userData.eR=0.75;g.userData.eL=11;
  g.add(loft(stations(NS,-9.0,2.6,22,3),26,grey));
  g.add(box(0.1,1.05,0.95,dark,2.62,0,0));
  g.add(cylX(0.62,0.5,1.5,mat('noz',0x5d574f,{metalness:0.85,roughness:0.42}),-9.4,0,0,18));
  g.add(cylX(0.30,0.5,0.4,dark,-10.2,0,0,16));
  g.position.set(0.0,-0.36,sd*1.60);body.userData.engs.push(g);body.add(g);}
 for(const sd of[-1,1])body.add(box(2.4,0.10,0.72,lgrey,2.0,0.34,sd*1.62));
 // twin canted fins carrying the squadron markings
 const fh=2.55,fsecs=[0,0.5,1].map(f=>({x:lerp(-4.6,-7.6,f),y:0.35+fh*f,z:0,c:lerp(3.9,1.7,f),tc:lerp(0.06,0.045,f),cam:0,tw:0,ny:0,nz:1,u:f}));
 const fgeo=R3.liftSurface(fsecs,1,10);
 const finM=sq?mat('f14_fin'+al.liv,sq.tail,{roughness:0.5,metalness:0.12}):grey;
 let finArt=null;
 if(sq){const[c,x]=cvs(512,400);x.clearRect(0,0,512,400);
  x.fillStyle='#'+sq.band.toString(16).padStart(6,'0');x.fillRect(0,300,512,30);
  if(al.liv==='VF84'){x.strokeStyle='#f2f2f2';x.lineWidth=22;x.lineCap='round';x.beginPath();x.moveTo(150,250);x.lineTo(360,70);x.moveTo(360,250);x.lineTo(150,70);x.stroke();
   x.fillStyle='#f2f2f2';x.beginPath();x.arc(256,150,66,0,TAU);x.fill();x.fillRect(222,190,68,50);
   x.fillStyle='#0d0e10';x.beginPath();x.arc(230,150,17,0,TAU);x.arc(282,150,17,0,TAU);x.fill();x.beginPath();x.moveTo(256,166);x.lineTo(244,190);x.lineTo(268,190);x.fill();}
  else if(al.liv==='VF111'){x.fillStyle='#f2c400';x.beginPath();x.arc(256,200,56,Math.PI,TAU);x.fill();x.strokeStyle='#f2c400';x.lineWidth=14;for(let i=0;i<12;i++){const th=Math.PI+(i+0.5)*Math.PI/12;x.beginPath();x.moveTo(256+Math.cos(th)*72,200+Math.sin(th)*72);x.lineTo(256+Math.cos(th)*120,200+Math.sin(th)*120);x.stroke();}}
  else if(al.liv==='VF2'){x.strokeStyle='#d8232a';x.lineWidth=18;x.beginPath();x.moveTo(110,230);x.bezierCurveTo(180,90,320,260,400,110);x.stroke();x.fillStyle='#f2f2f2';x.beginPath();x.arc(404,104,22,0,TAU);x.fill();}
  else{x.fillStyle='#e9c500';x.beginPath();x.moveTo(256,70);x.lineTo(336,250);x.lineTo(256,212);x.lineTo(176,250);x.fill();}
  x.fillStyle='#f4f4f4';x.font='bold 70px Arial, sans-serif';x.textAlign='center';x.fillText(sq.code,256,382);
  finArt=ctex(c);}
 for(const sd of[-1,1]){const fg=new THREE.Group();fg.userData.part='tail';fg.position.set(0,0,sd*2.0);fg.rotation.x=-sd*0.065;
  const fm=new THREE.Mesh(fgeo,finM);fm.castShadow=true;fg.add(fm);fg.add(box(1.5,0.08,0.3,dark,-7.7,0.35+fh+0.03,0));
  if(finArt)finDecal(fg,finArt,1.7,1.35,-7.55,1.25,0.115);
  body.add(fg);}
 // stabilators
 const hs=[{x:-7.0,y:-0.22,z:1.9,c:2.9,tc:0.05,u:0},{x:-7.9,y:-0.2,z:3.25,c:2.0,tc:0.045,u:0.5},{x:-8.7,y:-0.22,z:4.6,c:1.15,tc:0.04,u:1}].map(s=>Object.assign({cam:0,tw:0,ny:1,nz:0},s));
 for(const sd of[-1,1]){const g=new THREE.Group();g.userData.part='tail';g.add(slab(hs,sd,grey,10));body.add(g);}
 // bubble canopy, frames, pitot boom
 const gl=mat('f14_gl',0x23323f,{roughness:0.03,metalness:0.7,envMapIntensity:2.2,transparent:true,opacity:0.9});
 const frm=mat('frm',0x1b1e22);
 body.add(sph(2.35,0.48,0.6,gl,3.7,0.78,0),box(0.07,0.5,1.0,frm,5.6,0.72,0),box(0.07,0.55,1.1,frm,3.8,0.86,0),box(0.07,0.5,1.0,frm,2.0,0.72,0));
 body.add(cylX(0.012,0.025,1.4,steel,9.9,-0.1,0,8));
 for(const sd of[-1,1])body.add(sph(1.7,0.1,0.25,lgrey,4.4,0.12,sd*0.9));
 body.add(box(0.14,0.1,3.0,dark,-8.8,-0.72,0),cylX(0.07,0.07,3.1,dark,-8.2,-0.68,0,8));
 // fixed wing glove and the swing wings
 const glv=[{x:5.9,y:0.04,z:0.6,c:9.4,tc:0.05,u:0},{x:3.4,y:0.05,z:1.6,c:7.6,tc:0.05,u:0.5},{x:1.5,y:0.05,z:2.65,c:5.5,tc:0.05,u:1}].map(s=>Object.assign({cam:0,tw:0,ny:1,nz:0},s));
 for(const sd of[-1,1]){const g=new THREE.Group();g.userData.part='wing';g.userData.side=sd;g.add(slab(glv,sd,grey,10));body.add(g);}
 const ws=[{x:1.3,y:0.0,z:0.0,c:5.4,tc:0.075,u:0},{x:-0.35,y:0.0,z:3.5,c:3.5,tc:0.062,u:0.5},{x:-1.95,y:0.0,z:7.1,c:1.8,tc:0.046,u:1}].map(s=>Object.assign({cam:0.004,tw:0,ny:1,nz:0},s));
 const wings=[];
 for(const sd of[-1,1]){const piv=new THREE.Group();piv.position.set(0.15,0.12,sd*2.62);piv.userData.part='wing';piv.userData.side=sd;
  piv.add(slab(ws,sd,grey,12));
  piv.add(lite(body,M,sd<0?0xff2a2a:0x2aff5a,-2.0,0.05,sd*7.1,0.1,1.6));
  body.add(piv);wings.push(piv);}
 for(const sd of[-1,1])body.add(box(1.1,0.12,0.16,lgrey,0.8,-0.60,sd*0.62));
 // markings: modex on the nose, NAVY on the nacelles
 if(sq){
  const modex=(sq.mod+String(a.num).slice(-2));
  flankDecal(body,textTex(modex,'bold 150px Arial, sans-serif','#f4f4f4',500,200),1.5,0.6,5.0,0.12,zAt(FF,5.0,0.12)+0.01);
  flankDecal(body,textTex('NAVY','bold 160px Arial, sans-serif','#22262a',700,200,{sp:'6px'}),3.0,0.8,-4.6,-0.3,0.82+1.6+0.01);
 }
 const gear=new THREE.Group(),gy=-dims.gearH;
 leg(gear,5.7,-0.40,gy,0,0.33,0.2,{n:2,rows:1});
 gear.add(box(0.04,0.04,0.7,steel,5.9,gy+0.7,0));
 for(const sd of[-1,1])leg(gear,-1.3,-0.55,gy,sd*1.62,0.5,0.34,{n:1,rows:1});
 body.add(gear);
 const strobes=[lite(body,M,0xffffff,-7.9,0.35+fh+0.1,-2.2,0.1,3.5),lite(body,M,0xffffff,-7.9,0.35+fh+0.1,2.2,0.1,3.5),lite(body,M,0xffffff,-9.3,-0.2,0,0.1,3)];
 const beacon=lite(body,M,0xff1a1a,-1.5,0.55,0,0.14,3.5);
 const land=lite(body,M,0xfff6dc,5.9,-0.7,0.1,0.15,5);
 const anim=(e,dt)=>{let tg=0;
  if(e.y<3){if(['PARKED','AT_GATE','BOARDING','PUSHBACK'].includes(e.phase))tg=0.96;}
  else tg=clamp((e.v-85)/85,0,1)*0.9;
  const u=wings[0].userData;u.s=(u.s===undefined?tg:u.s)+clamp(tg-u.s,-0.5*dt,0.5*dt);
  wings[0].rotation.y=u.s;wings[1].rotation.y=-u.s;};
 return{strobes,beacon,land,gear,anim,L:19.1,half:9.77,mainX:-1.3,mz:1.62,lex:5.9,rootC:9.4};
}

/* ---------------------------------------------------------------------------
   NORTHROP B-2 SPIRIT  (21 m, span 52.4 m, flying wing, W trailing edge)
   --------------------------------------------------------------------------- */
function buildB2(a,M,body,dims){
 const al=a.al;
 const[c,x]=cvs(512,512);x.fillStyle='#2c2f33';x.fillRect(0,0,512,256);x.fillStyle='#35383c';x.fillRect(0,256,512,256);
 let s=a.id*31+7;const R=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};
 for(let i=0;i<240;i++){x.fillStyle='rgba('+(R()>0.5?'255,255,255':'0,0,0')+','+(0.012+R()*0.03)+')';x.fillRect(R()*512,R()*512,10+R()*90,4+R()*24);}
 x.strokeStyle='rgba(0,0,0,0.5)';x.lineWidth=1;for(let i=0;i<46;i++){const px=R()*512;x.beginPath();x.moveTo(px,0);x.lineTo(px+(R()-0.5)*8,256);x.moveTo(px,256);x.lineTo(px+(R()-0.5)*8,512);x.stroke();}
 for(let i=0;i<30;i++){const py=R()*256;x.beginPath();x.moveTo(0,py);x.lineTo(512,py);x.moveTo(0,256+py);x.lineTo(512,256+py);x.stroke();}
 const skin=new THREE.MeshStandardMaterial({map:ctex(c),roughness:0.55,metalness:0.28,envMapIntensity:0.9});
 const skinD=mat('b2d',0x1f2124,{roughness:0.6,metalness:0.3});
 const TE=[[0,-10.5],[4.5,-6.3],[9.0,-9.0],[14.5,-5.4],[26.2,-8.6]],LEx=z=>9.9-0.6*Math.abs(z);
 const teX=z=>{z=Math.abs(z);for(let i=0;i<TE.length-1;i++)if(z<=TE[i+1][0]){const t=(z-TE[i][0])/(TE[i+1][0]-TE[i][0]);return lerp(TE[i][1],TE[i+1][1],t);}return TE[TE.length-1][1];};
 const zsl=[0,1.2,2.4,3.6,4.5,5.4,6.8,8.0,9.0,10.5,12.5,14.5,17,20,23,26.2];
 const secs=zsl.map(z=>{const xle=LEx(z)+(z<1.8?0.5*(1-z/1.8):0),xte=teX(z),cc=xle-xte;
  const tc=lerp(0.125,0.05,clamp(z/16,0,1))*(z>20?1.3:1);
  return{x:xle,y:0,z:z,c:cc,tc:tc,cam:0,tw:0,ny:1,nz:0,u:z/26.2};});
 for(const sd of[-1,1]){const g=new THREE.Group();g.userData.part='wing';g.userData.side=sd;g.add(slab(secs,sd,skin,14));body.add(g);}
 const HB=[[-9.5,0.4,0.05,0.2,2.6],[-6,3.0,0.5,0.45,2.6],[-1,4.6,0.6,1.0,2.6],[2.5,3.8,0.62,1.15,2.6],[5.2,2.0,0.52,1.0,2.6],[7.4,0.9,0.3,0.55,2.6],[9.4,0.15,0.08,0.2,2.6]];
 body.add(loft(stations(HB,-9.5,9.4,26,2.6),30,skin));
 const gl=mat('b2gl',0x10171c,{roughness:0.05,metalness:0.8,envMapIntensity:2});
 for(const sd of[-1,1]){body.add(box(0.5,0.02,0.5,gl,7.3,0.78,sd*0.3),box(0.55,0.02,0.4,gl,6.7,0.88,sd*0.82));
  const q=box(0.5,0.02,0.36,gl,6.2,0.94,sd*1.1);q.rotation.y=sd*0.45;body.add(q);}
 for(const sd of[-1,1]){body.add(box(2.9,0.04,1.15,skinD,5.4,1.1,sd*3.1),box(1.8,0.04,1.1,skinD,-6.0,0.9,sd*3.4));}
 body.add(box(3.4,0.05,2.2,skinD,-9.0,0.36,0));
 body.add(box(8.2,0.03,1.5,skinD,-0.5,-1.34,0),box(1.4,0.03,2.2,skinD,6.8,-0.9,0));
 const nm=al.names&&al.names[a.id%al.names.length],ser=nm?nm[1]:'82-1066';a.reg=ser;
 {const t1=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.32),decalMat(textTex(ser,'bold 110px Arial, sans-serif','#c9ccd0',500,120)));t1.rotation.x=-Math.PI/2;t1.position.set(-3.0,1.22,2.2);body.add(t1);
  const t2=new THREE.Mesh(new THREE.PlaneGeometry(4.4,0.5),decalMat(textTex(nm?nm[0]:'Spirit','italic bold 140px Georgia, serif','#cfd2d6',1100,160)));t2.rotation.x=-Math.PI/2;t2.position.set(1.6,1.45,-1.6);body.add(t2);}
 body.userData.engs=[];
 for(const sd of[-1,1]){const g=new THREE.Group();g.userData.part='eng';g.userData.side=sd;g.userData.eR=0.9;g.userData.eL=9;g.position.set(-1,0.1,sd*3.3);body.userData.engs.push(g);body.add(g);}
 const gear=new THREE.Group(),gy=-dims.gearH;
 leg(gear,7.4,-0.7,gy,0,0.46,0.34,{n:2,rows:1});
 for(const sd of[-1,1])leg(gear,-0.8,-1.0,gy,sd*4.0,0.56,0.4,{n:1,rows:2});
 body.add(gear);
 const tipX=-5.8;
 const strobes=[lite(body,M,0xffffff,tipX-1.2,0.1,-26,0.12,4),lite(body,M,0xffffff,tipX-1.2,0.1,26,0.12,4),lite(body,M,0xffffff,-10,0.4,0,0.12,3.5)];
 lite(body,M,0xff2a2a,tipX,0.05,-25.9,0.1,1.8);lite(body,M,0x2aff5a,tipX,0.05,25.9,0.1,1.8);
 const beacon=lite(body,M,0xff1a1a,1,1.5,0,0.12,3.5);
 const land=lite(body,M,0xfff6dc,8.0,-0.85,0.0,0.14,5);
 return{strobes,beacon,land,gear,anim:null,L:21,half:26.2,mainX:-0.8,mz:4.0,lex:9.9,rootC:20.9};
}

/* ---------------------------------------------------------------------------
   dispatcher (same return contract as R3.buildAC)
   --------------------------------------------------------------------------- */
const SPECS={CONC:{gearH:3.8,fn:buildConcorde},F14:{gearH:1.8,fn:buildF14},B2:{gearH:3.3,fn:buildB2}};
const _b=R3.buildAC;
R3.buildAC=function(a){
 const ty=a.type,sp=SPECS[ty.n];if(!sp)return _b.call(this,a);
 const M=this.mat;if(!M.glowM)M.glowM=new THREE.SpriteMaterial({map:this.glow,color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
 const root=new THREE.Group(),pivot=new THREE.Group(),body=new THREE.Group();
 root.add(pivot);
 const out=sp.fn(a,M,body,{gearH:sp.gearH});
 pivot.position.set(out.mainX,0,0);body.position.set(-out.mainX,sp.gearH,0);pivot.add(body);
 const cone=new THREE.ConeGeometry(16,150,18,1,true);cone.translate(0,-75,0);cone.rotateZ(Math.PI/2);
 const beam=new THREE.Mesh(cone,new THREE.MeshBasicMaterial({color:0xfff2d0,transparent:true,opacity:0.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
 beam.position.copy(out.land.position);beam.rotation.z=-0.05;beam.visible=false;body.add(beam);
 const U=root.userData;U.gear=out.gear;U.strobes=out.strobes;U.beacon=out.beacon;U.land=out.land;U.beam=beam;U.fans=[];U.fus=body;U.anim=out.anim;
 U.dims={L:out.L,rf:ty.rf,gearH:sp.gearH,mainX:out.mainX,half:out.half,mz:out.mz,wy:0,lex:out.lex,rootC:out.rootC};
 const sh=new THREE.Mesh(new THREE.CircleGeometry(1,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.16,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));sh.rotation.x=-Math.PI/2;sh.position.y=0.12;
 const holder=new THREE.Group();holder.add(root);this.scene.add(holder);this.scene.add(sh);
 return{holder,root,body:pivot,sh,a};
};
const _ex=R3.extra;
R3.extra=function(dt,t){
 _ex.call(this,dt,t);
 for(const[id,m]of this.meshes){if(m.veh)continue;const u=m.root&&m.root.userData;if(u&&u.anim&&m.a)try{u.anim(m.a,dt,t);}catch(e){}}
};
})();
