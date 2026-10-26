'use strict';
/* =====================================================================
   GFX — realism upgrade for the 3D view (loaded after r3d.js; overrides R3 methods)
   PBR materials, sRGB + ACES tone-mapping, sun shadows, image-based lighting from the sky,
   displaced terrain with an aerial-photo style ground texture, trees, lofted aircraft with
   canvas liveries, glowing airfield lights.
   ===================================================================== */
(function(){
const lin=h=>new THREE.Color(h).convertSRGBToLinear();
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const rn=mulberry(20240611);
function hash2(ix,iz){let h=(Math.imul(ix,374761393)+Math.imul(iz,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296;}
function vn(x,z,P){const ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz,u=fx*fx*(3-2*fx),v=fz*fz*(3-2*fz);
 const w=P?(q=>((q%P)+P)%P):(q=>q);
 const a=hash2(w(ix),w(iz)),b=hash2(w(ix+1),w(iz)),c=hash2(w(ix),w(iz+1)),d=hash2(w(ix+1),w(iz+1));return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm(x,z,o){let s=0,a=0.5,f=1;for(let i=0;i<(o||5);i++){s+=a*vn(x*f,z*f);f*=2.03;a*=0.5;}return s;}
const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')];};
function toTex(c,o){o=o||{};const t=new THREE.CanvasTexture(c);t.encoding=o.linear?THREE.LinearEncoding:THREE.sRGBEncoding;t.anisotropy=o.aniso||R3.maxAniso||4;if(o.repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;return t;}
function noiseFill(x,w,h,r,g,b,amp,seed){const id=x.createImageData(w,h),d=id.data,R=mulberry(seed||1);for(let i=0;i<w*h;i++){const n=(R()+R()+R()-1.5)*amp;d[i*4]=r+n;d[i*4+1]=g+n;d[i*4+2]=b+n;d[i*4+3]=255;}x.putImageData(id,0,0);}

/* ---------- terrain height (airport itself is dead flat) ---------- */
const TW=44000;
function H(x,z){
 const r=Math.hypot(x,z*0.9);const m=smooth(3600,9500,r)*(1-smooth(17500,21500,r));if(m<=0)return 0;
 const corr=0.1+0.9*smooth(700,3800,Math.abs(z));
 const n=fbm(x/3200+11,z/3200+7,5),rd=1-Math.abs(fbm(x/5200+3,z/5200+9,4)*2-1);
 return m*corr*(Math.max(0,n-0.30)*620+rd*rd*130*smooth(8000,16000,r));
}
window.GX={H};

/* ---------- procedural textures ---------- */
function asphaltCanvas(){const[c,x]=cv(512,512);noiseFill(x,512,512,56,60,65,20,5);
 for(let i=0;i<70;i++){x.fillStyle='rgba('+(rn()<0.5?'20,22,26':'90,94,98')+','+(0.04+rn()*0.07)+')';x.beginPath();x.ellipse(rn()*512,rn()*512,10+rn()*50,6+rn()*30,rn()*3,0,6.28);x.fill();}
 x.strokeStyle='rgba(15,16,18,0.35)';x.lineWidth=1;for(let i=0;i<26;i++){x.beginPath();let px=rn()*512,py=rn()*512;x.moveTo(px,py);for(let k=0;k<6;k++){px+=(rn()-0.5)*40;py+=(rn()-0.5)*40;x.lineTo(px,py);}x.stroke();}
 return c;}
function concreteCanvas(){const[c,x]=cv(512,512);noiseFill(x,512,512,128,130,133,16,9);
 for(let i=0;i<2;i++)for(let j=0;j<2;j++){x.fillStyle='rgba(255,255,255,'+((rn()-0.5)*0.07)+')';x.fillRect(i*256,j*256,256,256);}
 for(let i=0;i<30;i++){x.fillStyle='rgba(40,38,34,'+(0.03+rn()*0.05)+')';x.beginPath();x.ellipse(rn()*512,rn()*512,6+rn()*30,4+rn()*14,rn()*3,0,6.28);x.fill();}
 x.fillStyle='rgba(66,70,74,0.4)';for(const p of[0,256]){x.fillRect(p-1,0,2,512);x.fillRect(0,p-1,512,2);}x.fillRect(510,0,2,512);x.fillRect(0,510,512,2);
 return c;}
function detailCanvas(){const[c,x]=cv(256,256),id=x.createImageData(256,256),d=id.data,R=mulberry(77);
 for(let j=0;j<256;j++)for(let i=0;i<256;i++){let v=0.5+(vn(i/32,j/32,8)-0.5)*0.35+(vn(i/8,j/8,32)-0.5)*0.22+(R()-0.5)*0.30;v=Math.max(0,Math.min(1,v))*255;const k=(j*256+i)*4;d[k]=d[k+1]=d[k+2]=v;d[k+3]=255;}
 x.putImageData(id,0,0);return c;}
function glowTex(){const[c,x]=cv(64,64);const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(0.18,'rgba(255,255,255,0.8)');g.addColorStop(0.5,'rgba(255,255,255,0.18)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
function cloudTex(){const[c,x]=cv(256,128);for(let i=0;i<46;i++){const px=40+rn()*176,py=64+(rn()-0.5)*34*(1-Math.abs(px-128)/128+0.2),r=14+rn()*30;const g=x.createRadialGradient(px,py,0,px,py,r);const a=0.22+rn()*0.25;g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(0.6,'rgba(250,252,255,'+a*0.5+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(px-r,py-r,r*2,r*2);}
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}

/* aerial-photo style ground: fields, hedges, woods, villages, roads, a river */
function aerial(){
 const S=4096,[c,x]=cv(S,S),k=S/TW,cx=wx=>(wx+TW/2)*k;
 noiseFill(x,S,S,70,98,48,12,3);
 x.fillStyle='#46663a';x.globalAlpha=0.5;for(let i=0;i<300;i++){x.beginPath();x.ellipse(rn()*S,rn()*S,40+rn()*160,30+rn()*120,rn()*3,0,6.28);x.fill();}x.globalAlpha=1;
 const pal=['#587a3a','#66863f','#728f45','#8d9a48','#a39a52','#b0a56a','#4c6a34','#58773f','#7a6a46','#66543a','#82984f','#3f5c2d'];
 const hedge=[];
 for(let i=0;i<820;i++){const px=(rn()-0.5)*TW*0.92,pz=(rn()-0.5)*TW*0.92;if(Math.abs(px)<3000&&Math.abs(pz)<1300)continue;
  const w=120+rn()*520,h=100+rn()*420,ang=(hash2(Math.floor(px/9000),Math.floor(pz/9000))<0.5?0.32:1.88)+(rn()-0.5)*0.18;
  x.save();x.translate(cx(px),cx(pz));x.rotate(ang);x.fillStyle=pal[(rn()*pal.length)|0];x.fillRect(-w*k/2,-h*k/2,w*k,h*k);
  if(rn()<0.55){x.strokeStyle='rgba('+(rn()<0.5?'150,135,90':'60,85,45')+',0.35)';x.lineWidth=0.7;const st=2+rn()*2.5;for(let q=-w*k/2;q<w*k/2;q+=st){x.beginPath();x.moveTo(q,-h*k/2);x.lineTo(q,h*k/2);x.stroke();}}
  x.strokeStyle='rgba(35,55,28,0.55)';x.lineWidth=1.2;x.strokeRect(-w*k/2,-h*k/2,w*k,h*k);x.restore();hedge.push([px,pz,w,h,ang]);}
 // mown airfield grass and bare strip around the runway
 let g=x.createRadialGradient(cx(0),cx(0),0,cx(0),cx(0),2900*k);g.addColorStop(0,'rgba(88,120,58,1)');g.addColorStop(0.75,'rgba(88,120,58,0.92)');g.addColorStop(1,'rgba(88,120,58,0)');
 x.save();x.translate(cx(0),cx(0));x.scale(1,0.38);x.translate(-cx(0),-cx(0));x.fillStyle=g;x.beginPath();x.arc(cx(0),cx(0),2900*k,0,6.28);x.fill();x.restore();
 x.fillStyle='rgba(106,134,70,0.5)';x.fillRect(cx(-1560),cx(-60),3120*k,120*k);
 // woods
 const woods=[];
 for(let i=0;i<78;i++){const px=(rn()-0.5)*TW*0.9,pz=(rn()-0.5)*TW*0.9,r=110+rn()*420;if(Math.hypot(px,pz*1.5)<2600)continue;if(Math.abs(pz)<300&&Math.abs(px)<5200)continue;
  woods.push([px,pz,r]);const n=Math.floor(r*r*k*k*0.55)+14;
  for(let q=0;q<n;q++){const a=rn()*6.28,d=Math.sqrt(rn())*r*(0.75+0.25*vn(a*3,i));x.fillStyle=['#2d4a26','#335429','#3b5e2d','#294421','#476b33'][(rn()*5)|0];x.beginPath();x.arc(cx(px+Math.cos(a)*d),cx(pz+Math.sin(a)*d),1.6+rn()*2.4,0,6.28);x.fill();}}
 // roads + villages
 const vill=[];for(let i=0;i<16;i++){const px=(rn()-0.5)*TW*0.8,pz=(rn()-0.5)*TW*0.8;if(Math.hypot(px,pz*1.4)<3800)continue;if(Math.abs(pz)<260&&Math.abs(px)<5200)continue;vill.push([px,pz]);}
 x.strokeStyle='rgba(176,170,158,0.9)';x.lineWidth=1.5;
 const link=(a,b)=>{x.beginPath();x.moveTo(cx(a[0]),cx(a[1]));const mx=(a[0]+b[0])/2+(rn()-0.5)*1200,mz=(a[1]+b[1])/2+(rn()-0.5)*1200;x.quadraticCurveTo(cx(mx),cx(mz),cx(b[0]),cx(b[1]));x.stroke();};
 for(let i=0;i<vill.length;i++)link(vill[i],vill[(i+1)%vill.length]);link([0,-600],[-6000,-5200]);link([0,-600],[7000,-4200]);
 x.lineWidth=2.4;x.strokeStyle='rgba(150,146,138,0.95)';x.beginPath();x.moveTo(cx(-TW/2),cx(-560));x.lineTo(cx(-3000),cx(-560));x.stroke();x.beginPath();x.moveTo(cx(3000),cx(-560));x.lineTo(cx(TW/2),cx(-560));x.stroke();
 for(const v of vill){for(let q=0;q<38;q++){const a=rn()*6.28,d=Math.sqrt(rn())*520;x.fillStyle=['#b9aea0','#9c6b55','#c8c0b4','#8a8f95','#a8553f'][(rn()*5)|0];x.fillRect(cx(v[0]+Math.cos(a)*d),cx(v[1]+Math.sin(a)*d),2.4+rn()*2.4,1.8+rn()*1.8);}}
 // river
 x.lineCap='round';x.lineJoin='round';
 for(const [lw,col] of [[5.2,'rgba(70,90,60,0.8)'],[3.4,'#6d95a8']]){x.strokeStyle=col;x.lineWidth=lw;x.beginPath();for(let t=0;t<=1.0001;t+=0.01){const wx=(t-0.5)*TW,wz=3900+Math.sin(t*9)*900+Math.sin(t*23)*160+t*3800;if(t===0)x.moveTo(cx(wx),cx(wz));else x.lineTo(cx(wx),cx(wz));}x.stroke();}
 return {canvas:c,woods,hedge,vill};
}

/* ---------- materials ---------- */
const PO=(f,u)=>({polygonOffset:true,polygonOffsetFactor:f,polygonOffsetUnits:u});
R3.makeMats=function(){
 const S=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:lin(c)},o));
 const asphT=toTex(asphaltCanvas(),{repeat:1}),concT=toTex(concreteCanvas(),{repeat:1});
 this.tex={asph:asphT,conc:concT};
 const M={};
 M.taxi=new THREE.MeshStandardMaterial(Object.assign({map:asphT,color:lin(0xdddddd),roughness:0.9,metalness:0,envMapIntensity:0.25},PO(-1,-1)));
 M.shoulder=new THREE.MeshStandardMaterial(Object.assign({map:asphT,color:lin(0x9a9a9a),roughness:0.95,metalness:0,envMapIntensity:0.2},PO(-1,-1)));
 M.apron=new THREE.MeshStandardMaterial(Object.assign({map:concT,color:lin(0xc4c4c4),roughness:0.85,metalness:0,envMapIntensity:0.3},PO(-1,-1)));
 M.yellow=S(0xe0b92e,Object.assign({roughness:0.6,envMapIntensity:0.2},PO(-3,-3)));
 M.whiteB=S(0xf0f0ea,Object.assign({roughness:0.6,envMapIntensity:0.2},PO(-3,-3)));
 M.white=S(0xf1f3f5,{roughness:0.4,metalness:0.1});M.dark=S(0x1a2128,{roughness:0.55,metalness:0.2});M.gray=S(0x8b949b,{roughness:0.8});
 M.concrete=S(0xb8bcbf,{roughness:0.9});M.roof=S(0x6e757b,{roughness:0.8});M.steel=S(0xa5adb4,{roughness:0.4,metalness:0.7});
 M.metalWhite=S(0xe4e7ea,{roughness:0.45,metalness:0.4});
 this.mat=M;
};

/* ---------- renderer ---------- */
R3.init=function(canvas,labelBox){
 this.canvas=canvas;this.labelBox=labelBox;
 try{this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){this.ok=false;return false;}
 try{
  const r=this.renderer;r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  r.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1;
  r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;this.maxAniso=Math.min(16,r.capabilities.getMaxAnisotropy());
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(52,1,2,70000);
  this.hemi=new THREE.HemisphereLight(0xffffff,0x445533,0.4);this.scene.add(this.hemi);
  const sun=this.sun=new THREE.DirectionalLight(0xffffff,2.5);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
  const sc=sun.shadow.camera;sc.left=-560;sc.right=560;sc.top=560;sc.bottom=-560;sc.near=50;sc.far=5000;sun.shadow.bias=-0.0003;sun.shadow.normalBias=0.35;sc.updateProjectionMatrix();
  this.scene.add(sun);this.scene.add(sun.target);this.sunDir=new THREE.Vector3(0.35,0.72,-0.55).normalize();
  this.litMats=[];this.acMats=[];this.liv=new Map();this.glow=glowTex();
  this.makeMats();this.buildSky();this.buildWorld();this.buildGateEquip();
  this.paxGeo=new THREE.BufferGeometry();this.paxPos=new Float32Array(600*3);this.paxCol=new Float32Array(600*3);
  this.paxGeo.setAttribute('position',new THREE.BufferAttribute(this.paxPos,3));this.paxGeo.setAttribute('color',new THREE.BufferAttribute(this.paxCol,3));
  this.paxPts=new THREE.Points(this.paxGeo,new THREE.PointsMaterial({size:1.3,vertexColors:true,sizeAttenuation:true}));this.paxPts.frustumCulled=false;this.scene.add(this.paxPts);
  this.selRing=new THREE.Mesh(new THREE.RingGeometry(1,1.12,48),new THREE.MeshBasicMaterial({color:0xffb22e,side:THREE.DoubleSide,transparent:true,opacity:0.9,depthWrite:false,toneMapped:false}));
  this.selRing.rotation.x=-Math.PI/2;this.selRing.visible=false;this.scene.add(this.selRing);
  this.applyTOD(this.tod);this.ok=true;this.bindInput();this.resize();return true;
 }catch(e){console.error('3D init failed',e);this.ok=false;return false;}
};

/* ---------- sky, sun, image based lighting ---------- */
R3.buildSky=function(){
 this.skyU={top:{value:new THREE.Color()},hor:{value:new THREE.Color()},ground:{value:new THREE.Color()},sunDir:{value:new THREE.Vector3(0,1,0)},sunCol:{value:new THREE.Color()},night:{value:0},glow:{value:1}};
 this.skyMat=new THREE.ShaderMaterial({uniforms:this.skyU,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:'varying vec3 vp;void main(){vp=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:'uniform vec3 top;uniform vec3 hor;uniform vec3 ground;uniform vec3 sunDir;uniform vec3 sunCol;uniform float night;uniform float glow;varying vec3 vp;'+
  'float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'+
  'void main(){vec3 v=normalize(vp);float h=v.y;vec3 col=mix(hor,top,pow(clamp(h,0.,1.),0.5));col=mix(col,hor,exp(-max(h,0.)*5.0)*0.4);'+
  'float sd=max(dot(v,normalize(sunDir)),0.);col+=sunCol*(pow(sd,5.)*0.16*glow+pow(sd,48.)*0.30*glow+pow(sd,2200.)*4.0);'+
  'col=mix(col,sunCol*0.9,pow(sd,3.)*exp(-abs(h)*8.)*0.30*glow);col=mix(col,ground,smoothstep(0.,-0.06,h));'+
  'if(night>0.01&&h>0.){vec2 q=floor(vec2(atan(v.z,v.x)*210.,h*420.));float s=h21(q);float st=step(0.9972,s)*(0.35+0.65*h21(q+7.));col+=vec3(st)*night*smoothstep(0.03,0.3,h);}'+
  'gl_FragColor=vec4(col,1.);\n'+
  '#include <tonemapping_fragment>\n#include <encodings_fragment>\n}'});
 this.sky=new THREE.Mesh(new THREE.SphereGeometry(40000,32,20),this.skyMat);this.sky.renderOrder=-10;this.scene.add(this.sky);
 this.envScene=new THREE.Scene();this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50,24,16),this.skyMat));
 this.cloudMats=[];this.clouds=new THREE.Group();const ct=cloudTex();
 for(let i=0;i<64;i++){const m=new THREE.SpriteMaterial({map:ct,transparent:true,opacity:0.7,depthWrite:false,fog:false});this.cloudMats.push(m);const s=new THREE.Sprite(m);
  const a=rn()*6.28,r=2500+rn()*24000;s.position.set(Math.cos(a)*r,1300+rn()*1100,Math.sin(a)*r);const w=3200+rn()*5200;s.scale.set(w,w*0.42,1);this.clouds.add(s);}
 this.scene.add(this.clouds);
};
R3.applyTOD=function(mode){
 const T={
  day:{top:0x2f6dc0,hor:0xb2cfe6,fog:0xb2cfe6,sun:[0.35,0.72,-0.55],sunCol:0xfff1d8,si:3.0,hemi:[0x9cc3ff,0x586a3c,0.4],exp:0.88,lights:0.05,win:0,cloud:0xffffff,co:0.78,glow:1,night:0,env:1},
  dusk:{top:0x1b2a5c,hor:0xe9a46c,fog:0xa58b8e,sun:[-0.9,0.12,-0.42],sunCol:0xff9d57,si:2.4,hemi:[0x7d8fd0,0x3a3340,0.45],exp:1.05,lights:0.85,win:0.7,cloud:0xffb88a,co:0.7,glow:1.7,night:0,env:0.8},
  night:{top:0x02050f,hor:0x101a33,fog:0x0b1428,sun:[0.4,0.55,0.35],sunCol:0x9db2ee,si:0.5,hemi:[0x4a5f9a,0x141a28,0.4],exp:1.15,lights:1,win:1,cloud:0x233050,co:0.0,glow:0.15,night:1,env:0.5}
 };
 const P=T[mode];if(!P)return;this.tod=mode;this.P=P;const U=this.skyU;
 U.top.value.copy(lin(P.top));U.hor.value.copy(lin(P.hor));U.ground.value.copy(lin(P.fog));U.sunCol.value.copy(lin(P.sunCol));U.night.value=P.night;U.glow.value=P.glow;
 this.sunDir.set(P[ 'sun'][0],P.sun[1],P.sun[2]).normalize();U.sunDir.value.copy(this.sunDir);
 this.fogHex=P.fog;this.setFog(!!(window.G&&G.fog));
 this.hemi.color.copy(lin(P.hemi[0]));this.hemi.groundColor.copy(lin(P.hemi[1]));this.hemi.intensity=P.hemi[2];
 this.sun.color.copy(lin(P.sunCol));this.sun.intensity=P.si;this.renderer.toneMappingExposure=P.exp;
 this.cloudMats.forEach(m=>{m.color.copy(lin(P.cloud));m.opacity=P.co;});this.clouds.visible=P.co>0;
 if(this.lightMat)this.lightMat.forEach(m=>m.opacity=P.lights);
 this.litMats.forEach(m=>{m.emissiveIntensity=(m.userData.k||1)*P.win;});this.acMats.forEach(m=>m.emissiveIntensity=P.win*1.3);
 if(this.lampMat)this.lampMat.color.copy(lin(0xffe2a8)).multiplyScalar(0.25+P.lights*4);
 try{
  if(!this.pmrem)this.pmrem=new THREE.PMREMGenerator(this.renderer);
  const rt=this.pmrem.fromScene(this.envScene,0.02,1,100);if(this.envRT)this.envRT.dispose();this.envRT=rt;this.scene.environment=rt.texture;this.scene.environmentIntensity=P.env;
 }catch(e){console.warn('env map failed',e);}
};
R3.setFog=function(low){
 if(!this.P)return;const P=this.P;let col=lin(P.fog),d=this.tod==='night'?0.00005:0.000058;
 if(low){col=lin(this.tod==='night'?0x1a2234:this.tod==='dusk'?0x7a6e72:0x9aa5ae);d=0.0011;}
 this.scene.fog=new THREE.FogExp2(col,d);this.skyU.ground.value.copy(col);this.skyU.hor.value.copy(low?col:lin(P.hor));
 this.skyU.top.value.copy(low?col.clone().lerp(lin(P.top),0.25):lin(P.top));
};

/* ---------- world ---------- */
R3.box=function(w,h,d,mat,x,y,z,parent,shadow){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);if(shadow!==false){m.castShadow=true;m.receiveShadow=true;}(parent||this.scene).add(m);return m;};
R3.txtPlane=function(text,w,h,fg,bg,font){
 const c=document.createElement('canvas');c.width=256;c.height=Math.max(64,Math.round(256*h/w));const x=c.getContext('2d');
 if(bg){x.fillStyle=bg;x.fillRect(0,0,c.width,c.height);}
 x.fillStyle=fg;x.font=font||('bold '+Math.round(c.height*0.8)+'px "Barlow Condensed",Arial Narrow,Arial');x.textAlign='center';x.textBaseline='middle';x.fillText(text,c.width/2,c.height/2+2);
 const t=toTex(c);return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial(Object.assign({map:t,transparent:true,roughness:0.7,depthWrite:false},PO(-4,-4))));
};
function flat(w,d,mat,x,y,z,rot,tile){const g=new THREE.PlaneGeometry(w,d);g.rotateX(-Math.PI/2);
 if(tile){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*w/tile,uv.getY(i)*d/tile);}
 const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.rotation.y=rot||0;m.receiveShadow=true;R3.scene.add(m);return m;}
function runwayTex(){
 const big=R3.renderer.capabilities.maxTextureSize>=8192,W=big?8192:4096,Hh=big?512:256,[c,x]=cv(W,Hh);x.fillStyle=x.createPattern(asphaltCanvas(),'repeat');x.fillRect(0,0,W,Hh);
 const sx=W/3000,sy=Hh/45;x.save();x.scale(sx,sy);x.translate(1500,22.5);
 for(const s of[-1,1])for(let k=0;k<30;k++){const px=s*(1450-260-rn()*380),pz=(rn()<0.5?-1:1)*(0.8+rn()*5.5);x.fillStyle='rgba(6,6,8,'+(0.10+rn()*0.16)+')';x.beginPath();x.ellipse(px,pz,6+rn()*16,0.4+rn()*0.9,0,0,6.28);x.fill();}
 x.fillStyle='rgba(0,0,0,0.09)';x.fillRect(-1450,-5.5,2900,11);
 x.fillStyle='rgba(0,0,0,0.14)';x.fillRect(-1500,-22.5,50,45);x.fillRect(1450,-22.5,50,45);
 x.strokeStyle='rgba(222,184,48,0.95)';x.lineWidth=0.7;for(const s of[-1,1])for(let k=0;k<3;k++){const bx=s*(1498-k*14);x.beginPath();x.moveTo(bx,-17);x.lineTo(bx-s*10,0);x.lineTo(bx,17);x.stroke();}
 x.fillStyle='rgba(242,242,236,0.95)';
 x.fillRect(-1500,-21.4,3000,0.9);x.fillRect(-1500,20.5,3000,0.9);
 for(let px=-1400;px<1360;px+=50)x.fillRect(px,-0.45,30,0.9);
 for(let k=-8;k<=8;k++){if(k===0)continue;x.fillRect(-1444,k*2.4-0.65,30,1.3);x.fillRect(1414,k*2.4-0.65,30,1.3);}
 for(const z of[-14,8]){x.fillRect(-1150,z,60,6);x.fillRect(1090,z,60,6);}
 for(const d of[450,600,750,900])for(const z of[-8.2,-5.2,3.4,6.4]){x.fillRect(-1450+d,z,22,1.8);x.fillRect(1450-d-22,z,22,1.8);}
 x.font='bold 21px Arial';x.textAlign='center';x.textBaseline='middle';
 x.save();x.translate(-1385,0);x.rotate(Math.PI/2);x.fillText('09',0,0);x.restore();
 x.save();x.translate(1385,0);x.rotate(-Math.PI/2);x.fillText('27',0,0);x.restore();
 x.restore();return toTex(c,{aniso:R3.maxAniso});
}
R3.buildWorld=function(){
 const S=this.scene,M=this.mat;this.lightMat=[];
 // --- terrain ---
 const A=aerial();this.aer=A;
 const tg=new THREE.PlaneGeometry(TW,TW,220,220);tg.rotateX(-Math.PI/2);
 const p=tg.attributes.position,col=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),h=H(x,z);p.setY(i,h-0.35);
  const rock=smooth(110,330,h),tone=0.86+0.2*fbm(x/1800+5,z/1800+2,3);
  col[i*3]=tone*(1-rock*0.25);col[i*3+1]=tone*(1-rock*0.32);col[i*3+2]=tone*(1-rock*0.42);}
 tg.setAttribute('color',new THREE.BufferAttribute(col,3));tg.computeVertexNormals();
 const det=toTex(detailCanvas(),{repeat:1,linear:true});
 const tm=new THREE.MeshStandardMaterial(Object.assign({map:toTex(A.canvas,{aniso:this.maxAniso}),vertexColors:true,roughness:1,metalness:0,envMapIntensity:0.55},PO(2,2)));
 tm.onBeforeCompile=sh=>{sh.uniforms.detail={value:det};
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D detail;')
   .replace('#include <map_fragment>','#include <map_fragment>\n float dd=length(vViewPosition);vec3 d1=texture2D(detail,vUv*1500.).rgb;vec3 d2=texture2D(detail,vUv*150.).rgb;diffuseColor.rgb*=mix(vec3(1.0),d1*1.15+0.43,smoothstep(2200.,250.,dd))*mix(vec3(1.0),d2*1.1+0.45,smoothstep(14000.,1500.,dd));');};
 const terr=new THREE.Mesh(tg,tm);terr.receiveShadow=true;S.add(terr);this.terrain=terr;
 // --- trees ---
 const tc=[0x2f4f27,0x365a2c,0x3f6431,0x2a4524,0x4a6c34,0x58733a],maxT=6500;
 const crown=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,envMapIntensity:0.4}),maxT);
 const dm=new THREE.Object3D();let nt=0;const put=(x,z,sz)=>{if(nt>=maxT)return;const y=H(x,z);dm.position.set(x,y+sz*1.5,z);dm.scale.set(sz,sz*1.45,sz);dm.rotation.y=rn()*6;dm.updateMatrix();crown.setMatrixAt(nt,dm.matrix);crown.setColorAt(nt,lin(tc[(rn()*tc.length)|0]));nt++;};
 for(const [wx,wz,r] of A.woods){const n=Math.min(110,Math.floor(r*r/2600)+10);for(let q=0;q<n;q++){const a=rn()*6.28,d=Math.sqrt(rn())*r*0.92;put(wx+Math.cos(a)*d,wz+Math.sin(a)*d,3.4+rn()*3.4);}}
 for(let i=0;i<700;i++){const hf=A.hedge[(rn()*A.hedge.length)|0];if(!hf)continue;const t=rn(),ca=Math.cos(hf[4]),sa=Math.sin(hf[4]);const lx=(t-0.5)*hf[2],lz=(rn()<0.5?-0.5:0.5)*hf[3];put(hf[0]+lx*ca-lz*sa,hf[1]+lx*sa+lz*ca,2.4+rn()*1.8);}
 for(let i=0;i<260;i++){const px=(rn()<0.5?-1:1)*(300+rn()*2800),pz=(rn()<0.5?-1:1)*(180+rn()*520);if(Math.abs(pz)<230)continue;if(Math.abs(pz+400)<130&&Math.abs(px)<1500)continue;if(pz<-200&&pz>-620&&Math.abs(px)<1550)continue;put(px,pz,2.6+rn()*2);}
 crown.count=nt;crown.instanceMatrix.needsUpdate=true;crown.instanceColor.needsUpdate=true;crown.castShadow=false;S.add(crown);
 // --- runway / taxiways / apron ---
 const rwTex=runwayTex();
 flat(3000,60,M.shoulder,0,0.055,0,0,16);
 const rw=flat(3000,45,new THREE.MeshStandardMaterial(Object.assign({map:rwTex,roughness:0.88,metalness:0,envMapIntensity:0.3},PO(-2,-2))),0,0.09,0,0);
 EDGES.forEach(e=>{
  const Aa=NODES[e.a],B=NODES[e.b];const len=Math.hypot(Aa.x-B.x,Aa.z-B.z);if(len<1)return;
  const ap=e.name==='Apron'||e.name==='Stand',wd=ap?32:e.name==='Service Rd'?8:23;const ang=-Math.atan2(B.z-Aa.z,B.x-Aa.x);
  flat(len+(e.rwy?0:6),wd,ap?M.apron:M.taxi,(Aa.x+B.x)/2,0.06,(Aa.z+B.z)/2,ang,ap?16:16);
  if(e.name!=='Service Rd'&&e.name!=='Stand')flat(len,0.4,M.yellow,(Aa.x+B.x)/2,0.075,(Aa.z+B.z)/2,ang);
 });
 for(const k in NODES){const n=NODES[k];if(n.t==='rwy')continue;const ap=n.t==='lane'||n.t==='gate';const g=new THREE.CircleGeometry(ap?16:12,24);g.rotateX(-Math.PI/2);const uv=g.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*2,uv.getY(i)*2);const c=new THREE.Mesh(g,ap?M.apron:M.taxi);c.position.set(n.x,0.059,n.z);c.receiveShadow=true;S.add(c);}
 ['B','C','D','E'].forEach(k=>{const n=NODES['H'+k];[-1.5,1.5].forEach(o=>flat(0.5,22,M.yellow,n.x+o*1.2,0.08,n.z));flat(3.2,0.4,M.yellow,n.x,0.08,n.z-11);});
 flat(1020,150,M.apron,0,0.05,-325,0,16);
 for(let i=1;i<=6;i++){const g=this.txtPlane(String(i),8,10,'#f2d24a',null);g.rotation.x=-Math.PI/2;g.position.set(GATE_X[i-1],0.1,-335);S.add(g);flat(0.5,50,M.yellow,GATE_X[i-1],0.075,-325);}
 // --- terminal ---
 const faces=this.facade();
 this.winMat=new THREE.MeshStandardMaterial({map:faces.map,color:0xffffff,emissive:0xffd890,emissiveMap:faces.emi,emissiveIntensity:0,roughness:0.12,metalness:0.8,envMapIntensity:1.3});this.winMat.userData.k=1;this.litMats.push(this.winMat);
 const term=new THREE.Mesh(new THREE.BoxGeometry(1000,24,46),[M.concrete,M.concrete,M.roof,M.concrete,this.winMat,M.concrete]);term.position.set(0,12,-425);term.castShadow=true;term.receiveShadow=true;S.add(term);
 this.box(1030,1.6,64,M.metalWhite,0,25,-418);
 for(let i=0;i<26;i++)this.box(1.1,8,1.1,M.metalWhite,-490+i*39.2,4,-401);
 this.box(1010,0.8,9,M.metalWhite,0,9.4,-398);
 for(let i=0;i<30;i++)this.box(5+rn()*8,2.5,4+rn()*5,M.gray,-480+rn()*960,26.9,-420+rn()*10);
 // --- control tower ---
 const tx=560,tz=-390;
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(4.2,5.6,46,20),M.concrete);shaft.position.set(tx,23,tz);shaft.castShadow=true;S.add(shaft);
 for(let i=0;i<4;i++){const rg=new THREE.Mesh(new THREE.CylinderGeometry(5,5,0.7,20),M.metalWhite);rg.position.set(tx,8+i*10,tz);S.add(rg);}
 const glass=new THREE.MeshStandardMaterial({color:lin(0x4f7f9f),roughness:0.05,metalness:0.9,transparent:true,opacity:0.82,emissive:0xffd890,emissiveIntensity:0,envMapIntensity:1.6});glass.userData.k=0.35;this.litMats.push(glass);
 const cab=new THREE.Mesh(new THREE.CylinderGeometry(9.2,6.6,7,20),glass);cab.position.set(tx,50,tz);cab.castShadow=true;S.add(cab);
 const roof=new THREE.Mesh(new THREE.CylinderGeometry(10.2,10.2,1.2,20),M.metalWhite);roof.position.set(tx,54.2,tz);roof.castShadow=true;S.add(roof);
 const ant=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.2,14,6),M.steel);ant.position.set(tx,61,tz);S.add(ant);
 const dish=new THREE.Mesh(new THREE.SphereGeometry(2,14,8,0,6.28,0,1.2),M.metalWhite);dish.position.set(tx+3,55.4,tz);S.add(dish);
 this.towerPos=new THREE.Vector3(tx,50,tz);
 // --- hangars, depot, fuel farm, car park ---
 const hMat=new THREE.MeshStandardMaterial({color:lin(0x9ea8b0),roughness:0.5,metalness:0.5,envMapIntensity:0.7});
 for(const hx of[-980,-840]){this.box(120,12,70,hMat,hx,6,-330);const arch=new THREE.Mesh(new THREE.CylinderGeometry(35,35,120,24,1,false,0,Math.PI),hMat);arch.rotation.z=Math.PI/2;arch.rotation.y=0;arch.position.set(hx,12,-330);arch.scale.set(1,1,0.46*0+1);arch.rotation.set(0,0,Math.PI/2);arch.rotateX(0);arch.castShadow=true;arch.scale.set(0.33,1,1);S.add(arch);this.box(8,10,0.5,M.dark,hx,5,-294.6);}
 this.box(36,9,22,new THREE.MeshStandardMaterial({color:lin(0xb83a32),roughness:0.6}),-40,4.5,-95);this.box(34,1,20,M.dark,-40,9.5,-95);
 this.box(36,9,22,new THREE.MeshStandardMaterial({color:lin(0xd7dbde),roughness:0.6}),44,4.5,-96);this.box(34,1,20,M.dark,44,9.5,-96);
 const tank=new THREE.MeshStandardMaterial({color:lin(0xe8eaec),roughness:0.35,metalness:0.4,envMapIntensity:0.9});
 for(let i=0;i<4;i++){const t=new THREE.Mesh(new THREE.CylinderGeometry(12,12,16,28),tank);t.position.set(1000+i*30,8,-310);t.castShadow=true;t.receiveShadow=true;S.add(t);const l=new THREE.Mesh(new THREE.CylinderGeometry(12.2,12.2,1,28),M.gray);l.position.set(1000+i*30,16.3,-310);S.add(l);}
 flat(300,50,M.taxi,0,0.06,-490,0,16);flat(2400,12,M.taxi,0,0.06,-545,0,16);
 const cars=new THREE.InstancedMesh(new THREE.BoxGeometry(4.3,1.35,1.8),new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.35,metalness:0.5,envMapIntensity:0.9}),180);let ci=0;
 for(let r=0;r<6;r++)for(let q=0;q<30;q++){if(rn()<0.22)continue;dm.position.set(-140+q*9.6,0.8,-505+r*7.6);dm.scale.set(1,1,1);dm.rotation.set(0,Math.PI/2*0,0);dm.updateMatrix();cars.setMatrixAt(ci,dm.matrix);cars.setColorAt(ci,lin([0xd9dde0,0x1d2226,0x9a1f24,0x274b8a,0x8c9399,0xf0f0f0,0x2e5d3d][(rn()*7)|0]));ci++;}
 cars.count=ci;cars.instanceColor.needsUpdate=true;cars.castShadow=true;S.add(cars);
 // --- airfield lights as glowing sprites ---
 const pts=[],cols=[];const add=(x,y,z,c)=>{pts.push(x,y,z);cols.push((c>>16&255)/255,(c>>8&255)/255,(c&255)/255);};
 for(let x=-1500;x<=1500;x+=60){add(x,0.6,-24.5,0xfff2d0);add(x,0.6,24.5,0xfff2d0);}
 for(let x=-1480;x<=1480;x+=15)add(x,0.4,0,0xfff6e0);
 [-1,1].forEach(s=>{for(let k=-6;k<=6;k++){add(s*1452,0.6,k*3.2,0x30ff60);add(s*-1500,0.6,k*3.2,0xff3030);}
  for(let d=60;d<=900;d+=30){add(s*(1450+d),1.5,0,0xfff2d0);if(d%150===0)for(let k=-4;k<=4;k++)add(s*(1450+d),1.5,k*3.2,0xfff2d0);}});
 EDGES.forEach(e=>{if(e.rwy||e.name==='Service Rd'||e.name==='Stand')return;const Aa=NODES[e.a],B=NODES[e.b],len=Math.hypot(Aa.x-B.x,Aa.z-B.z),n=Math.floor(len/30);
  const w=e.name==='Apron'?18:13;for(let i=0;i<=n;i++){const t=i/Math.max(1,n);const x=Aa.x+(B.x-Aa.x)*t,z=Aa.z+(B.z-Aa.z)*t;const nx=-(B.z-Aa.z)/len,nz=(B.x-Aa.x)/len;add(x+nx*w,0.5,z+nz*w,0x3a7bff);add(x-nx*w,0.5,z-nz*w,0x3a7bff);}});
 for(let i=1;i<=6;i++)for(const dx of[-20,20])add(GATE_X[i-1]+dx,18,-398,0xffe9b0);
 for(let i=0;i<8;i++)add(-420+i*120,22.4,-262,0xfff0c8);
 const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));lg.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
 const lm=new THREE.PointsMaterial({size:5,map:this.glow,vertexColors:true,sizeAttenuation:true,transparent:true,opacity:0.2,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});this.lightMat.push(lm);
 const lp=new THREE.Points(lg,lm);lp.frustumCulled=false;S.add(lp);
 // PAPI
 [-1,1].forEach(s=>{for(let k=0;k<4;k++){const pm=new THREE.Mesh(new THREE.BoxGeometry(2,1.2,2),new THREE.MeshStandardMaterial({color:lin(k<2?0xffffff:0xff3030),emissive:lin(k<2?0xffffff:0xff2020),emissiveIntensity:0.9,roughness:0.5}));pm.position.set(s*1180,0.8,-(34+k*9));S.add(pm);}});
 // apron lamp masts
 this.lampMat=new THREE.MeshBasicMaterial({color:lin(0xffe2a8)});
 for(let i=0;i<8;i++){const x=-420+i*120;this.box(0.7,22,0.7,M.steel,x,11,-262);this.box(3.4,0.5,1.4,M.steel,x,22.2,-262);const hd=new THREE.Mesh(new THREE.BoxGeometry(3,0.2,1.1),this.lampMat);hd.position.set(x,21.9,-262);S.add(hd);}
 // windsock
 const sockT=(()=>{const[c,x]=cv(128,64);for(let i=0;i<8;i++){x.fillStyle=i%2?'#f4f4f0':'#e8631c';x.fillRect(i*16,0,16,64);}return toTex(c);})();
 const ws=new THREE.Group();ws.position.set(-160,0,52);const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,9,8),M.metalWhite);pole.position.y=4.5;pole.castShadow=true;ws.add(pole);
 const pv=new THREE.Group();pv.position.y=8.8;const sg=new THREE.CylinderGeometry(0.55,0.2,4,14,1,true);sg.rotateZ(-Math.PI/2);sg.translate(2,0,0);
 const sock=new THREE.Mesh(sg,new THREE.MeshStandardMaterial({map:sockT,side:THREE.DoubleSide,roughness:0.8}));sock.castShadow=true;pv.add(sock);ws.add(pv);S.add(ws);this.sock={pv,sock};
};
R3.facade=function(){
 const[c,x]=cv(512,256),[e,y]=cv(512,256);
 const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#3b5566');g.addColorStop(1,'#1d2d38');x.fillStyle=g;x.fillRect(0,0,512,256);y.fillStyle='#000';y.fillRect(0,0,512,256);
 for(let f=0;f<2;f++)for(let i=0;i<34;i++){const lit=rn()<0.82;x.fillStyle='rgba(180,210,225,'+(0.05+rn()*0.16)+')';x.fillRect(i*15+1,f*128+8,14,112);if(lit){y.fillStyle='rgb('+(210+rn()*40)+','+(170+rn()*40)+','+(100+rn()*40)+')';y.fillRect(i*15+2,f*128+10,12,106);}}
 x.fillStyle='#aeb8bf';for(let i=0;i<=34;i++)x.fillRect(i*15-1,0,2.4,256);x.fillRect(0,120,512,10);x.fillRect(0,0,512,6);x.fillRect(0,250,512,6);
 y.fillStyle='#000';for(let i=0;i<=34;i++)y.fillRect(i*15-1,0,2.4,256);y.fillRect(0,120,512,10);
 const map=toTex(c,{repeat:1}),emi=toTex(e,{repeat:1});map.repeat.set(20,1);emi.repeat.set(20,1);return{map,emi};
};

/* ---------- gate equipment & vehicles ---------- */
R3.buildGateEquip=function(){
 const M=this.mat;const S=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:lin(c),roughness:0.55},o));
 const bridgeM=S(0xd3d9de,{metalness:0.2}),cabM=S(0x8e979e,{metalness:0.3}),rotM=S(0xbfc7cd,{metalness:0.3});
 const cast=m=>{m.castShadow=true;m.receiveShadow=true;return m;};
 this.bridges=[];
 for(let i=0;i<6;i++){
  const gx=GATE_X[i];const g=new THREE.Group();g.position.set(gx-9,0,-400);this.scene.add(g);
  const rot=cast(new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.4,5.5,14),rotM));rot.position.y=5.5;g.add(rot);
  const tg=new THREE.BoxGeometry(1,3.2,3);tg.translate(0.5,0,0);const tun=cast(new THREE.Mesh(tg,bridgeM));tun.position.y=4.8;g.add(tun);
  const cab=cast(new THREE.Mesh(new THREE.BoxGeometry(3.4,3.4,3.4),cabM));cab.position.y=4.8;g.add(cab);
  const pil=cast(new THREE.Mesh(new THREE.BoxGeometry(0.6,5,0.6),M.steel));pil.position.set(0,2.5,0);g.add(pil);
  this.bridges.push({g,tun,cab,ext:0,tgt:0,door:null,gx});
  const fuel=new THREE.Group();const fb=cast(new THREE.Mesh(new THREE.BoxGeometry(6,2.2,2.6),S(0xe9eaec)));fb.position.y=1.9;fuel.add(fb);
  const ft=cast(new THREE.Mesh(new THREE.CylinderGeometry(1.5,1.5,7,14),S(0xd8641c,{metalness:0.4,roughness:0.35})));ft.rotation.z=Math.PI/2;ft.position.set(-2,3.2,0);fuel.add(ft);
  for(const wx of[-3,2.4])for(const wz of[-1.3,1.3]){const w=new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.4,10),M.dark);w.rotation.x=Math.PI/2;w.position.set(wx,0.55,wz);fuel.add(w);}
  fuel.position.set(gx+22,0,-330);fuel.visible=false;this.scene.add(fuel);this.bridges[i].fuel=fuel;
  const bag=new THREE.Group();const bt=cast(new THREE.Mesh(new THREE.BoxGeometry(3,1.6,1.8),S(0x2d6a9f)));bt.position.y=1.2;bag.add(bt);
  for(let k=0;k<2;k++){const cb=cast(new THREE.Mesh(new THREE.BoxGeometry(3.6,1.2,2.2),S(0x777f86,{metalness:0.4})));cb.position.set(-3.4-k*4,0.9,0);bag.add(cb);}
  bag.visible=false;this.scene.add(bag);this.bridges[i].bag=bag;
 }
 this.tug=new THREE.Group();const tb=cast(new THREE.Mesh(new THREE.BoxGeometry(8,2,3.4),S(0x2e3338,{metalness:0.3})));tb.position.y=1.4;this.tug.add(tb);
 const tl=new THREE.Mesh(new THREE.BoxGeometry(1,0.5,3.4),new THREE.MeshBasicMaterial({color:lin(0xf5c518)}));tl.position.set(3.8,2.5,0);this.tug.add(tl);this.tug.visible=false;this.scene.add(this.tug);
};
R3.buildVeh=function(v){
 const g=new THREE.Group(),M=this.mat;const S=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:lin(c),roughness:0.4,metalness:0.2},o));
 const cast=m=>{m.castShadow=true;return m;};
 const wheels=(L,W,r,xs)=>{for(const x of xs)for(const z of[-W/2,W/2]){const w=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.38,12),M.dark);w.rotation.x=Math.PI/2;w.position.set(x,r,z);g.add(w);}};
 const glass=S(0x1c2b36,{roughness:0.05,metalness:0.9});
 if(v.vt==='ops'){
  const b=cast(new THREE.Mesh(new THREE.BoxGeometry(4.6,1.1,2.1),S(0xf2d21c)));b.position.y=1.0;g.add(b);
  const c=cast(new THREE.Mesh(new THREE.BoxGeometry(2.1,1.0,1.9),S(0xf5f5f0)));c.position.set(-0.3,2.0,0);g.add(c);
  const gl=new THREE.Mesh(new THREE.BoxGeometry(2.12,0.55,1.92),glass);gl.position.set(-0.3,2.1,0);g.add(gl);
  const l=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.35,1.2),new THREE.MeshBasicMaterial({color:lin(0xff8a00),toneMapped:false}));l.position.set(-0.3,2.7,0);g.add(l);g.userData.beacon=l;wheels(4.6,2.1,0.45,[-1.5,1.6]);
 }else{
  const b=cast(new THREE.Mesh(new THREE.BoxGeometry(8.6,2.2,2.9),S(0xc3262b,{roughness:0.35})));b.position.y=1.7;g.add(b);
  const st=new THREE.Mesh(new THREE.BoxGeometry(8.62,0.35,2.92),S(0xf3f3ee));st.position.y=1.7;g.add(st);
  const c=cast(new THREE.Mesh(new THREE.BoxGeometry(2.6,1.7,2.8),S(0xd0302f)));c.position.set(3.2,3.5,0);g.add(c);
  const gl=new THREE.Mesh(new THREE.BoxGeometry(2.62,0.8,2.82),glass);gl.position.set(3.25,3.7,0);g.add(gl);
  const t=cast(new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,5.4,10),S(0xdddddd,{metalness:0.6})));t.rotation.z=Math.PI/2;t.position.set(-1,3.4,0);g.add(t);
  const l=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.4,2),new THREE.MeshBasicMaterial({color:lin(0x3a8dff),toneMapped:false}));l.position.set(3.2,4.5,0);g.add(l);g.userData.beacon=l;wheels(8.6,2.9,0.6,[-2.8,0.2,3.0]);
 }
 this.scene.add(g);return{holder:g,veh:true,v};
};

/* ---------- aircraft ---------- */
function wingGeo(secs,side){
 const pos=[],idx=[],uvs=[],R=6,pts=[[0,0],[0.16,0.75],[0.52,1.0],[1,0.06],[0.62,-0.42],[0.2,-0.55]];
 secs.forEach((s,ki)=>{const t=s.th*s.ch;pts.forEach(p=>{pos.push(s.le-p[0]*s.ch,s.y+p[1]*t,side*s.z);uvs.push(s.uf!==undefined?s.uf:ki/Math.max(1,secs.length-1),p[0]);});});
 for(let k=0;k<secs.length-1;k++)for(let i=0;i<R;i++){const a=k*R+i,b=k*R+(i+1)%R,c=(k+1)*R+i,d=(k+1)*R+(i+1)%R;idx.push(a,b,c,b,d,c);}
 const l=(secs.length-1)*R;for(let i=1;i<R-1;i++)idx.push(l,l+i,l+i+1);const f=R;for(let i=1;i<R-1;i++)idx.push(0,i+1,i);
 let cx=0,cy=0,cz=0;const n=pos.length/3;for(let i=0;i<n;i++){cx+=pos[i*3];cy+=pos[i*3+1];cz+=pos[i*3+2];}cx/=n;cy/=n;cz/=n;
 for(let t=0;t<idx.length;t+=3){const a=idx[t]*3,b=idx[t+1]*3,c=idx[t+2]*3;
  const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const gx=(pos[a]+pos[b]+pos[c])/3-cx,gy=(pos[a+1]+pos[b+1]+pos[c+1])/3-cy,gz=(pos[a+2]+pos[b+2]+pos[c+2])/3-cz;
  if(nx*gx+ny*gy+nz*gz<0){const q=idx[t+1];idx[t+1]=idx[t+2];idx[t+2]=q;}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
R3.wingTex=function(){
 if(this._wt)return this._wt;
 const[c,x]=cv(512,256);
 const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'#eef1f3');g.addColorStop(1,'#d3d9de');x.fillStyle=g;x.fillRect(0,0,512,256);
 const line=(x1,y1,x2,y2,col,w)=>{x.strokeStyle=col||'rgba(70,80,88,0.75)';x.lineWidth=w||1.4;x.beginPath();x.moveTo(x1,y1);x.lineTo(x2,y2);x.stroke();};
 const U=u=>u*512,V=v=>v*256;
 // leading-edge slats
 x.fillStyle='rgba(150,160,168,0.35)';x.fillRect(0,0,512,V(0.11));line(0,V(0.11),512,V(0.11));
 [0.06,0.2,0.34,0.5,0.64,0.78,0.9].forEach(u=>line(U(u),0,U(u),V(0.11)));
 // trailing-edge flaps (two big segments each side of the engine) and ailerons
 x.fillStyle='rgba(120,130,138,0.18)';x.fillRect(U(0.05),V(0.70),U(0.55),V(0.30));x.fillRect(U(0.68),V(0.76),U(0.27),V(0.24));
 line(U(0.05),V(0.70),U(0.60),V(0.70));line(U(0.68),V(0.76),U(0.95),V(0.76));
 [0.05,0.26,0.34,0.60,0.68,0.95].forEach(u=>line(U(u),V(u<0.6?0.70:0.76),U(u),256));
 // spoilers
 for(let i=0;i<6;i++){const u0=0.07+i*0.092;x.strokeStyle='rgba(70,80,88,0.7)';x.lineWidth=1.2;x.strokeRect(U(u0),V(0.50),U(0.082),V(0.20));}
 // flap-track fairing stripes, fuel access panels, root walkway
 [0.14,0.32,0.5].forEach(u=>{x.fillStyle='rgba(90,100,108,0.35)';x.fillRect(U(u)-3,V(0.62),6,V(0.38));});
 x.fillStyle='rgba(60,66,72,0.45)';x.fillRect(U(0.01),V(0.36),U(0.16),V(0.08));
 for(let i=0;i<9;i++){x.strokeStyle='rgba(80,90,98,0.5)';x.lineWidth=1;x.strokeRect(U(0.04+i*0.1),V(0.13),U(0.07),V(0.12));}
 x.fillStyle='rgba(210,60,60,0.55)';x.fillRect(U(0.985),V(0.1),U(0.015),V(0.6));
 this._wt=toTex(c,{repeat:1});return this._wt;
};
const SPEC={
 narrow:{rootC:0.158,tipC:0.04,sweep:25,dih:5,wy:-0.45,lex:0.16,eng:0.32,fin:3.0,wl:true,wlh:1.15,wlsw:0.75},
 e190:{rootC:0.15,tipC:0.042,sweep:23,dih:5,wy:-0.42,lex:0.15,eng:0.33,fin:2.9,wl:true},
 wide:{rootC:0.172,tipC:0.03,sweep:32,dih:6,wy:-0.42,lex:0.14,eng:0.31,fin:2.55,wl:false,rake:true},
 prop:{rootC:0.115,tipC:0.066,sweep:3,dih:1.5,wy:0.80,lex:0.10,eng:0.30,fin:3.0,wl:false}
};
const NAMES={BAW:'British Airways',DLH:'Lufthansa',AFR:'AIR FRANCE',EZY:'easyJet',RYR:'Ryanair',KLM:'KLM',VIR:'Virgin Atlantic',UAE:'Emirates',SAS:'SAS'};
const INIT={BAW:'BA',DLH:'LH',AFR:'AF',EZY:'easy',RYR:'R',KLM:'KLM',VIR:'V',UAE:'EK',SAS:'SAS'};
const hexs=h=>'#'+('000000'+h.toString(16)).slice(-6);
R3.acMaterials=function(a){
 const ty=a.type,al=a.al,key=al.icao+'|'+ty.n;if(this.liv.has(key))return this.liv.get(key);
 const L=ty.len,rf=ty.rf,CW=512,CH=1536,ay=t=>(1-t)*CH;
 const[c,x]=cv(CW,CH),[e,y]=cv(128,384);
 const body=al.icao==='VIR'?'#c8102e':'#f1f3f4',tail=hexs(al.tail),acc=hexs(al.acc);
 x.fillStyle=body;x.fillRect(0,0,CW,CH);
 x.strokeStyle='rgba(60,68,76,0.16)';x.lineWidth=1;for(let yy=0;yy<CH;yy+=CH/(L/2.4)){x.beginPath();x.moveTo(0,yy);x.lineTo(CW,yy);x.stroke();}for(let xx=0;xx<CW;xx+=CW/18){x.beginPath();x.moveTo(xx,0);x.lineTo(xx,CH);x.stroke();}
 y.fillStyle='#000';y.fillRect(0,0,128,384);
 if(al.icao!=='VIR'){const g=x.createLinearGradient(0,0,CW,0);const st=[[0,0],[0.27,0],[0.40,0.55],[0.5,0.8],[0.6,0.55],[0.73,0],[1,0]];st.forEach(s=>g.addColorStop(s[0],'rgba(120,128,136,'+s[1]*0.7+')'));x.fillStyle=g;x.fillRect(0,0,CW,CH);}
 x.fillStyle=tail;x.fillRect(0,ay(0.19),CW,CH-ay(0.19));
 const pxm=CW/(2*Math.PI*rf),pyl=CH/L;
 if(al.icao!=='VIR'){x.fillStyle=acc;const sw=Math.max(8,0.3*pxm);for(const u of[0.222,0.778])x.fillRect(u*CW-sw/2,ay(0.935),sw,ay(0.12)-ay(0.935));
  x.fillRect(0.235*CW,ay(0.19),0.03*CW,0.9*pyl*0+14);}
 // windows
 const win=(ctx,sc,col)=>{ctx.fillStyle=col;const w=0.27*pxm*sc,h=0.36*pyl*sc,st=0.76/L;for(let t=0.215;t<0.835;t+=st){const yy=ay(t)*sc;for(const u of[0.183,0.817]){const xx=u*CW*sc;ctx.fillRect(xx-w/2,yy-h/2,w,h);}}};
 win(x,1,al.icao==='VIR'?'#222a33':'#1b232c');win(y,0.25,'#ffd9a0');
 // doors
 x.strokeStyle='rgba(95,102,108,0.9)';x.lineWidth=2;const dw=0.95*pxm,dh=1.9*pyl;for(const t of[0.845,0.23,ty.wide?0.55:0.5])for(const u of[0.21,0.79])x.strokeRect(u*CW-dw/2,ay(t)-dh/2,dw,dh);
 // cockpit windows
 x.fillStyle='#10161c';for(const u of[0.14,0.86]){x.beginPath();x.moveTo(u*CW-9,ay(0.955));x.lineTo(u*CW+9,ay(0.949));x.lineTo(u*CW+9,ay(0.94));x.lineTo(u*CW-9,ay(0.936));x.fill();}
 x.fillRect(0,ay(0.965),0.07*CW,ay(0.943)-ay(0.965));x.fillRect(0.93*CW,ay(0.965),0.07*CW,ay(0.943)-ay(0.965));
 // nose tip + name
 x.fillStyle='rgba(60,66,72,0.6)';x.fillRect(0,0,CW,ay(0.985));
 const nm=NAMES[al.icao]||al.rt;x.font='700 64px Arial,Helvetica,sans-serif';const tw=x.measureText(nm).width;const fs=Math.min(104,64*(0.36*CH)/tw);x.font='700 '+fs+'px Arial,Helvetica,sans-serif';x.textAlign='center';x.textBaseline='middle';
 x.fillStyle=al.icao==='VIR'?'#ffffff':tail;
 x.save();x.translate(0.285*CW,ay(0.57));x.rotate(-Math.PI/2);x.fillText(nm,0,0);x.restore();
 x.save();x.translate(0.715*CW,ay(0.57));x.rotate(Math.PI/2);x.fillText(nm,0,0);x.restore();
 const map=toTex(c,{repeat:1}),emi=toTex(e,{repeat:1});
 const bodyM=new THREE.MeshStandardMaterial({map,roughness:0.34,metalness:0.14,emissive:0xffffff,emissiveMap:emi,emissiveIntensity:this.P?this.P.win*1.3:0,envMapIntensity:1.0});this.acMats.push(bodyM);
 const S=(col,o)=>new THREE.MeshStandardMaterial(Object.assign({color:lin(col),roughness:0.45},o));
 const wingM=new THREE.MeshStandardMaterial({map:this.wingTex(),roughness:0.42,metalness:0.2}),engM=S({EZY:0xff6a10,VIR:0xc8102e}[al.icao]||0xe9ecee,{metalness:0.35,roughness:0.3}),tailM=S(al.tail,{metalness:0.15,roughness:0.34});
 // fin decal
 const[dc,dx]=cv(256,256);const dark=(al.tail>>16&255)*0.3+(al.tail>>8&255)*0.59+(al.tail&255)*0.11<150;
 if(al.icao==='EZY'||al.icao==='KLM'){dx.fillStyle='#fff';dx.font='bold '+(al.icao==='EZY'?92:110)+'px Arial';dx.textAlign='center';dx.textBaseline='middle';dx.fillText(INIT[al.icao],128,128);}
 else{dx.fillStyle=dark?'#f4f4f4':'#fff';dx.beginPath();dx.arc(128,128,100,0,6.28);dx.fill();dx.fillStyle=al.icao==='RYR'?acc:tail;dx.font='bold 98px Arial';dx.textAlign='center';dx.textBaseline='middle';dx.fillText(INIT[al.icao]||'',128,134);}
 const decal=new THREE.MeshStandardMaterial({map:toTex(dc),transparent:true,roughness:0.4,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const r={bodyM,wingM,engM,tailM,decal};this.liv.set(key,r);return r;
};
const wheelCache={};
function wheel(R,w,M,g,x,y,z,hubM){
 const k=R.toFixed(2)+'_'+w.toFixed(2);if(!wheelCache[k]){const t=new THREE.CylinderGeometry(R,R,w,18);t.rotateX(Math.PI/2);const h=new THREE.CylinderGeometry(R*0.55,R*0.55,w*1.04,12);h.rotateX(Math.PI/2);wheelCache[k]=[t,h];}
 const t=new THREE.Mesh(wheelCache[k][0],M.tire);t.position.set(x,y,z);t.castShadow=true;g.add(t);const h=new THREE.Mesh(wheelCache[k][1],M.hub);h.position.set(x,y,z);g.add(h);
}
R3.buildAC=function(a){
 const ty=a.type,L=ty.len,W=ty.wing,rf=ty.rf,prop=!!ty.prop,wide=!!ty.wide;
 const mats=this.acMaterials(a),M=this.mat;
 if(!M.tire){M.tire=new THREE.MeshStandardMaterial({color:lin(0x17181a),roughness:0.95});M.hub=new THREE.MeshStandardMaterial({color:lin(0xaab0b6),roughness:0.35,metalness:0.9});M.glowM=new THREE.SpriteMaterial({map:this.glow,color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});}
 const root=new THREE.Group(),pivot=new THREE.Group(),body=new THREE.Group();
 const gearH=rf*1.85,mainX=L*(prop?0.02:0.045);root.add(pivot);pivot.position.set(mainX,0,0);body.position.set(-mainX,gearH,0);pivot.add(body);
 // fuselage
 const prof=[],N=90;
 for(let i=0;i<=N;i++){const t=i/N;let r;
  if(t<0.17){const u=t/0.17;r=rf*(0.09+0.91*Math.sin(u*Math.PI/2));}
  else if(t>0.87){const u=(t-0.87)/0.13;r=rf*Math.pow(Math.max(0,1-u*u),0.52);}else r=rf;
  prof.push(new THREE.Vector2(Math.max(r,0.001),(t-0.5)*L));}
 const fg=new THREE.LatheGeometry(prof,36);fg.rotateZ(-Math.PI/2);fg.rotateX(-Math.PI/2);   // spin the body so the livery's belly (u=0.5) is underneath and the window lines sit on the sides
 {const p=fg.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);if(x<-0.33*L){const u=(-0.33*L-x)/(0.17*L);p.setY(i,p.getY(i)+rf*0.55*u*u);}}}
 const fus=new THREE.Mesh(fg,mats.bodyM);fus.castShadow=true;fus.receiveShadow=true;body.add(fus);
 // wing
 const sp=prop?SPEC.prop:wide?SPEC.wide:ty.n==='E190'?SPEC.e190:SPEC.narrow;
 const half=W/2,z0=rf*0.45,lex=sp.lex*L,wy=sp.wy*rf,tanS=Math.tan(sp.sweep*Math.PI/180),tanD=Math.tan(sp.dih*Math.PI/180),rootC=sp.rootC*L,tipC=sp.tipC*L;
 const wLE=z=>lex-tanS*(z-z0),wY=z=>wy+(z-z0)*tanD;
 const secs=(sp.rake?[0,0.5,0.9,1]:[0,0.5,1]).map(f=>{const z=z0+(half-z0)*f;const rk=sp.rake&&f>0.95?1:0;return{z,uf:f,le:wLE(z)-rk*L*0.05,ch:rootC*(f===0?1.1:1)*(1-f)+tipC*f*(rk?1.6:1),y:wY(z)+rk*rf*0.18,th:0.135-0.05*f};});
 for(const s of[-1,1]){const w=new THREE.Mesh(wingGeo(secs,s),mats.wingM);w.castShadow=true;w.receiveShadow=true;body.add(w);}
 if(!prop){const bf=new THREE.Mesh(new THREE.SphereGeometry(1,18,10),mats.bodyM);bf.scale.set(rootC*1.15,rf*0.3,rf*1.04);bf.position.set(lex-rootC*0.52,-rf*0.80,0);bf.castShadow=true;body.add(bf);}
 // winglets
 const tipZ=half-0.03,tipLE=wLE(half),tipY=wY(half);
 if(sp.wl){const h=rf*(sp.wlh||1.05)*(ty.n==='B738'?0.85:1),cr=tipC*1.7,ctp=tipC*0.65,sw=Math.tan(ty.n==='B738'?0.95:0.7);
  const ws=[0,1].map(f=>({z:h*f,le:(tipLE-tipC)+cr-sw*h*f,ch:cr*(1-f)+ctp*f,y:0,th:0.09}));
  for(const s of[-1,1]){const g=wingGeo(ws,1);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,mats.tailM);m.position.set(0,tipY,s*tipZ);m.rotation.x=s*0.14*0;m.castShadow=true;body.add(m);}}
 // engines
 const zE=half*sp.eng,leE=wLE(zE),yW=wY(zE);
 const fanT=(()=>{if(R3._fan)return R3._fan;const[c,x]=cv(128,128);x.fillStyle='#12161a';x.fillRect(0,0,128,128);x.translate(64,64);for(let i=0;i<22;i++){x.rotate(6.28/22);x.fillStyle='rgba(150,158,166,0.85)';x.fillRect(8,-2.3,52,4.6);}x.fillStyle='#9aa1a8';x.beginPath();x.arc(0,0,11,0,6.28);x.fill();x.strokeStyle='#c5cbd0';x.lineWidth=6;x.beginPath();x.arc(0,0,60,0,6.28);x.stroke();return R3._fan=toTex(c);})();
 const props=[];
 if(!prop){
  const R=rf*(ty.n==='B77W'?0.68:wide?0.6:0.52),Ln=R*(wide?3.2:3.1);
  const eprof=[[-0.5,0.60],[-0.4,0.72],[-0.26,0.90],[-0.08,1.0],[0.18,1.0],[0.36,0.98],[0.45,0.94],[0.5,0.9],[0.5,0.82],[0.42,0.80],[0.3,0.78]].map(p=>new THREE.Vector2(p[1]*R,p[0]*Ln));
  const eg=new THREE.LatheGeometry(eprof,28);eg.rotateZ(-Math.PI/2);
  const engMat=mats.engM.clone();engMat.side=THREE.DoubleSide;
  const yE=-(gearH-R-0.5),xc=leE+R*0.9-Ln/2;
  for(const s of[-1,1]){const gE=new THREE.Group();gE.position.set(xc,yE,s*zE);
   const nac=new THREE.Mesh(eg,engMat);nac.castShadow=true;gE.add(nac);
   const lip=new THREE.Mesh(new THREE.TorusGeometry(R*0.9,R*0.055,8,32),M.hub);lip.rotation.y=Math.PI/2;lip.position.x=Ln*0.5;gE.add(lip);
   const ex=new THREE.Mesh(new THREE.TorusGeometry(R*0.62,R*0.05,8,24),M.dark);ex.rotation.y=Math.PI/2;ex.position.x=-Ln*0.5;gE.add(ex);
   const fan=new THREE.Mesh(new THREE.CircleGeometry(R*0.78,24),new THREE.MeshStandardMaterial({map:fanT,roughness:0.5,metalness:0.6}));fan.rotation.y=Math.PI/2;fan.position.x=Ln*0.3;gE.add(fan);
   const cone=new THREE.Mesh(new THREE.ConeGeometry(R*0.36,R*1.1,16),mats.engM);cone.rotation.z=-Math.PI/2;cone.position.x=-Ln*0.5-R*0.35;cone.rotateZ(Math.PI);gE.add(cone);
   const ph=(yW-0.35)-(yE+R*0.85);if(ph>0.05){const py=new THREE.Mesh(new THREE.BoxGeometry(Ln*0.62,ph+0.2,0.36),mats.wingM);py.position.set(Ln*0.1,R*0.85+ph/2-0.1,0);py.castShadow=true;gE.add(py);}
   body.add(gE);}
 }else{
  const R=rf*0.34,Ln=L*0.13,yE=wY(zE)-R*0.3,xc=leE+1.1-Ln/2;
  const eprof=[[-0.5,0.5],[-0.35,0.8],[-0.1,1],[0.25,1],[0.42,0.78],[0.5,0.45]].map(p=>new THREE.Vector2(p[1]*R,p[0]*Ln));
  const eg=new THREE.LatheGeometry(eprof,18);eg.rotateZ(-Math.PI/2);
  for(const s of[-1,1]){const gE=new THREE.Group();gE.position.set(xc,yE,s*zE);const nac=new THREE.Mesh(eg,mats.engM);nac.castShadow=true;gE.add(nac);
   const sp1=new THREE.Mesh(new THREE.ConeGeometry(R*0.5,R*1.6,12),M.steel);sp1.rotation.z=-Math.PI/2;sp1.position.x=Ln*0.5+R*0.8;gE.add(sp1);
   const pr=new THREE.Group();pr.position.x=Ln*0.5+R*0.2;for(let b=0;b<6;b++){const bl=new THREE.Mesh(new THREE.BoxGeometry(0.1,rf*1.5,0.34),M.dark);bl.position.y=rf*0.75;const bg=new THREE.Group();bg.rotation.x=b*Math.PI/3;bg.add(bl);pr.add(bg);}
   const disc=new THREE.Mesh(new THREE.CircleGeometry(rf*1.5,24),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.1,depthWrite:false,side:THREE.DoubleSide}));disc.rotation.y=Math.PI/2;pr.add(disc);
   gE.add(pr);props.push(pr);body.add(gE);}
 }
 // tail
 const fh=sp.fin*rf,leF=-L*0.275,cF=(wide?0.17:0.19)*L,tF=0.075*L,swF=Math.tan(0.63),baseY=rf*0.6;
 const fs=[0,0.5,1].map(f=>({z:fh*f,le:leF-swF*fh*f,ch:cF*(1-f)+tF*f,y:0,th:0.085}));
 const fg2=wingGeo(fs,1);fg2.rotateX(-Math.PI/2);const fin=new THREE.Mesh(fg2,mats.tailM);fin.position.set(0,baseY,0);fin.castShadow=true;body.add(fin);
 const mid=0.42,cm=cF*(1-mid)+tF*mid,lm=leF-swF*fh*mid;
 for(const s of[-1,1]){const d=new THREE.Mesh(new THREE.PlaneGeometry(cm*0.62,cm*0.62),mats.decal);d.position.set(lm-cm*0.5,baseY+fh*mid,s*0.19);if(s<0)d.rotation.y=Math.PI;body.add(d);}
 const hh=(prop?0.30:0.35)*W/2,hz0=rf*0.25,tT=!!prop;
 const hLE=tT?(leF-swF*fh):-L*0.385,hY=tT?baseY+fh:rf*0.2,hC=0.09*L,hTC=0.034*L,hSw=Math.tan(0.5);
 const hs=[0,1].map(f=>({z:hz0+(hh-hz0)*f,le:hLE-hSw*(hh-hz0)*f,ch:hC*(1-f)+hTC*f,y:hY+f*(hh-hz0)*0.05,th:0.09}));
 for(const s of[-1,1]){const m=new THREE.Mesh(wingGeo(hs,s),mats.wingM);m.castShadow=true;body.add(m);}
 // airframe detail: SATCOM dome, antennas, APU exhaust, flap-track fairings, pitot
 if(!prop){
  const dome=new THREE.Mesh(new THREE.SphereGeometry(1,14,8),mats.wingM);dome.scale.set(rf*0.85,rf*0.22,rf*0.4);dome.position.set(L*0.04,rf*0.98,0);body.add(dome);
  const apu=new THREE.Mesh(new THREE.CylinderGeometry(rf*0.11,rf*0.15,rf*0.5,10),M.dark);apu.rotation.z=Math.PI/2;apu.position.set(-L*0.5+rf*0.1,rf*0.42,0);body.add(apu);
  const nz=[0.22,0.42,0.6];for(const s of[-1,1])for(const f of nz){const z=z0+(half-z0)*f*0.9,chd=rootC*(1-f*0.9)+tipC*f*0.9;const fp=new THREE.Mesh(new THREE.SphereGeometry(1,10,6),mats.wingM);fp.scale.set(chd*0.22,rf*0.09,0.17);fp.position.set(wLE(z)-chd*0.86,wY(z)-rf*0.14,s*z);body.add(fp);}
 }
 for(const [ax,ay,s2] of [[-L*0.12,rf*1.0+0.25,1],[L*0.14,-rf*1.0-0.2,-1]]){const an=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.9,0.07),mats.wingM);an.position.set(ax,ay,0);an.rotation.z=s2*0.35;body.add(an);}
 for(const s of[-1,1]){const pt=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,0.7,6),M.steel);pt.rotation.z=Math.PI/2;pt.position.set(L*0.5-rf*1.3,rf*0.1,s*rf*0.95);body.add(pt);}
 // landing gear
 const gear=new THREE.Group();
 const Rw=rf*(wide?0.21:0.27),ww=Rw*0.72,Rn=Rw*0.82;
 const mz=prop?zE:rf*1.7;
 for(const s of[-1,1]){
  const top=wY(mz)-0.15,axY=-gearH+Rw;
  const st=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.2,top-axY,8),M.steel);st.position.set(mainX,(top+axY)/2,s*mz);st.castShadow=true;gear.add(st);
  const axes=wide?[-1,0,1]:[0];
  for(const k of axes){const ax=mainX+k*Rw*2.5;for(const o of[-1,1])wheel(Rw,ww,M,gear,ax,axY,s*mz+o*ww*0.58);}
  if(wide){const bm=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,Rw*5.2,8),M.steel);bm.rotation.z=Math.PI/2;bm.position.set(mainX,axY,s*mz);gear.add(bm);}
 }
 {const ng=-gearH+Rn,top=-rf*0.85,nx=L*0.31;const st=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.15,top-ng,8),M.steel);st.position.set(nx,(top+ng)/2,0);gear.add(st);for(const o of[-1,1])wheel(Rn,Rn*0.7,M,gear,nx,ng,o*Rn*0.55);}
 body.add(gear);root.userData.gear=gear;
 // lights
 const lite=(col,x,y,z,r,sc)=>{const g=new THREE.Group();g.position.set(x,y,z);const m=new THREE.Mesh(new THREE.SphereGeometry(r||0.22,8,6),new THREE.MeshBasicMaterial({color:col,toneMapped:false}));g.add(m);
  const sp=new THREE.Sprite(M.glowM.clone());sp.material.color.setHex(col);sp.scale.set(sc||3,sc||3,1);g.add(sp);body.add(g);return g;};
 const tipX=tipLE-tipC*0.55;
 lite(0xff2a2a,tipX,tipY,-(half+0.05),0.2,2.2);lite(0x2aff5a,tipX,tipY,half+0.05,0.2,2.2);
 root.userData.strobes=[lite(0xffffff,tipX-0.4,tipY,-(half+0.05),0.25,5),lite(0xffffff,tipX-0.4,tipY,half+0.05,0.25,5),lite(0xffffff,-L*0.5+0.2,rf*0.5,0,0.25,5)];
 root.userData.beacon=lite(0xff1a1a,-L*0.02,rf*1.04,0,0.28,5);
 root.userData.land=lite(0xfff6dc,L*0.31,-rf*0.85,0,0.3,6);
 const cone=new THREE.ConeGeometry(16,150,18,1,true);cone.translate(0,-75,0);cone.rotateZ(Math.PI/2);
 const beam=new THREE.Mesh(cone,new THREE.MeshBasicMaterial({color:0xfff2d0,transparent:true,opacity:0.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
 beam.position.set(L*0.31,-rf*0.85,0);beam.rotation.z=-0.05;beam.visible=false;body.add(beam);root.userData.beam=beam;
 if(props.length)root.userData.props=props;
 const sh=new THREE.Mesh(new THREE.CircleGeometry(1,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.16,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));sh.rotation.x=-Math.PI/2;sh.position.y=0.12;root.userData.shadow=sh;
 const holder=new THREE.Group();holder.add(root);this.scene.add(holder);this.scene.add(sh);
 return{holder,root,body:pivot,sh,a};
};

/* ---------- per-frame extras ---------- */
R3.extra=function(dt,t){
 if(this.sock&&window.G&&G.wind){const w=G.wind;this.sock.pv.rotation.y=-(w.dir+180-90)*Math.PI/180;const k=Math.min(1,w.spd/13);this.sock.sock.rotation.z=-(1-k)*1.15+Math.sin(t*3.1)*0.05*k;this.sock.sock.rotation.y=Math.sin(t*2.3)*0.07;}
 const night=this.tod!=='day';
 for(const [id,m] of this.meshes){if(m.veh)continue;const u=m.root.userData;if(u.beam)u.beam.visible=night&&u.land.visible;}
};
R3.followSun=function(){
 const c=this.cam,cam=this.camera,foc=new THREE.Vector3();
 if(['tower','rwy09','rwy27','mid'].includes(c.mode)){cam.getWorldDirection(foc);foc.y=0;foc.normalize().multiplyScalar(300).add(cam.position);foc.y=0;}else{foc.copy(c.target);foc.y=0;}
 foc.x=Math.round(foc.x/3)*3;foc.z=Math.round(foc.z/3)*3;
 this.sun.target.position.copy(foc);this.sun.position.copy(foc).addScaledVector(this.sunDir,2200);this.sun.target.updateMatrixWorld();
};
const _uc=R3.updateCam;R3.updateCam=function(dt){_uc.call(this,dt);this.followSun();};
const _sy=R3.sync;R3.sync=function(dt,t){if(this.ok)this.extra(dt,t);_sy.call(this,dt,t);};
})();
