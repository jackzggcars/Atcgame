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
 update(dt,t){
  const k=this.kind;
  if(this.rain&&this.rain.visible){
   const a=this.rain.geometry.attributes.position,arr=a.array,sp=(k==='storm'?62:48)*dt,sl=k==='storm'?0.28:0.18;
   const wd=G.wind?G.wind.spd*0.06:0.3;
   for(let i=0;i<arr.length;i+=6){let y=arr[i+1]-sp;if(y<0){y+=90;arr[i]=(Math.random()-0.5)*220;arr[i+2]=(Math.random()-0.5)*220;}
    arr[i]+=wd*dt*8*0;arr[i+1]=y;arr[i+3]=arr[i]-sl*wd*6;arr[i+4]=y-1.7;arr[i+5]=arr[i+2];arr[i+2]=arr[i+2];}
   a.needsUpdate=true;const c=R3.camera.position;this.rain.position.set(c.x,c.y>90?c.y-90:0,c.z);
   this.rain.material.opacity=(k==='storm'?0.42:0.3)*(R3.tod==='night'?0.7:1);
  }
  if(k==='storm'){
   this.nextFlash-=dt;
   if(this.nextFlash<=0){this.flash=1;this.nextFlash=5+Math.random()*14;this.thunderAt=t+0.4+Math.random()*3.5;if(Math.random()<0.35)this.nextFlash=0.18+Math.random()*0.25;}
   if(this.flash>0){this.flash=Math.max(0,this.flash-dt*4.5);const f=this.flash*this.flash;R3.hemi.intensity=R3.P.hemi[2]*(1+0.9)+f*3.2;R3.skyU.top.value.copy(lin(0x9aa6c8)).lerp(lin(0x2a3140),1-f);R3.skyU.hor.value.copy(lin(0xc9d0e4)).lerp(lin(0x59616b),1-f);
    if(this.flash===0)this.apply('storm');}
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
(function(){
 const _uc=R3.updateCam;let last=performance.now()/1000;
 R3.updateCam=function(dt){_uc.call(this,dt);const now=performance.now()/1000,d=Math.min(0.1,now-last);last=now;
  try{SVC.build();SVC.update(d);WX.update(d,now);}catch(e){if(!R3._xe){R3._xe=1;console.warn('extras',e);}}};
})();
