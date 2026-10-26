'use strict';
/* =====================================================================
   FX3D — particles (fire, smoke, sparks, vapour, water), detached parts with rigid-body physics,
   crash / break-up simulation, evacuation slides + passengers, fire-truck cannons.
   Everything here is driven by the damage record the simulation puts on each aircraft
   (a.dmg, a.fire, a.evac ...) plus the 'accident' event.
   ===================================================================== */
const V3=THREE.Vector3;
const FXC={
 flame0:[1,0.86,0.45],flame1:[1,0.28,0.04],smokeD0:[0.06,0.06,0.07],smokeD1:[0.28,0.28,0.30],smokeL0:[0.88,0.9,0.92],smokeL1:[0.7,0.72,0.75],
 spark0:[1,0.9,0.5],spark1:[1,0.45,0.1],water0:[0.85,0.93,1],water1:[0.7,0.85,1],dust0:[0.45,0.38,0.28],dust1:[0.35,0.3,0.24]
};
function makePS(max,additive,soft){
 const pos=new Float32Array(max*3),col=new Float32Array(max*3),size=new Float32Array(max),alpha=new Float32Array(max);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('col',new THREE.BufferAttribute(col,3));g.setAttribute('size',new THREE.BufferAttribute(size,1));g.setAttribute('alpha',new THREE.BufferAttribute(alpha,1));
 const [c,x]=(()=>{const c=document.createElement('canvas');c.width=c.height=64;return[c,c.getContext('2d')];})();
 const gr=x.createRadialGradient(32,32,0,32,32,32);
 if(soft){gr.addColorStop(0,'rgba(255,255,255,0.95)');gr.addColorStop(0.45,'rgba(255,255,255,0.55)');gr.addColorStop(1,'rgba(255,255,255,0)');}
 else{gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.35,'rgba(255,255,255,0.7)');gr.addColorStop(1,'rgba(255,255,255,0)');}
 x.fillStyle=gr;x.fillRect(0,0,64,64);
 const tex=new THREE.CanvasTexture(c);
 const mat=new THREE.ShaderMaterial({uniforms:{map:{value:tex},uScale:{value:800}},transparent:true,depthWrite:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
  vertexShader:'attribute float size;attribute float alpha;attribute vec3 col;uniform float uScale;varying vec3 vC;varying float vA;void main(){vC=col;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*uScale/-mv.z,0.0,420.0);}',
  fragmentShader:'uniform sampler2D map;varying vec3 vC;varying float vA;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC,t.a*vA);if(gl_FragColor.a<0.004)discard;}'});
 const pts=new THREE.Points(g,mat);pts.frustumCulled=false;pts.renderOrder=additive?6:5;
 const P={max,pts,g,mat,pos,col,size,alpha,vel:new Float32Array(max*3),age:new Float32Array(max),ttl:new Float32Array(max),s0:new Float32Array(max),s1:new Float32Array(max),
  c0:new Float32Array(max*3),c1:new Float32Array(max*3),a0:new Float32Array(max),grav:new Float32Array(max),drag:new Float32Array(max),buoy:new Float32Array(max),wind:new Float32Array(max),ptr:0,additive};
 return P;
}
function psEmit(P,x,y,z,vx,vy,vz,ttl,s0,s1,c0,c1,a0,grav,drag,buoy,wind){
 const i=P.ptr;P.ptr=(P.ptr+1)%P.max;
 P.pos[i*3]=x;P.pos[i*3+1]=y;P.pos[i*3+2]=z;P.vel[i*3]=vx;P.vel[i*3+1]=vy;P.vel[i*3+2]=vz;P.age[i]=0;P.ttl[i]=ttl;P.s0[i]=s0;P.s1[i]=s1;
 P.c0[i*3]=c0[0];P.c0[i*3+1]=c0[1];P.c0[i*3+2]=c0[2];P.c1[i*3]=c1[0];P.c1[i*3+1]=c1[1];P.c1[i*3+2]=c1[2];P.a0[i]=a0;P.grav[i]=grav||0;P.drag[i]=drag||0;P.buoy[i]=buoy||0;P.wind[i]=wind||0;
}
function psUpdate(P,dt,wx,wz){
 const n=P.max;let dirty=false;
 for(let i=0;i<n;i++){
  const ttl=P.ttl[i];if(ttl<=0)continue;
  const age=P.age[i]+dt;P.age[i]=age;
  if(age>=ttl){P.ttl[i]=0;P.alpha[i]=0;P.size[i]=0;dirty=true;continue;}
  const k=age/ttl,i3=i*3,dr=Math.max(0,1-P.drag[i]*dt);
  P.vel[i3]=P.vel[i3]*dr+wx*P.wind[i]*dt;P.vel[i3+2]=P.vel[i3+2]*dr+wz*P.wind[i]*dt;P.vel[i3+1]=P.vel[i3+1]*dr+(P.buoy[i]-P.grav[i])*dt;
  P.pos[i3]+=P.vel[i3]*dt;P.pos[i3+1]+=P.vel[i3+1]*dt;P.pos[i3+2]+=P.vel[i3+2]*dt;
  if(P.pos[i3+1]<0.05&&P.grav[i]>0){P.pos[i3+1]=0.05;P.vel[i3+1]*=-0.3;P.vel[i3]*=0.7;P.vel[i3+2]*=0.7;}
  P.size[i]=P.s0[i]+(P.s1[i]-P.s0[i])*k;
  P.col[i3]=P.c0[i3]+(P.c1[i3]-P.c0[i3])*k;P.col[i3+1]=P.c0[i3+1]+(P.c1[i3+1]-P.c0[i3+1])*k;P.col[i3+2]=P.c0[i3+2]+(P.c1[i3+2]-P.c0[i3+2])*k;
  const fi=Math.min(1,age*7);P.alpha[i]=P.a0[i]*fi*Math.pow(1-k,P.additive?1.2:1.6);dirty=true;
 }
 if(dirty){P.g.attributes.position.needsUpdate=true;P.g.attributes.col.needsUpdate=true;P.g.attributes.size.needsUpdate=true;P.g.attributes.alpha.needsUpdate=true;}
}
const rnd2=(a,b)=>a+Math.random()*(b-a);
const _v=new V3(),_v2=new V3(),_q=new THREE.Quaternion(),_e=new THREE.Euler();

const FX={
 ready:false,parts:[],wrecks:[],srcs:[],pax:[],acc:{},
 init(){
  if(this.ready||!R3.ok)return;this.ready=true;
  this.glow=makePS(7000,true,false);this.smoke=makePS(9000,false,true);
  R3.scene.add(this.glow.pts);R3.scene.add(this.smoke.pts);
  this.debrisGeo=new THREE.BoxGeometry(1,1,1);
  this.debrisMats=[0xe9ecef,0xb8bec4,0x8d949b,0x2b2f33].map(c=>new THREE.MeshStandardMaterial({color:new THREE.Color(c).convertSRGBToLinear(),roughness:0.7,metalness:0.3}));
  this.slideMat=new THREE.MeshStandardMaterial({color:new THREE.Color(0xff7a1a).convertSRGBToLinear(),roughness:0.55,emissive:0x331400,side:THREE.DoubleSide});
  this.paxGeo=new THREE.BoxGeometry(0.5,1.7,0.38);this.paxMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.9});
 },
 reset(){
  if(!this.ready)return;
  for(const w of this.wrecks){R3.scene.remove(w.m.holder);}
  for(const p of this.parts){if(p.obj&&p.obj.parent)p.obj.parent.remove(p.obj);}this.parts=[];this.wrecks=[];this.srcs=[];
  for(const x of this.pax){if(x.mesh&&x.mesh.parent)x.mesh.parent.remove(x.mesh);}this.pax=[];this.acc={};
  for(const P of[this.glow,this.smoke]){P.ttl.fill(0);P.alpha.fill(0);P.size.fill(0);P.g.attributes.alpha.needsUpdate=true;P.g.attributes.size.needsUpdate=true;}
 },
 /* emission helper: n per second accumulated */
 n(key,rate,dt){const a=(this.acc[key]||0)+rate*dt;const c=Math.floor(a);this.acc[key]=a-c;return Math.min(c,60);},
 windVec(){const w=typeof G!=='undefined'&&G.wind?G.wind:null;if(!w)return[0,0];const h=w.dir*Math.PI/180,s=w.spd*0.45;return[-Math.sin(h)*s,Math.cos(h)*s];},
 flame(x,y,z,vx,vy,vz,sz,life){psEmit(this.glow,x,y,z,vx,vy,vz,life||rnd2(0.45,0.9),sz,sz*0.25,FXC.flame0,FXC.flame1,0.95,0,0.4,3.5,0);},
 smokeD(x,y,z,vx,vy,vz,sz,life,a){psEmit(this.smoke,x,y,z,vx,vy,vz,life||rnd2(5,9),sz*0.5,sz*3.4,FXC.smokeD0,FXC.smokeD1,a||0.6,0,0.35,1.1,0.6);},
 smokeL(x,y,z,vx,vy,vz,sz,life,a){psEmit(this.smoke,x,y,z,vx,vy,vz,life||rnd2(2,4),sz*0.5,sz*3,FXC.smokeL0,FXC.smokeL1,a||0.35,0,0.5,0.4,0.8);},
 spark(x,y,z,vx,vy,vz){psEmit(this.glow,x,y,z,vx,vy,vz,rnd2(0.25,0.7),0.22,0.08,FXC.spark0,FXC.spark1,1,9,0.2,0,0);},
 dust(x,y,z,vx,vy,vz,sz){psEmit(this.smoke,x,y,z,vx,vy,vz,rnd2(1.6,3.2),sz*0.6,sz*3.2,FXC.dust0,FXC.dust1,0.45,0,1.0,0.6,0.3);},
 water(x,y,z,vx,vy,vz){psEmit(this.smoke,x,y,z,vx,vy,vz,rnd2(1.1,1.7),0.5,1.8,FXC.water0,FXC.water1,0.55,9.8,0.1,0,0);},
 fireball(x,y,z,s){
  for(let i=0;i<Math.floor(70*s);i++){const a=Math.random()*6.28,r=Math.random()*10*s,u=rnd2(4,22)*s;this.flame(x+Math.cos(a)*r*0.4,y+rnd2(0,5),z+Math.sin(a)*r*0.4,Math.cos(a)*r*0.9,u,Math.sin(a)*r*0.9,rnd2(5,13)*s,rnd2(0.7,1.6));}
  for(let i=0;i<Math.floor(34*s);i++){const a=Math.random()*6.28,r=Math.random()*9*s;this.smokeD(x+Math.cos(a)*r,y+rnd2(2,10),z+Math.sin(a)*r,Math.cos(a)*r*0.7,rnd2(6,16)*s,Math.sin(a)*r*0.7,rnd2(8,17)*s,rnd2(8,14),0.8);}
 },
 boom(s){
  try{const ac=WX.ac||(WX.ac=new(window.AudioContext||window.webkitAudioContext)());if(ac.state==='suspended')ac.resume();
   const len=Math.floor(ac.sampleRate*2.6),buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);let last=0;
   for(let i=0;i<len;i++){last=(last+0.05*(Math.random()*2-1))/1.05;d[i]=last*5.0*Math.pow(1-i/len,2.6);}
   const so=ac.createBufferSource();so.buffer=buf;const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=380;const gn=ac.createGain();gn.gain.value=Math.min(0.9,0.5*(s||1));so.connect(f);f.connect(gn);gn.connect(ac.destination);so.start();}catch(e){}
 },
 /* ---------- detached parts ---------- */
 detach(obj,vel,spin,opts){
  obj.updateMatrixWorld(true);R3.scene.attach(obj);opts=opts||{};
  this.parts.push({obj,vel:vel.clone(),spin:spin.clone(),rad:opts.rad||1.2,fire:opts.fire||0,age:0,burn:opts.burn||110,ground:false,smoke:opts.smoke!==false});
 },
 debris(pos,vel,n,sev){
  for(let i=0;i<n;i++){
   const m=new THREE.Mesh(this.debrisGeo,this.debrisMats[(Math.random()*4)|0]);const s=rnd2(0.3,2.2)*(0.6+sev*0.5);m.scale.set(s,s*rnd2(0.05,0.3),s*rnd2(0.4,1.2));
   m.position.copy(pos);m.position.y+=rnd2(0.5,3);m.castShadow=true;R3.scene.add(m);
   const a=Math.random()*6.28,sp=rnd2(4,26)*(0.5+sev*0.6);
   this.parts.push({obj:m,vel:new V3(vel.x*0.4+Math.cos(a)*sp,rnd2(5,22)*(0.5+sev*0.5),vel.z*0.4+Math.sin(a)*sp),spin:new V3(rnd2(-8,8),rnd2(-8,8),rnd2(-8,8)),rad:s*0.15+0.05,fire:Math.random()<0.18?0.3:0,age:0,burn:rnd2(20,60),smoke:false,small:true});
  }
 },
 partsUpdate(dt){
  for(let i=this.parts.length-1;i>=0;i--){
   const p=this.parts[i],o=p.obj;p.age+=dt;
   p.vel.y-=9.8*dt;
   o.position.addScaledVector(p.vel,dt);
   _e.set(p.spin.x*dt,p.spin.y*dt,p.spin.z*dt);_q.setFromEuler(_e);o.quaternion.premultiply(_q);
   if(o.position.y<=p.rad){
    o.position.y=p.rad;
    if(Math.abs(p.vel.y)>2.2){p.vel.y*=-0.28;p.spin.multiplyScalar(0.6);if(!p.small&&Math.abs(p.vel.y)>5)this.dust(o.position.x,0.4,o.position.z,0,2,0,3);}else p.vel.y=0;
    const f=Math.max(0,1-(p.small?2.6:1.6)*dt);p.vel.x*=f;p.vel.z*=f;p.spin.multiplyScalar(Math.max(0,1-3*dt));p.ground=true;
   }
   if(p.fire>0&&p.age<p.burn){
    const it=p.fire*(1-p.age/p.burn);
    for(let k=this.n('pf'+i+'_'+p.age|0,0,dt),c=0;c<0;c++){}
    if(Math.random()<it*0.9){this.flame(o.position.x+rnd2(-1,1),o.position.y+rnd2(0,1.5),o.position.z+rnd2(-1,1),p.vel.x*0.3,rnd2(1,4),p.vel.z*0.3,rnd2(1.3,2.8)*(p.small?0.4:1),rnd2(0.4,0.8));}
    if(p.smoke&&Math.random()<it*0.7)this.smokeD(o.position.x,o.position.y+1,o.position.z,p.vel.x*0.5,rnd2(1,3),p.vel.z*0.5,rnd2(1.5,3.5),rnd2(4,7),0.5);
   }
   if(p.small&&p.age>70){R3.scene.remove(o);this.parts.splice(i,1);}
  }
 },
 /* ---------- ground fires left by crashes ---------- */
 pool(x,z,r,intensity,ttl){this.srcs.push({x,z,r,int:intensity,age:0,ttl:ttl||200});},
 srcUpdate(dt){
  for(let i=this.srcs.length-1;i>=0;i--){
   const s=this.srcs[i];s.age+=dt;if(s.age>s.ttl){this.srcs.splice(i,1);continue;}
   const k=Math.max(0.12,1-s.age/s.ttl),it=s.int*k;
   const nf=this.n('src'+i,38*it*(s.r/6),dt);
   for(let q=0;q<nf;q++){const a=Math.random()*6.28,rr=Math.sqrt(Math.random())*s.r;this.flame(s.x+Math.cos(a)*rr,0.3,s.z+Math.sin(a)*rr,rnd2(-0.5,0.5),rnd2(2,7)*(0.6+it),rnd2(-0.5,0.5),rnd2(1.8,4.2)*(0.6+s.r/12),rnd2(0.5,1.1));}
   const ns=this.n('srs'+i,9*it*(s.r/6),dt);
   for(let q=0;q<ns;q++){const a=Math.random()*6.28,rr=Math.random()*s.r*0.7;this.smokeD(s.x+Math.cos(a)*rr,2,s.z+Math.sin(a)*rr,rnd2(-0.4,0.4),rnd2(2,5),rnd2(-0.4,0.4),rnd2(3,6)*(0.5+s.r/14),rnd2(9,16),0.62*Math.min(1,it+0.3));}
  }
 },
 /* ---------- crash simulation ---------- */
 crash(list){
  this.init();if(!this.ready)return;
  const mid=list.length>1;
  for(const e of list){
   const m=R3.meshes.get(e.id);if(!m||m.veh)continue;
   const D=m.root.userData.dims;
   const sp=e.crashV||0,th=e.th;
   const w={e,m,D,pos:new V3(e.x,e.y,e.z),vel:new V3(Math.cos(th)*sp,e.crashVs||0,Math.sin(th)*sp),yaw:-th,pitch:e.pitch||0,roll:e.bank||0,pr:0,rr:0,yr:0,
    restY:-(D.gearH-D.rf)+0.15,touched:false,fire:0,age:0,rest:false,sev:0,airborne:e.y>2,m1:mid};
   if(w.airborne){w.pr=-(0.2+Math.random()*0.35);w.rr=(Math.random()-0.5)*(mid?2.6:1.1);w.yr=(Math.random()-0.5)*(mid?1.2:0.3);}
   else if(sp>8){w.restY=-(D.gearH-D.rf)+0.15;}
   m.sh.visible=false;this.wrecks.push(w);e.fxWreck=true;R3.meshes.delete(e.id);
   m.holder.userData.wreck=true;
   if(!w.airborne&&e.sliding)w.pos.y=e.y;
   if(mid&&e.y>8){this.fireball(e.x,e.y,e.z,0.9);w.midair=true;this.boom(1);this.breakUp(w,1.5,true);}
  }
  const c=list[0];
  if(R3.setMode){R3.setMode('apron');R3.cam.target.set(c.x,6,c.z);R3.cam.orbYaw=0.75;R3.cam.orbPitch=0.28;R3.cam.dist=300;}
 },
 breakUp(w,sev,all){
  if(w.broken)return;w.broken=true;
  const U=w.m.root.userData.fus,pv=new V3(w.vel.x,Math.max(2,w.vel.y*-0.2),w.vel.z);
  w.m.holder.updateMatrixWorld(true);
  const kids=U.children.slice();
  for(const o of kids){
   const part=o.userData.part;if(!part)continue;
   const p=part==='wing'?0.3+0.5*sev:part==='eng'?0.4+0.45*sev:0.25+0.5*sev;
   if(!all&&Math.random()>p)continue;
   const side=o.userData.side||(Math.random()<0.5?-1:1);
   const v=pv.clone().add(new V3(rnd2(-6,6),rnd2(4,16)*(0.5+sev*0.5),side*rnd2(4,18)*(0.4+sev*0.5)+rnd2(-6,6)));
   this.detach(o,v,new V3(rnd2(-3,3),rnd2(-3,3),rnd2(-4,4)),{rad:part==='eng'?1.1:part==='wing'?0.8:0.6,fire:part==='wing'?0.85:part==='eng'?0.9:0.35,burn:rnd2(90,170)});
   w.lost=(w.lost||0)+1;
  }
  const c=new V3();w.m.holder.getWorldPosition(c);
  this.debris(new V3(w.pos.x,Math.max(1,w.pos.y),w.pos.z),pv,Math.floor(18+sev*30),sev);
 },
 crashUpdate(dt,t){
  const wxz=this.windVec();
  for(const w of this.wrecks){
   w.age+=dt;const D=w.D,h=w.m.holder,root=w.m.root,piv=w.m.body;
   const L=D.L;
   if(!w.rest){
    // integrate
    if(w.pos.y>w.restY+0.05||w.vel.y>0.5){
     w.vel.y-=9.8*dt;
     if(w.airborne){w.pr-=0.05*dt;w.pitch+=w.pr*dt;w.roll+=w.rr*dt;w.yaw+=w.yr*dt;}
    }
    w.pos.addScaledVector(w.vel,dt);
    if(w.pos.y<=w.restY){
     w.pos.y=w.restY;
     if(!w.touched){
      w.touched=true;const hs=Math.hypot(w.vel.x,w.vel.z),vy=Math.abs(w.vel.y);
      w.sev=Math.min(2,(vy*1.7+hs)/55);
      const hard=w.sev>0.45||w.airborne&&w.sev>0.2;
      if(hard||w.sev>0.15){this.breakUp(w,w.sev,w.sev>1.3);}
      if(w.sev>0.35||Math.random()<0.55){w.fire=Math.min(1,0.55+w.sev*0.5);this.fireball(w.pos.x,w.pos.y+2,w.pos.z,0.4+w.sev*0.9);this.boom(0.5+w.sev);}
      if(vy>3){w.vel.y=vy*0.14;}else w.vel.y=0;
      w.pr=0;w.rr=w.airborne?(Math.random()-0.5)*2.5*w.sev:0;w.yr=(Math.random()-0.5)*0.8*w.sev;w.airborne=false;
      w.settlePitch=-0.02+(Math.random()-0.5)*0.05;w.settleRoll=(w.lost?(Math.random()<0.5?-1:1)*rnd2(0.12,0.4):0)*Math.min(1,w.sev+0.3);
     }else if(w.vel.y<0)w.vel.y=0;
    }
    const onG=w.pos.y<=w.restY+0.3;
    if(onG){
     const hs=Math.hypot(w.vel.x,w.vel.z);
     const hard=Math.abs(w.pos.x)<AP.half+70&&Math.abs(w.pos.z)<40;
     const mu=(hard?0.34:0.55)*9.8;
     if(hs>0.3){
      const f=Math.max(0,hs-mu*dt)/hs;w.vel.x*=f;w.vel.z*=f;
      const n1=this.n('sp'+w.e.id,hs*1.6,dt);
      for(let i=0;i<n1;i++){const bx=rnd2(-0.35,0.3)*L;_v.set(bx,-D.rf*0.9,rnd2(-1,1)*D.rf*0.5);root.userData.fus.localToWorld(_v);
       if(hard||Math.random()<0.4)this.spark(_v.x,Math.max(0.2,_v.y),_v.z,w.vel.x*0.3+rnd2(-5,5),rnd2(3,10),w.vel.z*0.3+rnd2(-5,5));
       if(!hard||Math.random()<0.5)this.dust(_v.x,0.6,_v.z,w.vel.x*0.2+rnd2(-3,3),rnd2(1,4),w.vel.z*0.2+rnd2(-3,3),rnd2(2.5,5));}
      w.yaw+=w.yr*dt;w.yr*=Math.max(0,1-0.8*dt);
      if(Math.random()<dt*hs*0.02&&hs>15)this.pool(w.pos.x,w.pos.z,rnd2(4,8)*(0.5+w.sev),0.6*(w.fire>0?1:0.4),160);
     }else{w.vel.x=w.vel.z=0;if(!w.stopT)w.stopT=w.age;}
     w.pitch+= ((w.settlePitch||0)-w.pitch)*Math.min(1,dt*2.2);
     w.roll+= ((w.settleRoll||0)-w.roll)*Math.min(1,dt*(hs>1?1.2:3));
     w.rr*=Math.max(0,1-1.4*dt);w.roll+=w.rr*dt;
    }
   }
   // apply transforms
   h.position.copy(w.pos);root.rotation.y=w.yaw;piv.rotation.set(w.roll,0,THREE.MathUtils.clamp(w.pitch,-1.5,1.5));
   h.visible=true;
   if(w.m.root.userData.gear){const gr=w.m.root.userData.gear;gr.visible=!w.touched||!w.lost&&w.sev<0.5;}
   // continuous fuselage fire / smoke
   if(w.fire>0){
    const it=w.fire*Math.max(0.25,1-w.age/330);
    const nf=this.n('wf'+w.e.id,150*it,dt);
    for(let i=0;i<nf;i++){_v.set(rnd2(-0.42,0.38)*L,rnd2(-0.3,1.0)*D.rf,rnd2(-0.8,0.8)*D.rf);root.userData.fus.localToWorld(_v);this.flame(_v.x,_v.y,_v.z,w.vel.x*0.2,rnd2(2,8)*it,w.vel.z*0.2,rnd2(1.8,4.8),rnd2(0.4,1.0));}
    const ns=this.n('ws'+w.e.id,60*it,dt);
    for(let i=0;i<ns;i++){_v.set(rnd2(-0.4,0.35)*L,rnd2(0.6,1.4)*D.rf,rnd2(-0.6,0.6)*D.rf);root.userData.fus.localToWorld(_v);this.smokeD(_v.x,_v.y,_v.z,w.vel.x*0.2,rnd2(2,6),w.vel.z*0.2,rnd2(3,7),rnd2(9,16),0.7);}
    if(w.age>35&&!w.charred){w.charred=true;this.char(root);}
   }
   if(w.stopT&&!w.pooled){w.pooled=true;if(w.fire>0){this.pool(w.pos.x,w.pos.z,D.rf*3.2,1,240);}}
  }
 },
 char(root,amt){
  root.traverse(o=>{if(o.isMesh&&o.material&&o.material.color&&!o.userData.charred){o.userData.charred=1;o.material=o.material.clone();o.material.color.multiplyScalar(amt||0.28);if(o.material.emissiveMap)o.material.emissiveMap=null;}});
 },
 /* ---------- per-aircraft effects driven by simulation damage state ---------- */
 entityFx(e,m,dt){
  const D=m.root.userData.dims,fus=m.root.userData.fus;if(!D||e.dead)return;
  const dm=e.dmg||{};const st=m.fx||(m.fx={});
  const sp=e.v||0,th=e.th,vx=Math.cos(th)*sp,vz=Math.sin(th)*sp,vy=e.vs||0;
  const back=_v2.set(-Math.cos(th),0,-Math.sin(th));
  const needs=dm.engL||dm.engR||dm.leak||dm.belly||dm.smoke||e.fire>0||dm.brakes||e.evac||st.pax;
  if(!needs)return;
  m.holder.updateMatrixWorld(true);
  const engs=fus.userData.engs||[];
  const intens=Math.max(0.35,e.fire||0);
  for(const g of engs){
   const key=g.userData.side<0?'engL':'engR',stt=dm[key];if(!stt||stt==='ok')continue;
   const R=g.userData.eR||1,Ln=g.userData.eL||4;
   if(stt==='gone'&&!st['g'+key]){
    st['g'+key]=1;_v.set(0,0,0);g.getWorldPosition(_v);const v=new V3(vx,vy+1,vz).add(new V3(rnd2(-2,2),rnd2(1,3),g.userData.side*rnd2(5,9)));
    this.detach(g,v,new V3(rnd2(-3,3),rnd2(-2,2),rnd2(-3,3)),{rad:R*0.9,fire:0.95,burn:240});
   }
   if(stt==='gone'){ // pylon stub burning
    if(e.fire>0||true){const nf=this.n('pg'+e.id+key,45*intens,dt);_v.set(g.position.x,g.position.y+R*0.5,g.position.z);fus.localToWorld(_v);
     for(let i=0;i<nf;i++)this.flame(_v.x+rnd2(-0.3,0.3),_v.y+rnd2(0,0.6),_v.z+rnd2(-0.3,0.3),vx*0.9+back.x*rnd2(2,5),vy*0.9+rnd2(0,2),vz*0.9+back.z*rnd2(2,5),rnd2(0.7,1.5),rnd2(0.3,0.6));}
    continue;
   }
   g.getWorldPosition(_v);const ex=_v.x+back.x*Ln*0.55,ey=_v.y,ez=_v.z+back.z*Ln*0.55;
   if(stt==='fire'){
    const nf=this.n('fe'+e.id+key,95*intens,dt);
    for(let i=0;i<nf;i++)this.flame(ex+rnd2(-0.4,0.4)*R,ey+rnd2(-0.4,0.4)*R,ez+rnd2(-0.4,0.4)*R,vx*0.82+back.x*rnd2(2,7),vy*0.8+rnd2(-0.5,1.8),vz*0.82+back.z*rnd2(2,7),rnd2(0.8,1.5)*R,rnd2(0.4,0.8));
    const ns=this.n('se'+e.id+key,48*intens,dt);
    for(let i=0;i<ns;i++)this.smokeD(ex,ey+R*0.2,ez,vx*0.97,vy*0.9+rnd2(0,0.8),vz*0.97,rnd2(1.6,3)*R,rnd2(6,10),0.62);
   }else if(stt==='out'&&dm.engSmoke!==false){
    if(dm.engSmoke){const ns=this.n('sm'+e.id+key,26,dt);for(let i=0;i<ns;i++)this.smokeL(ex,ey,ez,vx*0.97,vy*0.9,vz*0.97,rnd2(1,1.8)*R,rnd2(3,6),0.5);}
   }
  }
  if(dm.leak&&e.y>1){ // fuel streaming from a wing
   const side=e.leakSide||1;_v.set(D.lex-D.rootC*0.3,D.wy,side*D.half*0.55);fus.localToWorld(_v);
   const nl=this.n('lk'+e.id,150,dt);
   for(let i=0;i<nl;i++)psEmit(this.smoke,_v.x+rnd2(-0.2,0.2),_v.y+rnd2(-0.1,0.1),_v.z+rnd2(-0.2,0.2),vx*0.93+back.x*rnd2(0,3),vy*0.9-rnd2(0.5,2),vz*0.93+back.z*rnd2(0,3),rnd2(2.5,4),0.5,3.4,FXC.smokeL0,FXC.smokeL1,0.28,0.4,0.2,0,0.5);
  }
  if(dm.belly&&e.phase==='SLIDE'&&sp>1.5){
   const ns=this.n('bs'+e.id,sp*3.2,dt);
   for(let i=0;i<ns;i++){_v.set(rnd2(-0.25,0.3)*D.L,-D.rf*0.95,rnd2(-0.8,0.8)*D.rf*0.6);fus.localToWorld(_v);
    this.spark(_v.x,Math.max(0.15,_v.y),_v.z,vx*0.25+rnd2(-4,4),rnd2(2,8),vz*0.25+rnd2(-4,4));
    if(Math.random()<0.5)this.dust(_v.x,0.4,_v.z,rnd2(-2,2),rnd2(0.5,2),rnd2(-2,2),rnd2(2.2,4.2));}
  }
  if(dm.hyd&&sp>3&&e.y<1.5&&e.phase==='SLIDE'){ // overheating brakes: smoke from both main gear
   for(const sd of[-1,1]){const nb=this.n('hb'+e.id+sd,sp*0.9,dt);_v.set(D.mainX,-D.gearH*0.9,sd*D.mz);fus.localToWorld(_v);
    for(let i=0;i<nb;i++)this.dust(_v.x,0.3,_v.z,vx*0.2+rnd2(-1,1),rnd2(0.6,2.2),vz*0.2+rnd2(-1,1),rnd2(1.8,3.2));}
  }
  if(dm.smoke&&e.y>5&&!e.fire){const ns=this.n('cs'+e.id,16,dt);for(let i=0;i<ns;i++){_v.set(rnd2(-0.2,0.25)*D.L,D.rf*1.02,0);fus.localToWorld(_v);this.smokeL(_v.x,_v.y,_v.z,vx*0.96,vy*0.9+0.5,vz*0.96,rnd2(0.8,1.4),rnd2(3,5),0.38);}}
  // ground fire on the airframe
  if(e.fire>0&&e.y<=2&&sp<12){
   const it=e.fire,wh=e.fireWhere||'engine';
   const nf=this.n('gf'+e.id,(wh==='cabin'||wh==='belly'?150:90)*it,dt);
   for(let i=0;i<nf;i++){
    if(wh==='brakes'){const sd=Math.random()<0.5?-1:1;_v.set(D.mainX+rnd2(-1.5,1.5),-D.gearH*0.75,sd*D.mz);}
    else if(wh==='wing'){const sd=e.leakSide||1;_v.set(D.lex-D.rootC*0.3+rnd2(-2,2),D.wy+0.5,sd*rnd2(0.2,0.7)*D.half);}
    else if(wh==='belly'){_v.set(rnd2(-0.3,0.28)*D.L,-D.rf*0.8,rnd2(-0.6,0.6)*D.rf);}
    else if(wh==='cabin'){_v.set(rnd2(-0.38,0.32)*D.L,rnd2(0.2,1)*D.rf,rnd2(-0.9,0.9)*D.rf);}
    else{const g=engs.find(x=>(e.dmg.engL==='fire'&&x.userData.side<0)||(e.dmg.engR==='fire'&&x.userData.side>0))||engs[0];if(g){_v.copy(g.position);_v.x-=1;}else _v.set(0,0,D.half*0.3);_v.x+=rnd2(-1,1);_v.y+=rnd2(-0.5,1.2);_v.z+=rnd2(-1,1);}
    fus.localToWorld(_v);this.flame(_v.x,_v.y,_v.z,rnd2(-0.8,0.8),rnd2(2,7)*(0.5+it),rnd2(-0.8,0.8),rnd2(1.4,3.8)*(0.6+it*0.6),rnd2(0.5,1.1));
   }
   const ns=this.n('gs'+e.id,(40+30*it),dt);
   for(let i=0;i<ns;i++){_v.set(rnd2(-0.35,0.3)*D.L,D.rf*rnd2(0.4,1.4),rnd2(-0.8,0.8)*D.rf);fus.localToWorld(_v);this.smokeD(_v.x,_v.y,_v.z,rnd2(-0.5,0.5),rnd2(2,5),rnd2(-0.5,0.5),rnd2(2.4,5.5)*(0.6+it),rnd2(8,14),0.5+0.3*it);}
  }else if(e.fireOut&&!st.steam){ // steam when the fire is knocked down
   st.steamT=(st.steamT||0)+dt;if(st.steamT<14){const ns=this.n('st'+e.id,26,dt);for(let i=0;i<ns;i++){_v.set(rnd2(-0.3,0.3)*D.L,D.rf*rnd2(0.4,1.2),rnd2(-0.6,0.6)*D.rf);fus.localToWorld(_v);this.smokeL(_v.x,_v.y,_v.z,0,rnd2(1,3),0,rnd2(2,3.5),rnd2(3,5),0.4);}}
  }
  if(e.burned&&!st.charred){st.charred=1;this.char(m.root,0.3);}
  // evacuation
  if(e.evac&&!st.pax)this.startPax(e,m);
 },
 startPax(e,m){
  const st=m.fx,D=m.root.userData.dims,fus=m.root.userData.fus,n=Math.min(110,Math.floor(e.type.len*1.5));
  m.holder.updateMatrixWorld(true);
  const doors=[[D.L*0.30,1],[D.L*0.30,-1],[-D.L*0.31,1],[-D.L*0.31,-1]];
  const slideLen=D.gearH*1.05,slides=[];
  doors.forEach(([x,sd])=>{
   const dz=D.rf*1.0,dy=-D.rf*0.2,ez=dz+D.gearH*0.75,ey=-D.gearH;
   const len=Math.hypot(ez-dz,ey-dy);const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.7,0.14,len),this.slideMat);
   mesh.position.set(x,(dy+ey)/2,sd*(dz+ez)/2);mesh.rotation.x=sd*Math.atan2(ez-dz,dy-ey)*-1;mesh.rotation.x=-sd*Math.atan2(dy-ey,ez-dz)+(sd<0?Math.PI:0)*0;
   mesh.lookAt(new V3(x,ey,sd*ez).applyMatrix4(fus.matrixWorld.clone()).sub(new V3()).clone().multiplyScalar(0));
   mesh.rotation.set(0,0,0);mesh.rotation.x=sd*Math.atan2(ey-dy,0)*0;
   // simple: tilt about local X so the slab runs from door (up, near) to ground (out, far)
   mesh.rotation.x=-sd*(Math.PI/2-Math.atan2(dy-ey,ez-dz));
   mesh.scale.set(1,1,0.01);mesh.userData.t=0;fus.add(mesh);slides.push(mesh);
  });
  const geo=this.paxGeo,mat=this.paxMat.clone();mat.color.set(0xffffff);
  const im=new THREE.InstancedMesh(geo,mat,n);im.castShadow=false;im.frustumCulled=false;
  const col=new THREE.Color();const P=[];
  for(let i=0;i<n;i++){
   const di=i%4,[dx,sd]=doors[di];_v.set(dx,-D.rf*0.2,sd*D.rf);fus.localToWorld(_v);
   const ex=new V3(dx,-D.gearH,sd*(D.rf+D.gearH*0.75));fus.localToWorld(ex);
   const a=Math.atan2(_v.z-ex.z,_v.x-ex.x)+0;const dir=new V3(ex.x-_v.x,0,ex.z-_v.z).normalize();
   const away=dir.clone().multiplyScalar(1).add(new V3(rnd2(-0.5,0.5),0,rnd2(-0.5,0.5))).normalize();
   P.push({d0:new V3(_v.x,Math.max(1.5,_v.y),_v.z),d1:new V3(ex.x,0,ex.z),away,delay:Math.floor(i/4)*0.9+rnd2(0,1.4),run:rnd2(55,105),spd:rnd2(3.6,5.6),ph:Math.random()*6});
   col.setHSL(Math.random(),rnd2(0.2,0.7),rnd2(0.25,0.6));im.setColorAt(i,col);
  }
  R3.scene.add(im);st.pax={mesh:im,P,t:0,slides,n};this.pax.push({mesh:im,e,m});
 },
 paxUpdate(dt){
  const dm=new THREE.Object3D();
  for(let k=this.pax.length-1;k>=0;k--){
   const px=this.pax[k],st=px.m.fx&&px.m.fx.pax;
   if(!st||px.e.dead||!R3.meshes.has(px.e.id)&&!px.e.crashed){R3.scene.remove(px.mesh);if(st)st.slides.forEach(s=>s.parent&&s.parent.remove(s));if(px.m.fx)px.m.fx.pax=null;this.pax.splice(k,1);continue;}
   st.t+=dt;
   st.slides.forEach(s=>{s.scale.z=Math.min(1,s.scale.z+dt*2.2)*(1)||0.01;if(s.scale.z<0.02)s.scale.z=0.02;});
   for(let i=0;i<st.n;i++){
    const p=st.P[i],tt=st.t-p.delay;
    if(tt<0){dm.position.set(0,-50,0);}
    else if(tt<1.1){const u=tt/1.1;dm.position.lerpVectors(p.d0,p.d1,u*u);dm.position.y=Math.max(0.9,p.d0.y*(1-u*u)+0.9);}
    else{const run=Math.min(p.run,(tt-1.1)*p.spd);dm.position.set(p.d1.x+p.away.x*run,0.86+Math.abs(Math.sin(tt*7+p.ph))*0.1*(run<p.run?1:0),p.d1.z+p.away.z*run);}
    dm.rotation.set(0,0,0);dm.scale.set(1,1,1);dm.updateMatrix();st.mesh.setMatrixAt(i,dm.matrix);
   }
   st.mesh.instanceMatrix.needsUpdate=true;
  }
 },
 /* ---------- fire truck cannons ---------- */
 truckFx(e,m,dt){
  if(!e.spray)return;const tg=G.ents.find(x=>x.id===e.spray);if(!tg||tg.dead||!(tg.fire>0)){return;}
  const d=Math.hypot(tg.x-e.x,tg.z-e.z);if(d>140)return;
  const n=this.n('tw'+e.id,260,dt);
  for(let i=0;i<n;i++){
   const dx=tg.x-e.x,dz=tg.z-e.z,L=Math.hypot(dx,dz)||1,sp=Math.min(40,Math.sqrt(d*9.8)*1.05),el=0.9;
   this.water(e.x+dx/L*2+rnd2(-0.3,0.3),4.8,e.z+dz/L*2+rnd2(-0.3,0.3),dx/L*sp*0.8+rnd2(-1,1),sp*0.62+rnd2(-1,1),dz/L*sp*0.8+rnd2(-1,1));
  }
 },
 /* wingtip vortices of heavies on approach / climb-out (they sink and linger, which is what the next aircraft flies into) */
 wakeVortex(e,m,dt){
  if(!e.type||e.type.wake!=='H'||e.y<2||e.y>260||(e.v||0)<45)return;const D=m.root.userData.dims;if(!D)return;
  const n=this.n('wv'+e.id,26,dt),c=Math.cos(e.th),s=Math.sin(e.th),hw=D.half*0.93;
  for(let i=0;i<n;i++)for(const sd of[-1,1]){
   const bx=e.x-c*D.L*0.18-s*sd*hw,bz=e.z-s*D.L*0.18+c*sd*hw;
   psEmit(this.smoke,bx+rnd2(-0.4,0.4),e.y+rnd2(1.5,3.5),bz+rnd2(-0.4,0.4),-s*sd*rnd2(0.2,1.0),-0.5,c*sd*rnd2(0.2,1.0),rnd2(9,14),rnd2(0.9,1.4),rnd2(5.5,8),[0.92,0.94,0.96],[0.8,0.82,0.86],0.09,0.12,0.05,0,0.4);}
 },
 /* airborne effects: engine contrails, wing condensation, tip vortices; F-14 afterburner */
 airFx(e,m,dt){
  if(!e.type||e.y<3||e.veh)return;const D=m.root.userData.dims,fus=m.root.userData.fus;if(!D||!fus)return;
  let sp=e.v||0;if(sp<40)return;if(typeof UI!=='undefined'&&UI.speed===0)sp=0;
  const c=Math.cos(e.th),s=Math.sin(e.th),T=e.type,L=D.L,hw=D.half,vy=e.vs||0;
  const wet=(G.wx==='rain'||G.wx==='storm')?1:(G.wx==='clear'?0.35:0.7);
  const load=clamp((e.pitch||0)*8+vy*0.05+(e.phase==='GOAROUND'||e.phase==='CLIMB'||e.phase==='ROLL'?0.5:0)+(e.phase==='APPROACH'?0.25:0),0,1.2);
  const big=clamp(L/45,0.5,1.8),f14=T.n==='F14';
  m.holder.updateMatrixWorld(true);
  // wing-surface condensation: mist over the upper wing and flap roots when heavily loaded in damp air (rotation, climb-out, flare, go-around)
  if(e.y<420&&!T.heli&&!T.prop){const rate=load*wet*(f14?55:75)*big;const n=this.n('wc'+e.id,rate,dt);
   for(let i=0;i<n;i++)for(const sd of[-1,1]){if(Math.random()<0.5)continue;
    const u=rnd2(0.25,0.95),fx=-L*rnd2(0.05,0.2),lat=sd*hw*u;
    const bx=e.x+c*fx-s*lat,bz=e.z+s*fx+c*lat;
    psEmit(this.smoke,bx,e.y+(D.wy||0)+rnd2(0.4,1.1),bz,-c*sp*0.25+rnd2(-0.3,0.3),0.2,-s*sp*0.25+rnd2(-0.3,0.3),rnd2(0.5,1.1),rnd2(0.8,1.4),rnd2(2.5,4.2)*big*0.7,[0.95,0.97,1],[0.88,0.9,0.94],0.28*Math.min(1,load*wet+0.1),0,1.6,0,0);}}
  // tip vortices: thin condensation cores streaming from both wingtips (all types; stronger when loaded and humid)
  if(e.y<600&&!T.heli){const tv=(0.25+load)*(0.35+wet)*(T.wake==='H'?1.3:1);const n=this.n('tv'+e.id,28*tv,dt);
   for(let i=0;i<n;i++)for(const sd of[-1,1]){
    const bx=e.x-c*L*0.16-s*sd*hw*0.98,bz=e.z-s*L*0.16+c*sd*hw*0.98;
    const ph=(performance.now()/110+sd)*1.0,sw=Math.min(1.2,0.3+sp/120);
    psEmit(this.smoke,bx+rnd2(-0.12,0.12),e.y+(D.wy||0)+0.3,bz+rnd2(-0.12,0.12),-c*sp*0.12-s*Math.cos(ph)*sw*sd*0.5,-0.7,-s*sp*0.12+c*Math.cos(ph)*sw*sd*0.5,rnd2(1.8,3.2),rnd2(0.25,0.45),rnd2(1.2,2.2),[1,1,1],[0.85,0.88,0.93],0.32*Math.min(1,tv),0,0.6,0,0.2);}}
  // engine contrails at altitude (game-scale: from ~150 m, thicker with more engines)
  if(e.y>150&&!T.prop){const eng=T.eng||2,n=this.n('ct'+e.id,(10+eng*6)*clamp(wet+0.3,0.4,1.3),dt);
   for(let i=0;i<n;i++){const k=eng>=4?[-0.45,-0.2,0.2,0.45][i%4]:eng===2?(i%2?0.28:-0.28):0;
    const lat=k*hw*(f14?0.12:1),fx=-L*0.5;
    psEmit(this.smoke,e.x+c*fx-s*lat,e.y-1+rnd2(-0.4,0.4),e.z+s*fx+c*lat,rnd2(-0.4,0.4),0.1,rnd2(-0.4,0.4),rnd2(14,26),rnd2(0.8,1.4),rnd2(7,13)*big,[0.97,0.98,1],[0.86,0.9,0.95],0.28,0,0.1,0,0.5);}}
  // F-14 afterburner while flying to the landing position (off on final)
  if(f14&&this.f14AB(e)){const engs=fus.userData.engs||[];const sc=1+(e.phase==='ROLL'||e.phase==='GOAROUND'?0.2:0);
   for(const g of engs){_v.set(-10.0,0,0);g.localToWorld(_v);const nx=_v.x,ny=_v.y,nz=_v.z,bv=-1;
    const n=this.n('ab'+e.id+g.userData.side,420,dt);
    for(let i=0;i<n;i++){const u=Math.random();const d=u*u*11*sc;
     const ox=nx-c*d+rnd2(-0.05,0.05),oy=ny+rnd2(-0.05,0.05),oz=nz-s*d+rnd2(-0.05,0.05),w=1.1*(1-u*0.65)*(1+0.3*Math.sin(d*2.2));
     const vv=sp-30-u*20;
     psEmit(this.glow,ox,oy,oz,c*vv*0.98+rnd2(-0.2,0.2),rnd2(-0.2,0.2),s*vv*0.98+rnd2(-0.2,0.2),rnd2(0.1,0.2),w*1.5,w*0.5,u<0.35?[0.85,0.92,1]:[1,0.72,0.3],[1,0.25,0.05],0.95,0,0.3,0,0);}
    // shock diamonds: bright beads along the plume
    for(let k=0;k<4;k++){const d=0.9+k*1.25;psEmit(this.glow,nx-c*d,ny,nz-s*d,c*(sp-30),0,s*(sp-30),0.06,1.1-k*0.15,0.7,[1,0.95,0.85],[1,0.7,0.35],0.9,0,0,0,0);}
    // hot exhaust haze
    if(Math.random()<dt*50)psEmit(this.smoke,nx-c*8,ny,nz-s*8,c*sp*0.8,0.3,s*sp*0.8,rnd2(2,4),0.8,3.5,[0.5,0.5,0.52],[0.7,0.72,0.75],0.1,0,0.5,0,0.3);}}
 },
 f14AB(e){const nm=e.type.n;if(nm!=='F14')return false;if(e.y<20)return e.phase==='ROLL';
  if(e.phase==='APPROACH')return (e.D||0)>4.5*NM||(e.y>500);
  return ['GOAROUND','CLIMB','RETURN','TRANSIT','FLYPAST','VLEAVE','VHOLD'].includes(e.phase);},
 /* tyre smoke when the main gear touches down */
 tdSmoke(e,m,dt){
  if(e.tdT==null||e.y>1.5)return;const D=m.root.userData.dims;if(!D)return;
  const st=m.fx||(m.fx={});if(st.tdSeen!==e.tdT){st.tdSeen=e.tdT;st.tdE=0;}
  if(st.tdE===0&&typeof Amb!=='undefined')Amb.touch(e);
  st.tdE+=dt;const k=st.tdE;if(k>2.2||(e.v||0)<22)return;
  const hard=e.tdHard||0,w=(e.type&&e.type.wing)||30,big=Math.min(1.6,0.6+(e.type&&e.type.len||40)/70);
  const rate=(k<0.25?1500:420*Math.pow(1-k/2.2,1.2))*(0.7+0.7*hard)*big;
  const n=this.n('td'+e.id,rate,dt),c=Math.cos(e.th),s=Math.sin(e.th);
  const sides=D.mz>0.5?[-1,1]:[0];
  for(let i=0;i<n;i++){
   const sd=sides[(Math.random()*sides.length)|0],f=rnd2(-1.5,1.5);
   const bx=e.x+c*(D.mainX+f)-s*sd*D.mz,bz=e.z+s*(D.mainX+f)+c*sd*D.mz;
   const v=e.v||0,sz=rnd2(1.2,2.2)*big;
   psEmit(this.smoke,bx,rnd2(0.1,0.5),bz,c*v*0.12+rnd2(-0.8,0.8)+(-s*sd)*rnd2(0.2,1.4),rnd2(0.2,0.9),s*v*0.12+rnd2(-0.8,0.8)+(c*sd)*rnd2(0.2,1.4),rnd2(2.6,4.4),sz,sz*rnd2(3.6,5.2),[0.93,0.93,0.94],[0.72,0.73,0.75],rnd2(0.45,0.75)*(0.6+0.4*hard),0,1.4,0.35,0.5);
  }
 },
 frame(dt,t){
  if(!R3.ok)return;this.init();if(!this.ready)return;dt=Math.min(dt,0.1);
  const cam=R3.camera,hpx=R3.renderer.domElement.height||600,sc=hpx/(2*Math.tan(cam.fov*Math.PI/360));
  this.glow.mat.uniforms.uScale.value=sc;this.smoke.mat.uniforms.uScale.value=sc;
  if(typeof G!=='undefined'&&G.ents){
   for(const e of G.ents){
    const m=R3.meshes.get(e.id);if(!m)continue;
    if(e.veh){if(e.vt==='fire')this.truckFx(e,m,dt);continue;}
    if(e.crashed||m.holder.userData.wreck)continue;
    this.tdSmoke(e,m,dt);this.wakeVortex(e,m,dt);try{this.airFx(e,m,dt);}catch(er){if(!this._e3){this._e3=1;console.warn('airFx',er);}}
    try{this.entityFx(e,m,dt);}catch(er){if(!this._err){this._err=1;console.warn('fx',er);}}
   }
  }
  this.crashUpdate(dt,t);this.partsUpdate(dt);this.srcUpdate(dt);this.paxUpdate(dt);
  const w=this.windVec();psUpdate(this.glow,dt,w[0],w[1]);psUpdate(this.smoke,dt,w[0],w[1]);
 }
};
(function(){
 const _c=R3.clear;
 R3.preRender=function(dt,t){try{FX.frame(dt,t);}catch(e){if(!FX._e2){FX._e2=1;console.warn('fx frame',e);}}};
 R3.clear=function(){_c.call(this);FX.reset();};
})();
