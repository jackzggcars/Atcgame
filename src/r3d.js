'use strict';
/* =====================================================================
   3D TOWER VIEW (three.js r128)
   ===================================================================== */
const R3={
 ok:false,meshes:new Map(),labels:new Map(),tod:'day',sel:0,pax:[],bridges:[],fx:[],beams:[],
 cam:{mode:'tower',yaw:-0.98,pitch:-0.07,fov:52,dist:260,orbYaw:0.6,orbPitch:0.35,target:new THREE.Vector3(0,10,-330),pos:new THREE.Vector3(560,54,-372)},
 init(canvas,labelBox){
  this.canvas=canvas;this.labelBox=labelBox;
  try{this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}
  catch(e){this.ok=false;return false;}
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  this.scene=new THREE.Scene();
  this.camera=new THREE.PerspectiveCamera(52,1,1,70000);
  this.hemi=new THREE.HemisphereLight(0xffffff,0x4a5d3a,0.9);this.scene.add(this.hemi);
  this.sun=new THREE.DirectionalLight(0xffffff,1.1);this.sun.position.set(-400,700,300);this.scene.add(this.sun);
  this.mat={
   white:new THREE.MeshStandardMaterial({color:0xf2f4f6,roughness:0.55,metalness:0.1}),
   belly:new THREE.MeshStandardMaterial({color:0xb9c0c7,roughness:0.6}),
   dark:new THREE.MeshStandardMaterial({color:0x1b232b,roughness:0.5}),
   eng:new THREE.MeshStandardMaterial({color:0x9aa4ad,roughness:0.35,metalness:0.5}),
   gray:new THREE.MeshStandardMaterial({color:0x6c767f,roughness:0.8}),
   asphalt:new THREE.MeshStandardMaterial({color:0x3a3f45,roughness:0.95}),
   taxi:new THREE.MeshStandardMaterial({color:0x474c52,roughness:0.95}),
   apron:new THREE.MeshStandardMaterial({color:0x7d8388,roughness:0.95}),
   grass:new THREE.MeshStandardMaterial({color:0x5c7b45,roughness:1}),
   yellow:new THREE.MeshBasicMaterial({color:0xe9c23a}),
   whiteB:new THREE.MeshBasicMaterial({color:0xf2f2ee})
  };
  this.buildSky();this.buildWorld();this.buildGateEquip();
  this.paxGeo=new THREE.BufferGeometry();this.paxPos=new Float32Array(600*3);this.paxCol=new Float32Array(600*3);
  this.paxGeo.setAttribute('position',new THREE.BufferAttribute(this.paxPos,3));this.paxGeo.setAttribute('color',new THREE.BufferAttribute(this.paxCol,3));
  this.paxPts=new THREE.Points(this.paxGeo,new THREE.PointsMaterial({size:1.5,vertexColors:true,sizeAttenuation:true}));this.paxPts.frustumCulled=false;this.scene.add(this.paxPts);
  this.selRing=new THREE.Mesh(new THREE.RingGeometry(1,1.12,48),new THREE.MeshBasicMaterial({color:0xffb22e,side:THREE.DoubleSide,transparent:true,opacity:0.9,depthWrite:false}));
  this.selRing.rotation.x=-Math.PI/2;this.selRing.visible=false;this.scene.add(this.selRing);
  this.applyTOD(this.tod);this.ok=true;this.bindInput();this.resize();return true;
 },
 /* ---------- sky ---------- */
 buildSky(){
  this.skyU={top:{value:new THREE.Color(0x5c93d8)},hor:{value:new THREE.Color(0xcde3f3)}};
  const m=new THREE.ShaderMaterial({uniforms:this.skyU,side:THREE.BackSide,depthWrite:false,fog:false,
   vertexShader:'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'uniform vec3 top;uniform vec3 hor;varying vec3 vp;void main(){float h=clamp(vp.y,0.0,1.0);gl_FragColor=vec4(mix(hor,top,pow(h,0.55)),1.0);}'});
  this.sky=new THREE.Mesh(new THREE.SphereGeometry(40000,24,16),m);this.scene.add(this.sky);
  this.clouds=new THREE.Group();
  const cc=document.createElement('canvas');cc.width=cc.height=128;const x=cc.getContext('2d');const g=x.createRadialGradient(64,64,4,64,64,62);g.addColorStop(0,'rgba(255,255,255,0.85)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);
  const ct=new THREE.CanvasTexture(cc);
  for(let i=0;i<46;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:ct,transparent:true,opacity:0.55,depthWrite:false,fog:false}));
   const a=Math.random()*6.28,r=3000+Math.random()*22000;s.position.set(Math.cos(a)*r,1400+Math.random()*900,Math.sin(a)*r);s.scale.set(2200+Math.random()*3000,900+Math.random()*700,1);this.clouds.add(s);}
  this.scene.add(this.clouds);
 },
 applyTOD(mode){
  this.tod=mode;this.TODP={
   day:{top:0x4f86d1,hor:0xcfe3f3,fog:0xc4d8e8,hemi:[0xffffff,0x4f6840,0.95],sun:[0xfff6e3,1.15],lights:0.12,win:0},
   dusk:{top:0x2b3a6e,hor:0xf0a56a,fog:0x7b6f86,hemi:[0xffd7b0,0x3a4430,0.55],sun:[0xff9a55,0.6],lights:0.85,win:0.6},
   night:{top:0x050a18,hor:0x172544,fog:0x0a1226,hemi:[0x6577aa,0x1a2230,0.28],sun:[0x7f90c8,0.12],lights:1,win:1}};const P={
   day:{top:0x4f86d1,hor:0xcfe3f3,fog:0xc4d8e8,hemi:[0xffffff,0x4f6840,0.95],sun:[0xfff6e3,1.15],lights:0.12,win:0},
   dusk:{top:0x2b3a6e,hor:0xf0a56a,fog:0x7b6f86,hemi:[0xffd7b0,0x3a4430,0.55],sun:[0xff9a55,0.6],lights:0.85,win:0.6},
   night:{top:0x050a18,hor:0x172544,fog:0x0a1226,hemi:[0x6577aa,0x1a2230,0.28],sun:[0x7f90c8,0.12],lights:1,win:1}}[mode]||null;
  if(!P)return;this.P=P;
  this.skyU.top.value.setHex(P.top);this.skyU.hor.value.setHex(P.hor);
  this.fogHex=P.fog;this.setFog(!!(window.G&&G.fog));
  this.hemi.color.setHex(P.hemi[0]);this.hemi.groundColor.setHex(P.hemi[1]);this.hemi.intensity=P.hemi[2];
  this.sun.color.setHex(P.sun[0]);this.sun.intensity=P.sun[1];
  if(this.lightMat)this.lightMat.forEach(m=>m.opacity=P.lights);
  if(this.winMat)this.winMat.emissiveIntensity=P.win;
  this.clouds.visible=mode==='day'||mode==='dusk';
  if(this.groundMeshes)this.groundMeshes.forEach(m=>m.material.color.multiplyScalar(1));
 },
 setFog(low){
  if(!this.P)return;this.scene.fog=new THREE.FogExp2(this.fogHex,low?0.0009:(this.tod==='night'?0.00006:0.000045));
  if(!low&&this.tod!=='night'&&0)this.scene.fog.density=0.00004;
 },
 /* ---------- world ---------- */
 box(w,h,d,mat,x,y,z,parent){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);(parent||this.scene).add(m);return m;},
 txtPlane(text,w,h,fg,bg,font){
  const c=document.createElement('canvas');c.width=256;c.height=Math.max(64,Math.round(256*h/w));const x=c.getContext('2d');
  if(bg){x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);}
  x.fillStyle=fg;x.font=font||('bold '+Math.round(c.height*0.8)+'px "Barlow Condensed",Arial Narrow,Arial');x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2+2);
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:!bg,depthWrite:false}));return m;
 },
 buildWorld(){
  const S=this.scene,M=this.mat;this.groundMeshes=[];this.lightMat=[];
  const gr=new THREE.Mesh(new THREE.PlaneGeometry(90000,90000),M.grass);gr.rotation.x=-Math.PI/2;gr.position.y=-0.2;S.add(gr);this.groundMeshes.push(gr);
  // fields for scale
  const fcol=[0x6b8a4d,0x7d9455,0x5a7a45,0x8a9a5a,0x6f8550];
  for(let i=0;i<70;i++){const w=300+Math.random()*1400,d=300+Math.random()*1400,a=Math.random()*6.28,r=2600+Math.random()*16000;
   const px=Math.cos(a)*r,pz=Math.sin(a)*r;if(Math.abs(pz)<260&&Math.abs(px)<4200)continue;
   const f=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({color:fcol[i%5],roughness:1}));f.rotation.x=-Math.PI/2;f.position.set(px,-0.1,pz);S.add(f);}
  for(let i=0;i<14;i++){const a=Math.random()*6.28,r=14000+Math.random()*16000,h=120+Math.random()*380;const hill=new THREE.Mesh(new THREE.ConeGeometry(1800+Math.random()*2200,h,7),new THREE.MeshStandardMaterial({color:0x56704a,roughness:1}));hill.position.set(Math.cos(a)*r,h/2-5,Math.sin(a)*r);S.add(hill);}
  // runway
  const rw=this.box(3000,0.3,45,M.asphalt,0,0.15,0);
  this.box(3000,0.31,1.2,M.whiteB,0,0.17,-22);this.box(3000,0.31,1.2,M.whiteB,0,0.17,22);
  const dash=new THREE.InstancedMesh(new THREE.BoxGeometry(30,0.32,1),M.whiteB,95),dm=new THREE.Matrix4();
  for(let i=0;i<95;i++){dm.makeTranslation(-1410+i*30*1.0*(2820/(94*30)),0.18,0);dash.setMatrixAt(i,dm);}S.add(dash);
  [[-1,0],[1,0]].forEach(([s])=>{ // thresholds
   for(let k=-8;k<=8;k++){if(k===0)continue;this.box(24,0.32,1.5,M.whiteB,s*(1450-6)*-1*-1*1+0,0.18,k*2.4).position.x=s*1438;}
   for(let t=0;t<3;t++)for(const zz of[-6,6])this.box(22,0.32,2.6,M.whiteB,s*(1450-300-t*150),0.18,zz*1.0);
  });
  const n09=this.txtPlane('09',16,30,'#f2f2ee',null);n09.rotation.x=-Math.PI/2;n09.rotateOnWorldAxis(new THREE.Vector3(0,1,0),-Math.PI/2);n09.position.set(-1395,0.25,0);S.add(n09);
  const n27=this.txtPlane('27',16,30,'#f2f2ee',null);n27.rotation.x=-Math.PI/2;n27.rotateOnWorldAxis(new THREE.Vector3(0,1,0),Math.PI/2);n27.position.set(1395,0.25,0);S.add(n27);
  // taxiways
  const tw=new THREE.Group();S.add(tw);
  EDGES.forEach(e=>{
   const A=NODES[e.a],B=NODES[e.b];const len=Math.hypot(A.x-B.x,A.z-B.z);if(len<1)return;
   const wd=e.name==='Apron'||e.name==='Stand'?32:e.name==='Service Rd'?8:23;
   const m=new THREE.Mesh(new THREE.BoxGeometry(len+(e.rwy?0:6),0.28,wd),e.name==='Apron'||e.name==='Stand'?M.apron:M.taxi);
   m.position.set((A.x+B.x)/2,0.12,(A.z+B.z)/2);m.rotation.y=-Math.atan2(B.z-A.z,B.x-A.x);tw.add(m);
   if(e.name!=='Service Rd'&&e.name!=='Stand'){const c=new THREE.Mesh(new THREE.BoxGeometry(len,0.3,0.45),M.yellow);c.position.set((A.x+B.x)/2,0.3,(A.z+B.z)/2);c.rotation.y=m.rotation.y;tw.add(c);}
  });
  for(const k in NODES){const n=NODES[k];if(n.t==='rwy')continue;const c=new THREE.Mesh(new THREE.CylinderGeometry(n.t==='lane'||n.t==='gate'?16:12,16,0.28,16),n.t==='lane'||n.t==='gate'?M.apron:M.taxi);c.position.set(n.x,0.11,n.z);tw.add(c);}
  // hold lines
  ['B','C','D','E'].forEach(k=>{const n=NODES['H'+k];[-1.5,1.5].forEach(o=>this.box(0.5,0.32,22,M.yellow,n.x+o*1.2,0.2,n.z-0));});
  // apron + terminal
  this.box(1020,0.25,150,M.apron,0,0.1,-325);
  for(let i=1;i<=6;i++){const p=this.txtPlane(String(i),8,10,'#f2d24a',null);p.rotation.x=-Math.PI/2;p.position.set(GATE_X[i-1],0.35,-335);S.add(p);this.box(0.5,0.3,50,M.yellow,GATE_X[i-1],0.2,-325);}
  const winTex=this.winTexture();
  this.winMat=new THREE.MeshStandardMaterial({map:winTex,color:0x9fb4c4,emissive:0xffd890,emissiveMap:winTex,emissiveIntensity:0,roughness:0.3,metalness:0.4});
  const term=new THREE.Mesh(new THREE.BoxGeometry(1000,24,46),[M.gray,M.gray,M.gray,M.gray,this.winMat,M.gray]);term.position.set(0,12,-425);S.add(term);
  this.box(1004,1.2,50,M.dark,0,24.4,-425);
  // tower
  const tx=560,tz=-390;
  const tb=new THREE.Mesh(new THREE.CylinderGeometry(4.2,5.5,46,14),new THREE.MeshStandardMaterial({color:0xc9ced2,roughness:0.8}));tb.position.set(tx,23,tz);S.add(tb);
  const cab=new THREE.Mesh(new THREE.CylinderGeometry(9,6.4,7,16),new THREE.MeshStandardMaterial({color:0x6aa5c8,roughness:0.1,metalness:0.6,transparent:true,opacity:0.8}));cab.position.set(tx,50,tz);S.add(cab);
  const roof=new THREE.Mesh(new THREE.CylinderGeometry(9.6,9.6,1.2,16),M.dark);roof.position.set(tx,54.2,tz);S.add(roof);
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,12,6),M.dark);ant.position.set(tx,60,tz);S.add(ant);
  this.towerPos=new THREE.Vector3(tx,50,tz+0);
  // hangars, depot, fuel farm, fire station
  this.box(120,18,70,new THREE.MeshStandardMaterial({color:0x8a949c,roughness:0.7}),-980,9,-330);
  this.box(120,18,70,new THREE.MeshStandardMaterial({color:0x8a949c,roughness:0.7}),-840,9,-330);
  this.box(36,9,22,new THREE.MeshStandardMaterial({color:0xb83a32,roughness:0.7}),-40,4.5,-95);
  this.box(36,9,22,new THREE.MeshStandardMaterial({color:0xd7dbde,roughness:0.7}),44,4.5,-96);
  for(let i=0;i<4;i++){const t=new THREE.Mesh(new THREE.CylinderGeometry(12,12,16,18),new THREE.MeshStandardMaterial({color:0xe8eaec,roughness:0.5}));t.position.set(1000+i*30,8,-310);S.add(t);}
  // car park + road
  this.box(300,0.2,50,M.taxi,0,0.1,-490);this.box(2400,0.2,12,M.taxi,0,0.1,-545);
  // approach lights + PAPI + edge lights as glowing points
  const pts=[],cols=[];const add=(x,y,z,c)=>{pts.push(x,y,z);cols.push((c>>16&255)/255,(c>>8&255)/255,(c&255)/255);};
  for(let x=-1500;x<=1500;x+=60){add(x,0.6,-24.5,0xfff2d0);add(x,0.6,24.5,0xfff2d0);}
  for(let x=-1480;x<=1480;x+=15){add(x,0.4,0,0xfff6e0);}
  [-1,1].forEach(s=>{for(let k=-6;k<=6;k++){add(s*1452,0.6,k*3.2,0x30ff60);add(s*-1500,0.6,k*3.2,0xff3030);}
   for(let d=60;d<=900;d+=30){add(s*(1450+d),1.5,0,0xfff2d0);if(d%150===0)for(let k=-4;k<=4;k++)add(s*(1450+d),1.5,k*3.2,0xfff2d0);}});
  EDGES.forEach(e=>{if(e.rwy||e.name==='Service Rd'||e.name==='Stand')return;const A=NODES[e.a],B=NODES[e.b],len=Math.hypot(A.x-B.x,A.z-B.z),n=Math.floor(len/30);
   const w=e.name==='Apron'?18:13;for(let i=0;i<=n;i++){const t=i/Math.max(1,n);const x=A.x+(B.x-A.x)*t,z=A.z+(B.z-A.z)*t;const nx=-(B.z-A.z)/len,nz=(B.x-A.x)/len;add(x+nx*w,0.5,z+nz*w,0x3a7bff);add(x-nx*w,0.5,z-nz*w,0x3a7bff);}});
  for(let i=1;i<=6;i++)for(const dx of[-20,20])add(GATE_X[i-1]+dx,18,-398,0xffe9b0);
  const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));lg.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  const lm=new THREE.PointsMaterial({size:3.2,vertexColors:true,sizeAttenuation:true,transparent:true,opacity:0.2,depthWrite:false});this.lightMat.push(lm);
  const lp=new THREE.Points(lg,lm);lp.frustumCulled=false;S.add(lp);
  // PAPI
  [-1,1].forEach(s=>{for(let k=0;k<4;k++){const pm=new THREE.Mesh(new THREE.BoxGeometry(2,1.2,2),new THREE.MeshBasicMaterial({color:k<2?0xffffff:0xff3030}));pm.position.set(s*1180,0.8,s*-1*0+ -34-k*9*1);pm.position.z=-(34+k*9);S.add(pm);}});
  // lamp posts on apron
  for(let i=0;i<8;i++){const x=-420+i*120;this.box(0.8,22,0.8,M.dark,x,11,-262);}
 },
 winTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=64;const x=c.getContext('2d');x.fillStyle='#223038';x.fillRect(0,0,512,64);
  for(let i=0;i<64;i++){x.fillStyle=Math.random()<0.8?'#ffe2a0':'#26343c';x.fillRect(i*8+1,10,6,24);x.fillRect(i*8+1,40,6,16);}
  const t=new THREE.CanvasTexture(c);t.wrapS=THREE.RepeatWrapping;t.repeat.set(3,1);return t;
 },
 /* ---------- gate equipment ---------- */
 buildGateEquip(){
  const M=this.mat;
  for(let i=0;i<6;i++){
   const gx=GATE_X[i];
   const g=new THREE.Group();g.position.set(gx-9,0,-400);this.scene.add(g);
   const rot=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.4,5.5,12),new THREE.MeshStandardMaterial({color:0xbfc7cd,roughness:0.5}));rot.position.y=5.5;g.add(rot);
   const tun=new THREE.Mesh(new THREE.BoxGeometry(1,3.2,3),new THREE.MeshStandardMaterial({color:0xd5dade,roughness:0.5}));tun.geometry.translate(0.5,0,0);tun.position.y=4.8;g.add(tun);
   const cab=new THREE.Mesh(new THREE.BoxGeometry(3.4,3.4,3.4),new THREE.MeshStandardMaterial({color:0x8e979e,roughness:0.6}));cab.position.y=4.8;g.add(cab);
   g.visible=true;this.bridges.push({g,tun,cab,ext:0,tgt:0,door:null,gx});
   // ground equipment
   const fuel=new THREE.Group();const fb=new THREE.Mesh(new THREE.BoxGeometry(6,2.2,2.6),new THREE.MeshStandardMaterial({color:0xe9eaec}));fb.position.y=1.9;fuel.add(fb);
   const ft=new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,7,12),new THREE.MeshStandardMaterial({color:0xd8641c}));ft.rotation.z=Math.PI/2;ft.position.set(-2,3.2,0);fuel.add(ft);
   fuel.position.set(gx+22,0,-330);fuel.visible=false;this.scene.add(fuel);this.bridges[i].fuel=fuel;
   const bag=new THREE.Group();const bt=new THREE.Mesh(new THREE.BoxGeometry(3,1.6,1.8),new THREE.MeshStandardMaterial({color:0x2d6a9f}));bt.position.y=1.2;bag.add(bt);
   for(let k=0;k<2;k++){const cb=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.2,2.2),new THREE.MeshStandardMaterial({color:0x777f86}));cb.position.set(-3.4-k*4,0.9,0);bag.add(cb);}
   bag.visible=false;this.scene.add(bag);this.bridges[i].bag=bag;
  }
  this.tug=new THREE.Group();const tb=new THREE.Mesh(new THREE.BoxGeometry(8,2,3.4),new THREE.MeshStandardMaterial({color:0x2e3338}));tb.position.y=1.4;this.tug.add(tb);
  const tl=new THREE.Mesh(new THREE.BoxGeometry(1,0.5,3.4),new THREE.MeshBasicMaterial({color:0xf5c518}));tl.position.set(3.8,2.5,0);this.tug.add(tl);this.tug.visible=false;this.scene.add(this.tug);
 },
 /* ---------- aircraft models ---------- */
 buildAC(a){
  const ty=a.type,L=ty.len,W=ty.wing,rf=ty.rf,M=this.mat;
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const tailM=new THREE.MeshStandardMaterial({color:a.al.tail,roughness:0.5}),accM=new THREE.MeshStandardMaterial({color:a.al.acc,roughness:0.5});
  const fus=new THREE.Mesh(new THREE.CylinderGeometry(rf,rf,L*0.8,16),M.white);fus.rotation.z=Math.PI/2;fus.position.x=-L*0.02;body.add(fus);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(rf,16,12),M.white);nose.scale.set(1.9,1,1);nose.position.x=L*0.38;body.add(nose);
  const tail=new THREE.Mesh(new THREE.CylinderGeometry(rf*0.2,rf,L*0.26,16),M.white);tail.rotation.z=Math.PI/2;tail.position.x=-L*0.55;tail.position.y=rf*0.25;body.add(tail);
  for(const s of[-1,1]){
   this.box(L*0.52,rf*0.16,0.06,M.dark,L*0.05,rf*0.3,s*rf*0.99,body);
   this.box(L*0.62,rf*0.12,0.08,accM,-L*0.02,-rf*0.05,s*rf*0.995,body);
   const wing=new THREE.Mesh(new THREE.BoxGeometry(L*0.16,0.5,W*0.5),M.white);wing.position.set(-L*0.04-W*0.12,-rf*0.55,s*(W*0.25+rf*0.4));wing.rotation.y=-s*0.5;body.add(wing);
   const wl=new THREE.Mesh(new THREE.BoxGeometry(L*0.05,rf*0.9,0.3),accM);wl.position.set(-L*0.04-W*0.25,-rf*0.1,s*(W*0.5+rf*0.2));body.add(wl);
   const hs=new THREE.Mesh(new THREE.BoxGeometry(L*0.1,0.3,W*0.34),M.white);hs.position.set(-L*0.5-W*0.04,rf*0.45,s*(W*0.085+rf*0.2));hs.rotation.y=-s*0.5;body.add(hs);
   const ex=ty.prop?W*0.18:W*0.2;
   if(!a.type.prop){const en=new THREE.Mesh(new THREE.CylinderGeometry(rf*0.5,rf*0.45,L*0.12,12),M.eng);en.rotation.z=Math.PI/2;en.position.set(L*0.06-W*0.11,-rf*0.95,s*ex);body.add(en);
    const fan=new THREE.Mesh(new THREE.CircleGeometry(rf*0.46,12),M.dark);fan.rotation.y=Math.PI/2;fan.position.set(L*0.06-W*0.11+L*0.061,-rf*0.95,s*ex);body.add(fan);}
   else{const en=new THREE.Mesh(new THREE.CylinderGeometry(rf*0.4,rf*0.4,L*0.16,10),M.eng);en.rotation.z=Math.PI/2;en.position.set(L*0.02-W*0.08,rf*-0.2,s*ex);body.add(en);
    const pr=new THREE.Group();const b1=new THREE.Mesh(new THREE.BoxGeometry(0.15,rf*2.6,0.4),M.dark);const b2=new THREE.Mesh(new THREE.BoxGeometry(0.15,0.4,rf*2.6),M.dark);pr.add(b1);pr.add(b2);pr.position.set(L*0.02-W*0.08+L*0.085,rf*-0.2,s*ex);body.add(pr);(root.userData.props=root.userData.props||[]).push(pr);}
  }
  const fin=new THREE.Mesh(new THREE.BoxGeometry(L*0.13,rf*2.4,0.45),tailM);fin.position.set(-L*0.49,rf*1.7,0);fin.rotation.z=0.28;body.add(fin);
  if(ty.rear){const hs=new THREE.Mesh(new THREE.BoxGeometry(L*0.1,0.25,W*0.4),M.white);hs.position.set(-L*0.52,rf*3.2,0);body.add(hs);}
  const gear=new THREE.Group();
  const ng=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,rf*1.3,6),M.dark);ng.position.set(L*0.3,-rf*1.1,0);gear.add(ng);
  const nw=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.5,10),M.dark);nw.rotation.x=Math.PI/2;nw.position.set(L*0.3,-rf*1.7,0);gear.add(nw);
  for(const s of[-1,1]){const mg=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,rf*1.4,6),M.dark);mg.position.set(-L*0.06,-rf*1.1,s*rf*0.9);gear.add(mg);
   const mw=new THREE.Mesh(new THREE.CylinderGeometry(0.8,0.8,1.4,10),M.dark);mw.rotation.x=Math.PI/2;mw.position.set(-L*0.06,-rf*1.75,s*rf*0.9);gear.add(mw);}
  body.add(gear);root.userData.gear=gear;
  const mkL=(c,x,y,z,r)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(r||0.45,6,5),new THREE.MeshBasicMaterial({color:c}));m.position.set(x,y,z);body.add(m);return m;};
  const tipX=-L*0.04-W*0.25;
  mkL(0xff2020,tipX,-rf*0.1,-(W*0.5+rf*0.2));mkL(0x20ff40,tipX,-rf*0.1,(W*0.5+rf*0.2));
  root.userData.strobes=[mkL(0xffffff,tipX-0.5,-rf*0.1,-(W*0.5+rf*0.2),0.6),mkL(0xffffff,tipX-0.5,-rf*0.1,(W*0.5+rf*0.2),0.6),mkL(0xffffff,-L*0.64,rf*0.4,0,0.5)];
  root.userData.beacon=mkL(0xff1010,0,rf*1.02,0,0.7);
  root.userData.land=mkL(0xfffbe0,L*0.3,-rf*0.9,0,0.8);
  // blob shadow
  const sh=new THREE.Mesh(new THREE.CircleGeometry(1,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.32,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.scale.set(L*0.5,W*0.45,1);sh.position.y=0.4;root.userData.shadow=sh;
  const holder=new THREE.Group();holder.add(root);this.scene.add(holder);this.scene.add(sh);
  return {holder,root,body,sh,a};
 },
 buildVeh(v){
  const g=new THREE.Group();
  if(v.vt==='ops'){
   const b=new THREE.Mesh(new THREE.BoxGeometry(4.6,1.6,2.1),new THREE.MeshStandardMaterial({color:0xf2d21c,roughness:0.5}));b.position.y=1.1;g.add(b);
   const c=new THREE.Mesh(new THREE.BoxGeometry(2,1,1.9),new THREE.MeshStandardMaterial({color:0xf5f5f0}));c.position.set(-0.4,2.1,0);g.add(c);
   const l=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.35,1.2),new THREE.MeshBasicMaterial({color:0xff8a00}));l.position.set(-0.4,2.8,0);g.add(l);g.userData.beacon=l;
  }else{
   const b=new THREE.Mesh(new THREE.BoxGeometry(8.6,2.6,2.9),new THREE.MeshStandardMaterial({color:0xc3262b,roughness:0.5}));b.position.y=1.8;g.add(b);
   const c=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.6,2.8),new THREE.MeshStandardMaterial({color:0xd0302f}));c.position.set(3.2,3.6,0);g.add(c);
   const t=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,5,8),new THREE.MeshStandardMaterial({color:0xeeeeee}));t.rotation.z=Math.PI/2;t.position.set(-1,3.6,0);g.add(t);
   const l=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.4,2),new THREE.MeshBasicMaterial({color:0x3a8dff}));l.position.set(3.2,4.6,0);g.add(l);g.userData.beacon=l;
  }
  this.scene.add(g);return {holder:g,veh:true,v};
 },
 /* ground dynamics: spring-damped nose dip / squat on accel+braking, lean in turns, touchdown bounce, rolling vibration */
 dyn(m,e,dt,t){
  const d=m.dy||(m.dy={x:0,w:0,r:0,pv:e.v||0,pth:e.th,ac:0,yr:0});
  if(!(dt>0)||dt>0.25){d.pv=e.v||0;d.pth=e.th;return{p:d.x,r:d.r,y:0};}
  const gnd=e.veh||e.y<1.5;
  let ac=((e.v||0)-d.pv)/dt;d.pv=e.v||0;ac=clamp(ac,-6,4);d.ac+=(ac-d.ac)*Math.min(1,dt*6);
  let yr=angDiff(e.th,d.pth)/dt;d.pth=e.th;yr=clamp(yr,-1.2,1.2);d.yr+=(yr-d.yr)*Math.min(1,dt*5);
  const sc=e.veh?1:Math.min(1,(e.type&&e.type.len||40)/40);
  const T=gnd?clamp(-d.ac*0.0055,-0.032,0.02)*sc:0;
  d.w+=(60*(T-d.x)-6*d.w)*dt;d.x+=d.w*dt;
  const sp=Math.min(1,(e.v||0)/9);
  const R=gnd?clamp(-d.yr*(e.v||0)*0.0042,-0.07,0.07):0;
  d.r+=(R-d.r)*Math.min(1,dt*4);
  let y=0,vib=gnd?sp*(e.veh?0.004:0.0014)*Math.sin(t*(e.veh?29:19)+e.id*1.7):0;
  let p=d.x+vib+(gnd?sp*0.0012*Math.sin(t*3.1+e.id):0);
  if(!e.veh&&e.tdT!=null&&gnd){const k=G.t-e.tdT;if(k>=0&&k<4){const A=0.35+0.65*(e.tdHard||0),f=Math.exp(-2.6*k);p+=0.03*A*f*Math.sin(9*k);y=0.22*A*f*Math.abs(Math.sin(5.5*k));}}
  let wr=0;if(e.wakeT>0){const k=Math.min(1,e.wakeT/3);wr=Math.sin(t*7.3+e.id)*0.20*k+Math.sin(t*13)*0.05*k;p+=Math.sin(t*5.1)*0.03*k;}
  if(e.cellWx||G.cell&&G.cell.over&&e.y>3){wr+=Math.sin(t*3.1+e.id)*0.04+Math.sin(t*8.7)*0.02;}
  // airborne: natural flight motion — turbulence-driven pitch / roll / heading wander, heave, and banking into turns
  let yaw=0;
  if(!gnd){
   const len=(e.type&&e.type.len)||40,f=clamp(1.55-len/85,0.4,1.7);
   const w=G.wind?G.wind.spd:8,lowK=clamp(1.3-e.y/700,0.35,1.3);
   const k=f*lowK*(0.45+w/22+(G.cellGust||0)/12+(G.wx==='storm'?0.9:G.wx==='rain'?0.35:0)+(e.cellWx?0.5:0)+(e.phase==='GOAROUND'?0.15:0));
   const ph=e.id*2.399,s1=Math.sin(t*0.61+ph),s2=Math.sin(t*1.37+ph*1.7),s3=Math.sin(t*2.9+ph*0.6),s4=Math.sin(t*0.37+ph*2.2);
   p+=k*(0.0065*s1+0.0035*s3);
   wr+=k*(0.015*s2+0.01*s4+0.004*s3);
   yaw=k*(0.004*Math.sin(t*0.83+ph)+0.0025*Math.sin(t*1.9+ph*0.4));
   y+=k*(0.35*s1+0.2*s2);
   if(!(Math.abs(e.bank||0)>0.01)){const Rb=clamp(d.yr*(e.v||0)/9.81,-0.5,0.5);d.rb=(d.rb||0)+(Rb-(d.rb||0))*Math.min(1,dt*2.2);wr+=d.rb;}
   if(e.phase==='APPROACH'&&e.D>0&&e.D<7000)p+=0.006*Math.sin(t*0.9+ph)*clamp(e.D/3000,0.3,1);
  }
  return{p,r:d.r+(gnd?vib*0.7:0)+wr,y,yaw};
 },
 /* ---------- per-frame ---------- */
 sync(dt,t){
  if(!this.ok)return;
  const seen=new Set();
  for(const e of G.ents){
   seen.add(e.id);if(e.fxWreck)continue;let m=this.meshes.get(e.id);
   if(!m){m=e.veh?this.buildVeh(e):this.buildAC(e);this.meshes.set(e.id,m);}
   const h=m.holder;h.position.set(e.x,e.y,e.z);
   const dy=this.dyn(m,e,dt,t);
   if(e.veh){h.rotation.order='YXZ';h.rotation.y=-e.th;h.rotation.z=dy.p*1.8;h.rotation.x=dy.r*1.6;h.position.y=e.y+dy.y*0.5;if(h.userData.beacon)h.userData.beacon.visible=Math.sin(t*14)>0;continue;}
   h.position.y=e.y+dy.y;
   m.root.rotation.y=-e.th-(dy.yaw||0);m.body.rotation.z=(e.pitch||0)+dy.p;m.body.rotation.x=(e.bank||0)+dy.r;
   m.root.userData.gear.visible=e.y<14&&!(e.phase==='CLIMB'&&e.y>6);
   const ud=m.root.userData;
   ud.strobes.forEach((s,i)=>s.visible=((t*1.6+i*0.37)%1.4)<0.09);
   ud.beacon.visible=(t%1.2)<0.15&&!['BOARDING','PARKED'].includes(e.phase);
   ud.land.visible=e.y>3&&e.y<900||['ROLL','ROLLOUT'].includes(e.phase);
   if(ud.props&&!['BOARDING','AT_GATE','PARKED','PUSHBACK'].includes(e.phase))ud.props.forEach(p=>p.rotation.x+=dt*40);
   m.sh.position.set(e.x,0.45,e.z);m.sh.rotation.z=e.th;m.sh.material.opacity=Math.max(0,0.16-e.y/300);
   const sc=1+Math.min(1.5,e.y/140);m.sh.scale.set(e.type.len*0.36*sc,e.type.wing*0.3*sc,1);
   if(e.crashed){m.root.rotation.z=0.25;m.root.rotation.x=0.4;}
  }
  for(const [id,m] of this.meshes)if(!seen.has(id)){this.scene.remove(m.holder);if(m.sh)this.scene.remove(m.sh);this.meshes.delete(id);const l=this.labels.get(id);if(l){l.remove();this.labels.delete(id);}}
  this.gateSync(dt,t);this.fxSync(dt,t);
  // selection ring
  const se=G.ents.find(e=>e.id===this.sel);
  if(se&&!se.dead){this.selRing.visible=true;const r=Math.max(14,(se.type.wing||8)*0.7)*(1+0.05*Math.sin(t*5));this.selRing.scale.set(r,r,1);this.selRing.position.set(se.x,Math.max(0.5,Math.min(se.y,0)+0.6),se.z);if(se.y>2)this.selRing.position.y=0.6;}else this.selRing.visible=false;
  if(this.preRender)this.preRender(dt,t);
  this.updateCam(dt);this.renderer.render(this.scene,this.camera);this.updateLabels();
 },
 gateSync(dt,t){
  let pi=0;
  for(let i=0;i<6;i++){
   const B=this.bridges[i];const gid=G.gates[i+1];const a=gid?G.ents.find(e=>e.id===gid&&!e.dead):null;
   const docked=a&&['BOARDING','AT_GATE','PARKED'].includes(a.phase)&&!a.veh;
   B.tgt=docked?1:0;B.ext+=(B.tgt-B.ext)*Math.min(1,dt*0.7);
   const gx=B.gx-9;
   let door={x:GATE_X[i]-3.4,z:-350-(a?a.type.len/2-9:15)};
   const dx=door.x-gx,dz=door.z+400,len=Math.hypot(dx,dz)*Math.max(0.05,B.ext);
   B.tun.scale.x=len;B.tun.rotation.y=-Math.atan2(dz,dx);B.cab.position.set(Math.cos(B.tun.rotation.y)*len,4.8,-Math.sin(B.tun.rotation.y)*len);B.cab.rotation.y=B.tun.rotation.y;B.door=door;
   const boarding=a&&a.phase==='BOARDING'&&a.board>0.04&&a.board<0.98;
   const deplane=a&&a.phase==='PARKED'&&a.parkT>3&&a.parkT<28;
   B.fuel.visible=!!(a&&(a.phase==='BOARDING'||a.phase==='AT_GATE')&&a.board<1);
   if(B.fuel.visible){B.fuel.position.x=GATE_X[i]+(a.type.wide?30:24);B.fuel.position.z=-338;B.fuel.rotation.y=Math.PI/2;}
   B.bag.visible=boarding||deplane;
   if(B.bag.visible){const ph=(t*0.12+i*0.31)%1,k=ph<0.5?ph*2:2-ph*2;B.bag.position.set(GATE_X[i]+10,0,-383+k*38);B.bag.rotation.y=ph<0.5?Math.PI/2:-Math.PI/2;}
   B.emit=(B.emit||0)-dt;
   if((boarding||deplane)&&B.emit<=0&&this.pax.length<190){B.emit=0.45;this.pax.push({i,t:0,dir:boarding?1:-1,c:[Math.random()*0.6+0.3,Math.random()*0.6+0.3,Math.random()*0.6+0.3]});}
  }
  for(let k=this.pax.length-1;k>=0;k--){
   const p=this.pax[k];p.t+=dt/7;if(p.t>=1){this.pax.splice(k,1);continue;}
   const B=this.bridges[p.i];const gx=B.gx-9,door=B.door||{x:GATE_X[p.i]-3,z:-360};
   const f=p.dir>0?p.t:1-p.t;const x=gx+(door.x-gx)*f*B.ext,z=-400+(door.z+400)*f*B.ext;
   this.paxPos[pi*3]=x;this.paxPos[pi*3+1]=3.9;this.paxPos[pi*3+2]=z+Math.sin(p.t*30+k)*0.4;this.paxCol[pi*3]=p.c[0];this.paxCol[pi*3+1]=p.c[1];this.paxCol[pi*3+2]=p.c[2];pi++;if(pi>=600)break;
  }
  this.paxGeo.setDrawRange(0,pi);this.paxGeo.attributes.position.needsUpdate=true;this.paxGeo.attributes.color.needsUpdate=true;
  // tug
  const tp=G.ents.find(e=>!e.dead&&!e.veh&&(e.phase==='PUSHBACK'||e.phase==='PUSH_TURN'));
  if(tp){this.tug.visible=true;const nx=tp.x+Math.cos(tp.th)*(tp.type.len/2+4),nz=tp.z+Math.sin(tp.th)*(tp.type.len/2+4);this.tug.position.set(nx,0,nz);this.tug.rotation.y=-tp.th;}else this.tug.visible=false;
 },
 fxSync(dt,t){
  for(let i=this.fx.length-1;i>=0;i--){const f=this.fx[i];f.age+=dt;
   f.g.children.forEach((c,k)=>{if(c.userData.smoke){c.position.y+=dt*(8+k);c.scale.multiplyScalar(1+dt*0.35);c.material.opacity=Math.max(0,0.5-f.age*0.02);}else{const s=(1+Math.sin(t*20+k*2)*0.18)*(f.age<2?1+f.age*1.2:3.4);c.scale.setScalar(s*c.userData.r);}});
   if(f.ttl&&f.age>f.ttl){this.scene.remove(f.g);this.fx.splice(i,1);}}
  for(let i=this.beams.length-1;i>=0;i--){const b=this.beams[i];b.age+=dt;const a=b.a;if(a.dead||b.age>5){this.scene.remove(b.m);this.beams.splice(i,1);continue;}
   const p=this.towerPos,q=new THREE.Vector3(a.x,a.y+4,a.z);const d=q.clone().sub(p),len=d.length();b.m.position.copy(p).add(q).multiplyScalar(0.5);b.m.scale.set(1,len,1);b.m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
   b.m.material.opacity=b.flash?(Math.sin(t*14)>0?0.8:0.1):0.75;}
 },
 boom(x,y,z,ttl){
  const g=new THREE.Group();
  for(let i=0;i<5;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(1,10,8),new THREE.MeshBasicMaterial({color:i<2?0xffd23a:i<4?0xff6a1a:0xff3a10,transparent:true,opacity:0.9}));s.position.set((Math.random()-0.5)*18,2+Math.random()*5,(Math.random()-0.5)*18);s.userData.r=6+Math.random()*7;g.add(s);}
  for(let i=0;i<9;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:0x222222,transparent:true,opacity:0.5,depthWrite:false}));s.position.set((Math.random()-0.5)*20,8+Math.random()*10,(Math.random()-0.5)*20);s.scale.setScalar(8+Math.random()*8);s.userData.smoke=true;g.add(s);}
  g.position.set(x,y,z);this.scene.add(g);this.fx.push({g,age:0,ttl:ttl||0});
 },
 beam(a,color,flash){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,1,6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.8,depthWrite:false}));this.scene.add(m);this.beams.push({m,a,age:0,flash});
 },
 clear(){
  for(const [id,m] of this.meshes){this.scene.remove(m.holder);if(m.sh)this.scene.remove(m.sh);}this.meshes.clear();
  this.labels.forEach(l=>l.remove());this.labels.clear();this.fx.forEach(f=>this.scene.remove(f.g));this.fx=[];this.beams.forEach(b=>this.scene.remove(b.m));this.beams=[];this.pax=[];
 },
 /* ---------- camera ---------- */
 setMode(m){
  const c=this.cam;c.mode=m;
  if(m==='tower'){c.yaw=-0.98;c.pitch=-0.07;c.fov=52;c.pos.set(560,54,-372);}
  else if(m==='apron'){c.orbYaw=0.2;c.orbPitch=0.32;c.dist=300;c.target.set(0,8,-335);}
  else if(m==='rwy09'){c.pos.set(-(AP.half-60),9,0);c.yaw=-Math.PI/2;c.pitch=0.0;c.fov=44;}
  else if(m==='rwy27'){c.pos.set(AP.half-60,9,0);c.yaw=Math.PI/2;c.pitch=0.0;c.fov=44;}
  else if(m==='mid'){c.pos.set(300,10,-76);c.yaw=Math.PI/2;c.pitch=-0.01;c.fov=62;}
  else if(m==='follow'){c.orbYaw=0.5;c.orbPitch=0.28;c.dist=150;}
 },
 updateCam(dt){
  const c=this.cam,cam=this.camera;
  if(c.mode==='follow'){
   const a=G.ents.find(e=>e.id===this.sel&&!e.dead)||G.ents.find(e=>!e.dead&&!e.veh);
   if(a){const tx=a.x,ty=a.y+4,tz=a.z;c.target.x+=(tx-c.target.x)*Math.min(1,dt*6);c.target.y+=(ty-c.target.y)*Math.min(1,dt*6);c.target.z+=(tz-c.target.z)*Math.min(1,dt*6);if(!c.spin)c.dist=clamp(c.dist,50,600);}
  }
  if(c.mode==='tower'||c.mode==='rwy09'||c.mode==='rwy27'||c.mode==='mid'){
   cam.position.copy(c.pos);cam.fov=c.fov;
   const cp=Math.cos(c.pitch);const d=new THREE.Vector3(Math.sin(c.yaw)*cp,Math.sin(c.pitch),Math.cos(c.yaw)*cp);
   cam.lookAt(c.pos.clone().add(d));
  }else{
   const cp=Math.cos(c.orbPitch);const off=new THREE.Vector3(Math.sin(c.orbYaw)*cp,Math.sin(c.orbPitch),Math.cos(c.orbYaw)*cp).multiplyScalar(c.dist);
   cam.position.copy(c.target).add(off);cam.position.y=Math.max(2,cam.position.y);cam.lookAt(c.target);cam.fov=55;
  }
  cam.updateProjectionMatrix();this.sky.position.copy(cam.position);
 },
 bindInput(){
  const cv=this.canvas,c=this.cam;let drag=null,pin=null;
  const fp=()=>['tower','rwy09','rwy27','mid'].includes(c.mode);
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,moved:0};});
  cv.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;drag.moved+=Math.abs(dx)+Math.abs(dy);
   if(fp()){c.yaw-=dx*0.0035*(c.fov/52);c.pitch=clamp(c.pitch-dy*0.0035*(c.fov/52),-1.2,0.8);}else{c.orbYaw-=dx*0.006;c.orbPitch=clamp(c.orbPitch+dy*0.006,0.02,1.45);}});
  cv.addEventListener('pointerup',e=>{if(drag&&drag.moved<5&&this.onPick)this.onPick(this.pick(e.clientX,e.clientY));drag=null;});
  cv.addEventListener('wheel',e=>{e.preventDefault();if(fp())c.fov=clamp(c.fov*(1+e.deltaY*0.001),12,85);else c.dist=clamp(c.dist*(1+e.deltaY*0.0012),40,3500);},{passive:false});
 },
 resize(){
  if(!this.renderer)return;const r=this.canvas.parentElement.getBoundingClientRect();const w=Math.max(10,r.width),h=Math.max(10,r.height);
  this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.w=w;this.h=h;
 },
 project(x,y,z){const v=new THREE.Vector3(x,y,z).project(this.camera);if(v.z>1||v.z<-1)return null;return{x:(v.x*0.5+0.5)*this.w,y:(-v.y*0.5+0.5)*this.h};},
 pick(cx,cy){
  const r=this.canvas.getBoundingClientRect();const px=cx-r.left,py=cy-r.top;let best=null,bd=1e9;
  for(const e of G.ents){if(e.dead)continue;const p=this.project(e.x,e.y+3,e.z);if(!p)continue;const d=Math.hypot(p.x-px,p.y-py);const lim=e.veh?20:Math.max(26,e.type.wing*220/Math.max(60,this.camera.position.distanceTo(new THREE.Vector3(e.x,e.y,e.z))));if(d<lim&&d<bd){bd=d;best=e;}}
  return best;
 },
 updateLabels(){
  const box=this.labelBox;
  for(const e of G.ents){
   if(e.dead)continue;let l=this.labels.get(e.id);
   if(!l){l=document.createElement('div');l.className='l3';l.addEventListener('click',()=>{if(this.onPick)this.onPick(e);});box.appendChild(l);this.labels.set(e.id,l);}
   const p=this.project(e.x,e.y+(e.veh?7:Math.max(9,e.type.len*0.28)),e.z);
   const dist=this.camera.position.distanceTo(new THREE.Vector3(e.x,e.y,e.z));
   if(!p||dist>(e.y>5?14000:2600)||p.x<-40||p.x>this.w+40||p.y<-20||p.y>this.h+20){l.style.display='none';continue;}
   l.style.display='';l.style.transform='translate('+Math.round(p.x)+'px,'+Math.round(p.y)+'px) translate(-50%,-100%)';
   const q=!e.veh&&e.req;const sel=e.id===this.sel;
   const cls='l3'+(sel?' sel':'')+(q?' req':'')+(e.nordo||e.squawk==='7700'||e.emerg?' emg':'')+(e.veh?' veh':'')+(e.kind==='arr'?' arr':'');
   if(l.className!==cls)l.className=cls;
   const html=e.veh?e.cs:(e.cs+(dist<1500||sel?'<i>'+(e.squawk||'')+'</i>':''));if(l._h!==html){l.innerHTML=html;l._h=html;}
  }
 }
};
