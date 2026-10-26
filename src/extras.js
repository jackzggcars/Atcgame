'use strict';
/* =====================================================================
   EXTRAS — weather (rain, overcast, thunderstorms with lightning + thunder, wet surfaces),
   apron service vehicles (fuel bowser, baggage tractor + carts) that arrive for each parked aircraft.
   ===================================================================== */
const lin=h=>new THREE.Color(h).convertSRGBToLinear();
const WX_NAMES={clear:'CLEAR',overcast:'OVERCAST',rain:'RAIN',storm:'THUNDERSTORM'};
const WX={
 kind:'clear',t:0,flash:0,nextFlash:8,thunderAt:-1,
 apply(kind){
  this.kind=kind||'clear';if(!R3.ok||!R3.P)return;
  const k=this.kind,grey=k==='overcast'?0.55:k==='rain'?0.78:k==='storm'?0.92:0;
  const P=R3.P;
  // sky + fog towards grey
  const g=lin(R3.tod==='night'?0x0d1119:R3.tod==='dusk'?0x6b6670:0x7d8790);
  const fog=lin(P.fog).lerp(g,grey),dens=(R3.tod==='night'?0.00005:0.000058)*(1+grey*(k==='storm'?9:k==='rain'?5.5:1.5));
  R3.scene.fog=new THREE.FogExp2(fog,G.fog?0.0011:dens);R3.skyU.ground.value.copy(fog);R3.skyU.hor.value.copy(lin(P.hor).lerp(g,grey));R3.skyU.top.value.copy(lin(P.top).lerp(g.clone().multiplyScalar(0.8),grey*0.9));
  R3.sun.intensity=P.si*(1-grey*0.8);R3.hemi.intensity=P.hemi[2]*(1+grey*0.35);R3.renderer.toneMappingExposure=P.exp*(1-grey*0.06);
  R3.cloudMats.forEach(m=>{m.color.copy(lin(P.cloud)).lerp(lin(0x59616b),grey);m.opacity=Math.min(1,P.co*(1+grey*0.5));});R3.clouds.visible=P.co>0;
  // wet surfaces
  const wet=(k==='rain'||k==='storm');
  [R3.mat.taxi,R3.mat.apron,R3.rwMat].forEach(m=>{if(!m)return;if(m.userData.r0===undefined){m.userData.r0=m.roughness;m.userData.e0=m.envMapIntensity;}
   m.roughness=wet?0.34:m.userData.r0;m.envMapIntensity=wet?m.userData.e0*3.4:m.userData.e0;m.needsUpdate=true;});
  if(R3.lightMat)R3.lightMat.forEach(m=>m.opacity=Math.min(1,P.lights*(1+(wet?0.35:0))));
  this.ensureRain();this.rain.visible=wet;this.rainN=k==='storm'?1:0.6;
 },
 ensureRain(){
  if(this.rain)return;const N=5200,pos=new Float32Array(N*6);
  for(let i=0;i<N;i++){const x=(Math.random()-0.5)*220,y=Math.random()*90,z=(Math.random()-0.5)*220;pos.set([x,y,z,x,y-1.6,z],i*6);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  this.rain=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xb7c4d4,transparent:true,opacity:0.32,depthWrite:false,fog:false}));
  this.rain.frustumCulled=false;this.rain.visible=false;R3.scene.add(this.rain);
 },
 ensureCell(){
  if(this.cellG)return;const g=new THREE.Group(),m=new THREE.MeshLambertMaterial({color:0x4b5159,transparent:true,opacity:0.96,fog:true,emissive:0x000000});
  const add=(r,x,y,z,sy)=>{const s=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);s.position.set(x,y,z);s.scale.set(1,sy||0.8,1);g.add(s);};
  for(let i=0;i<30;i++){const a=Math.random()*6.283,rr=Math.sqrt(Math.random())*1050,h=300+Math.random()*3600*(1-rr/1500);add(520+Math.random()*420-h*0.03,Math.cos(a)*rr,h,Math.sin(a)*rr,0.9);}
  const an=new THREE.Mesh(new THREE.CylinderGeometry(2300,1100,500,28),m);an.position.y=4300;g.add(an);
  const dm=new THREE.MeshBasicMaterial({color:0x2d3239,transparent:true,opacity:0.8,fog:true});const base=new THREE.Mesh(new THREE.CylinderGeometry(1500,1250,380,28,1,true),dm);base.position.y=420;base.material.side=THREE.DoubleSide;g.add(base);
  const rm=new THREE.MeshBasicMaterial({color:0x8d99a9,transparent:true,opacity:0.2,side:THREE.DoubleSide,depthWrite:false,fog:true});
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(1250,1450,640,28,1,true),rm);shaft.position.y=320;g.add(shaft);
  g.userData={mat:m};g.visible=false;R3.scene.add(g);this.cellG=g;
  const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(14*3),3));
  this.bolt=new THREE.Line(bg,new THREE.LineBasicMaterial({color:0xe8efff,transparent:true,opacity:1,fog:false}));this.bolt.frustumCulled=false;this.bolt.visible=false;R3.scene.add(this.bolt);this.boltT=0;this.cellNextBolt=2;
 },
 updateCell(dt,t){
  const c=G.cell;if(!c){if(this.cellG)this.cellG.visible=false;if(this.bolt)this.bolt.visible=false;return;}
  this.ensureCell();const g=this.cellG;g.visible=true;g.position.set(c.x,0,c.z);const sc=c.r/1500;g.scale.set(sc,sc*1.15,sc);
  const dark=R3.tod==='night'?0.4:1;g.userData.mat.color.setRGB(0.18*dark+0.02,0.2*dark+0.02,0.23*dark+0.03);
  g.userData.mat.emissive.setRGB(this.flash*0.7,this.flash*0.75,this.flash);
  // lightning bolts hitting the ground inside the cell
  this.cellNextBolt-=dt;
  if(this.cellNextBolt<=0&&c.near){this.cellNextBolt=2.5+Math.random()*9;this.flash=1;this.thunderAt=t+0.5+Math.random()*3;
   const a=Math.random()*6.283,rr=Math.random()*c.r*0.8,bx=c.x+Math.cos(a)*rr,bz=c.z+Math.sin(a)*rr,P=this.bolt.geometry.attributes.position.array;let x=bx,z=bz;
   for(let i=0;i<14;i++){const y=700*(1-i/13);P[i*3]=x;P[i*3+1]=y;P[i*3+2]=z;x+=(Math.random()-0.5)*90;z+=(Math.random()-0.5)*90;}
   this.bolt.geometry.attributes.position.needsUpdate=true;this.bolt.visible=true;this.boltT=0.18;}
  if(this.boltT>0){this.boltT-=dt;if(this.boltT<=0)this.bolt.visible=false;}
 },
 update(dt,t){
  const k=this.kind;
  this.updateCell(dt,t);
  if(this.rain){const want=(k==='rain'||k==='storm')||!!(G.cell&&G.cell.over);if(this.rain.visible!==want){this.rain.visible=want;this.rainN=want?(k==='storm'||(G.cell&&G.cell.over)?1:0.6):0;}}
  if(this.rain&&this.rain.visible){
   const a=this.rain.geometry.attributes.position,arr=a.array,sp=(k==='storm'?62:48)*dt,sl=k==='storm'?0.28:0.18;
   const wd=G.wind?G.wind.spd*0.06:0.3;
   for(let i=0;i<arr.length;i+=6){let y=arr[i+1]-sp;if(y<0){y+=90;arr[i]=(Math.random()-0.5)*220;arr[i+2]=(Math.random()-0.5)*220;}
    arr[i]+=wd*dt*8*0;arr[i+1]=y;arr[i+3]=arr[i]-sl*wd*6;arr[i+4]=y-1.7;arr[i+5]=arr[i+2];arr[i+2]=arr[i+2];}
   a.needsUpdate=true;const c=R3.camera.position;this.rain.position.set(c.x,c.y>90?c.y-90:0,c.z);
   this.rain.material.opacity=(k==='storm'?0.42:0.3)*(R3.tod==='night'?0.7:1);
  }
  if(k==='storm'||(G.cell&&G.cell.near)){
   if(k==='storm')this.nextFlash-=dt;
   if(this.nextFlash<=0){this.flash=1;this.nextFlash=5+Math.random()*14;this.thunderAt=t+0.4+Math.random()*3.5;if(Math.random()<0.35)this.nextFlash=0.18+Math.random()*0.25;}
   if(this.flash>0){this.flash=Math.max(0,this.flash-dt*4.5);const f=this.flash*this.flash;R3.hemi.intensity=R3.P.hemi[2]*(1+0.9)+f*3.2;R3.skyU.top.value.copy(lin(0x9aa6c8)).lerp(lin(0x2a3140),1-f);R3.skyU.hor.value.copy(lin(0xc9d0e4)).lerp(lin(0x59616b),1-f);
    if(this.flash===0)this.apply(this.kind);}
   if(this.thunderAt>0&&t>this.thunderAt){this.thunderAt=-1;this.thunder();}
  }
 },
 thunder(){
  try{if(typeof Voice!=='undefined'&&Voice.on===false)return;const ac=this.ac||(this.ac=new(window.AudioContext||window.webkitAudioContext)());if(ac.state==='suspended')ac.resume();
   const len=ac.sampleRate*3.2,buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);let last=0;
   for(let i=0;i<len;i++){last=(last+0.02*(Math.random()*2-1))/1.02;const env=Math.pow(1-i/len,2.2)*(1+0.6*Math.sin(i/ac.sampleRate*11));d[i]=last*3.6*env;}
   const s=ac.createBufferSource();s.buffer=buf;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=300;const gn=ac.createGain();gn.gain.value=0.5;s.connect(f);f.connect(gn);gn.connect(ac.destination);s.start();}catch(e){}
 }
};
/* ---------------- apron service vehicles ---------------- */
const SVC={list:[],built:false,
 build(){
  if(this.built||!R3.ok)return;this.built=true;
  const mk=(c,r)=>new THREE.MeshStandardMaterial({color:lin(c),roughness:r||0.6,metalness:0.2,envMapIntensity:0.6});
  const white=mk(0xe8eaec),yel=mk(0xf0c020),dark=mk(0x1c2024,0.9),orange=mk(0xe0701a),glass=mk(0x2a3a4a,0.1),grey=mk(0x8a9096);
  const box=(w,h,d,m,x,y,z,p)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;p.add(o);return o;};
  const wheels=(p,xs,zs,r)=>{for(const x of xs)for(const z of zs){const w=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.5,12),dark);w.rotation.x=Math.PI/2;w.position.set(x,r,z);p.add(w);}};
  const fuel=()=>{const g=new THREE.Group();box(1.3,1.2,1.7,white,2.6,1.2,0,g);box(0.15,0.55,1.5,glass,3.3,1.55,0,g);
   const t=new THREE.Mesh(new THREE.CylinderGeometry(1.05,1.05,5.2,16),white);t.rotation.z=Math.PI/2;t.position.set(-0.4,1.9,0);t.castShadow=true;g.add(t);
   box(5.4,0.6,1.7,dark,-0.4,0.75,0,g);const st=new THREE.Mesh(new THREE.CylinderGeometry(1.07,1.07,0.5,16),orange);st.rotation.z=Math.PI/2;st.position.set(-0.4,1.9,0);g.add(st);
   const bm=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.4,0.4),yel);bm.position.set(-3.0,1.6,0);g.add(bm);wheels(g,[-2,2.4],[-0.85,0.85],0.5);return g;};
  const bag=()=>{const g=new THREE.Group();box(1.5,1.1,1.2,yel,0.6,0.9,0,g);box(0.9,0.6,1.1,glass,0.9,1.5,0,g);wheels(g,[0.1,1.0],[-0.5,0.5],0.35);
   for(let i=0;i<2;i++){const c=new THREE.Group();c.position.x=-2.4-i*3.1;box(2.7,0.12,1.7,grey,0,0.55,0,c);box(2.7,0.9,0.08,mk(0x7d858c),0,1.0,-0.8,c);
    for(let b=0;b<3;b++)box(0.7,0.5,0.55,mk([0x3a4a6a,0x6a3a3a,0x35503a][b]),-0.8+b*0.8,0.9,0.1,c);wheels(c,[-1,1],[-0.7,0.7],0.3);g.add(c);}return g;};
  for(let i=1;i<=6;i++){const gx=GATE_X[i-1],f=fuel(),b=bag();f.visible=b.visible=false;R3.scene.add(f);R3.scene.add(b);
   this.list.push({i,gx,f,b,fp:{x:gx+30,z:-300},bp:{x:gx-30,z:-300},fs:0,bs:0});}
 },
 update(dt){
  if(!this.built||!G.ents)return;
  for(const s of this.list){
   const a=G.ents.find(e=>!e.dead&&!e.veh&&e.gate==String(s.i)&&e.kind==='dep'&&(e.phase==='BOARDING'||e.phase==='AT_GATE'));
   // target: fuel truck at right wing root, baggage at forward hold (rear of nose), moving in from the lane
   const tf=a?{x:s.gx+18,z:-352,th:Math.PI}:{x:s.gx+34,z:-300,th:Math.PI/2};
   const tb=a?{x:s.gx-6,z:-336,th:Math.PI/2}:{x:s.gx-34,z:-300,th:Math.PI/2};
   const mv=(o,p,tgt,sp)=>{const dx=tgt.x-p.x,dz=tgt.z-p.z,d=Math.hypot(dx,dz);if(d>0.2){const st=Math.min(d,sp*dt);p.x+=dx/d*st;p.z+=dz/d*st;o.rotation.y=-Math.atan2(dz,dx)+Math.PI;return true;}return false;};
   for(const [o,p,tgt,key] of [[s.f,s.fp,tf,'fs'],[s.b,s.bp,tb,'bs']]){
    if(a)o.visible=true;const moved=mv(o,p,tgt,6);o.position.set(p.x,0.06,p.z);
    if(!a&&!moved)o.visible=false;
    if(a&&!moved)o.rotation.y=key==='fs'?Math.PI/2:0;
   }
  }
 }
};

/* ---------------- airside traffic: buses, catering, crew vans, sweeper drive the service lane behind the stands ---------------- */
const ROAM={list:[],built:false,
 mesh(kind){
  const g=new THREE.Group(),M=(c,r)=>new THREE.MeshStandardMaterial({color:lin(c),roughness:r||0.6,metalness:0.15});
  const box=(w,h,d,m,x,y,z)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.castShadow=true;g.add(b);return b;};
  const wh=(xs,zs,r)=>{const m=M(0x141517,0.9);for(const x of xs)for(const z of zs){const w=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.3,12),m);w.rotation.x=Math.PI/2;w.position.set(x,r,z);g.add(w);}};
  const beacon=col=>{const b=box(0.5,0.18,0.3,new THREE.MeshBasicMaterial({color:col}),0,0,0);g.userData.beacon=b;return b;};
  if(kind==='bus'){box(11,0.5,2.7,M(0x2b2f35),0,0.75,0);box(11,2.1,2.7,M(0xe6b422),0,2.0,0);box(10.4,0.9,2.76,M(0x1b2630,0.2),0,2.2,0);wh([-3.6,3.6],[-1.2,1.2],0.52);const b=beacon(0xffaa00);b.position.set(0,3.2,0);}
  else if(kind==='cater'){box(6.5,1.2,2.4,M(0x2d3136),-1,0.9,0);box(5.4,2.8,2.5,M(0xf2f3f4),-1.1,2.8,0);box(1.7,1.8,2.3,M(0xd8232a),2.7,1.7,0);box(0.2,1.0,1.9,M(0x1b2630,0.2),3.6,2.0,0);wh([-3,0.6,2.8],[-1.1,1.1],0.5);const b=beacon(0xffaa00);b.position.set(2.6,2.7,0);}
  else if(kind==='van'){box(4.4,1.0,1.9,M(0xe6d422),0,0.95,0);box(2.6,0.9,1.8,M(0xe6d422),-0.4,1.85,0);box(1.0,0.7,1.78,M(0x1b2630,0.2),0.7,1.8,0);wh([-1.4,1.4],[-0.8,0.8],0.36);const b=beacon(0xff8a00);b.position.set(-0.4,2.4,0);}
  else{box(5.2,1.0,2.2,M(0xd8e0e6),0,1.0,0);box(1.5,1.0,2.0,M(0x3a8a4a),1.8,2.0,0);box(2.4,0.5,2.4,M(0x2d3136),-2.4,1.4,0);wh([-1.8,1.8],[-1.0,1.0],0.4);const b=beacon(0xffaa00);b.position.set(1.8,2.7,0);}
  return g;},
 build(){
  if(this.built||!R3.ok)return;this.built=true;
  const gx=typeof GATE_X!=='undefined'?GATE_X:[-300,-180,-60,60,180,300];const x0=Math.min(...gx)-160,x1=Math.max(...gx)+160;this.x0=x0;this.x1=x1;
  [['bus',-408,1],['cater',-402,-1],['van',-414,1],['sweep',-396,-1],['van',-420,-1]].forEach((d,i)=>{
   const m=this.mesh(d[0]);const x=x0+(x1-x0)*(0.12+0.2*i);m.position.set(x,0,d[1]);R3.scene.add(m);
   this.list.push({m,kind:d[0],x,z:d[1],dir:d[2],th:d[2]>0?0:Math.PI,v:0,hold:Math.random()*6,sp:5+Math.random()*3,bt:Math.random()*6});});
 },
 update(dt,t){
  if(!this.built||!G.ents)return;const closed=!!G.rampClosed;
  for(const r of this.list){
   const wantStop=closed||r.hold>0;if(r.hold>0)r.hold-=dt;
   const tv=wantStop?0:r.sp*(r.kind==='sweep'?0.6:1);r.v+=(tv-r.v)*Math.min(1,dt*1.2);
   r.x+=Math.cos(r.th)*r.v*dt;
   if(r.dir>0&&r.x>this.x1||r.dir<0&&r.x<this.x0){r.dir=-r.dir;r.hold=1+Math.random()*4;}
   if(!closed&&r.v>2&&Math.random()<dt*0.04)r.hold=3+Math.random()*7;   // pull up beside a stand for a bit
   const tgt=r.dir>0?0:Math.PI;let d=tgt-r.th;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;r.th+=d*Math.min(1,dt*(1.6+r.v*0.12));
   r.m.position.set(r.x,0.02+Math.sin(t*14+r.x)*0.006*Math.min(1,r.v/4),r.z);r.m.rotation.y=-r.th;r.m.rotation.z=-Math.min(0.03,r.v*0.0015)*Math.sign(d)*0;
   if(r.m.userData.beacon)r.m.userData.beacon.visible=Math.sin(t*9+r.bt)>0;
  }
 }
};
/* ---------------- ambient tower sound: HVAC hum, wind, rain, aircraft engines by distance, tyre chirp ---------------- */
const Amb={on:(()=>{try{return localStorage.getItem('marlow.amb')!=='0';}catch(e){return true;}})(),ready:false,t:0,
 init(){
  if(this.ready||typeof Voice==='undefined')return;const ac=Voice.ctx;if(!ac||ac.state!=='running')return;
  this.ac=ac;const n=ac.sampleRate*3,buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);let b0=0,b1=0,b2=0;
  for(let i=0;i<n;i++){const w=Math.random()*2-1;b0=0.99765*b0+w*0.099;b1=0.963*b1+w*0.2965;b2=0.57*b2+w*1.05;d[i]=(b0+b1+b2+w*0.18)*0.16;}   // pink-ish
  this.buf=buf;this.master=ac.createGain();this.master.gain.value=0;this.master.connect(ac.destination);
  const src=(type,f,q)=>{const s=ac.createBufferSource();s.buffer=buf;s.loop=true;s.loopStart=Math.random()*1.5;const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q||0.7;const g=ac.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);s.start(0,Math.random()*2);return{s,fl,g};};
  this.hum=src('lowpass',160,0.5);this.wind=src('bandpass',420,0.5);this.rain=src('highpass',1800,0.6);this.jet=src('bandpass',420,0.8);this.whine=src('bandpass',2600,3);
  this.pan=ac.createStereoPanner?ac.createStereoPanner():null;
  for(const k of['hum','wind','rain'])this[k].g.connect(this.master);
  if(this.pan){this.jet.g.connect(this.pan);this.whine.g.connect(this.pan);this.pan.connect(this.master);}else{this.jet.g.connect(this.master);this.whine.g.connect(this.master);}
  const o=ac.createOscillator();o.frequency.value=100;const og=ac.createGain();og.gain.value=0.004;o.connect(og);og.connect(this.master);o.start();
  this.ready=true;
 },
 touch(e){
  if(!this.ready||!this.on)return;const c=R3.camera.position,d=Math.hypot(e.x-c.x,e.z-c.z);const ac=this.ac;if(d>2600)return;
  const s=ac.createBufferSource();s.buffer=this.buf;const f=ac.createBiquadFilter();f.type='bandpass';f.frequency.value=1700+Math.random()*500;f.Q.value=1.4;const g=ac.createGain();const A=0.22/(1+Math.pow(d/350,1.5));
  const t0=ac.currentTime+d/340*0.35;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(A,t0+0.04);g.gain.exponentialRampToValueAtTime(0.0005,t0+0.9);s.connect(f);f.connect(g);g.connect(this.master);s.start(t0,Math.random()*1.5,1.2);
 },
 update(dt,t){
  if(!this.ready){this.t-=dt;if(this.t<=0){this.t=1;this.init();}return;}
  const ac=this.ac,now=ac.currentTime,ramp=(p,v,tc)=>p.setTargetAtTime(v,now,tc||0.4);
  const on=this.on&&G&&G.ents&&!G.over;ramp(this.master.gain,on?1:0,0.5);
  if(!on)return;
  const w=G.wind?G.wind.spd:6,gst=0.5+0.5*Math.sin(t*0.9)*Math.sin(t*0.37);
  ramp(this.hum.g.gain,R3.mode==='tower'?0.06:0.015,0.8);
  ramp(this.wind.g.gain,Math.min(0.14,0.012+w*0.0045)*(0.6+0.8*gst),0.5);ramp(this.wind.fl.frequency,260+w*22,0.6);
  const rain=(WX.kind==='rain'||WX.kind==='storm'||(G.cell&&G.cell.over))?(WX.kind==='storm'||(G.cell&&G.cell.over)?0.1:0.065):0;ramp(this.rain.g.gain,rain,0.8);
  // engines
  const c=R3.camera.position,yaw=R3.cam?R3.cam.yaw:0,rx=Math.cos(yaw),rz=-Math.sin(yaw);let L=0,Lh=0,px=0,fr=0;
  for(const e of G.ents){
   if(e.dead||e.veh)continue;let th=0;
   switch(e.phase){case'ROLL':case'CLIMB':case'GOAROUND':th=1;break;case'ROLLOUT':th=e.v>40?0.65:0.2;break;case'APPROACH':th=e.D>0?0.35:0.5;break;case'LINEUP':case'TAXI':case'PUSHBACK':case'RETURN':th=0.12;break;case'RTO':th=0.8;break;default:th=0.01;}
   if(th<=0.02)continue;const dx=e.x-c.x,dz=e.z-c.z,dy=(e.y||0)-c.y,d=Math.hypot(dx,dz,dy)+1;
   const big=(e.type&&e.type.eng===4?1.25:1)*(e.type&&e.type.wake==='H'?1.15:1)*(e.type&&e.type.prop?0.7:1);
   const a=th*big*0.5/(1+Math.pow(d/380,1.7));L+=a;px+=a*((dx*rx+dz*rz)/d);fr+=a*(300+th*650);if(!(e.type&&e.type.prop))Lh+=a*th*th;
  }
  const tot=L+1e-6;ramp(this.jet.g.gain,Math.min(0.5,L*1.4),0.25);ramp(this.jet.fl.frequency,Math.max(180,Math.min(1200,fr/tot)),0.4);
  ramp(this.whine.g.gain,Math.min(0.06,Lh*0.35),0.3);if(this.pan)ramp(this.pan.pan,clamp(px/tot,-0.8,0.8),0.3);
 }
};
(function(){
 const _uc=R3.updateCam;let last=performance.now()/1000;
 R3.updateCam=function(dt){_uc.call(this,dt);const now=performance.now()/1000,d=Math.min(0.1,now-last);last=now;
  try{SVC.build();SVC.update(d);ROAM.build();ROAM.update(d,now);WX.update(d,now);Amb.update(d,now);R3.todAuto(d);}catch(e){if(!R3._xe){R3._xe=1;console.warn('extras',e);}}};
})();
