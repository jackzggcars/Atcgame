'use strict';
/* =====================================================================
   ACMODEL — high-fidelity procedural airliner models (replaces gfx.js buildAC / acMaterials).
   • Lofted super-elliptic fuselages (nose droop, windscreen, up-swept tail cone, double-deck variant) with
     separate glass / frame patches, LOD pair.
   • Airfoil lofting for wings, winglets, fin, tailplane, pylons (cambered NACA-style sections, twist, dihedral, kinked planform).
   • Turbofan nacelles with inlet liner, fan blades, spinner, core cowl, plug, chevrons; turboprop (PW150) with scimitar blades.
   • Landing gear with oleos, torque links, drag struts, brakes, bogies, doors.
   • Hull / wing / engine / fin textures drawn per airline + per type: panel seams, rivets, doors, windows, stencils,
     registration, flags, weathering, exhaust staining, with matching normal / roughness / AO / emissive maps.
   • Static detail is merged per material so each aircraft costs a handful of draw calls; fine detail LODs out with distance.
   ===================================================================== */
(function(){
const V3=THREE.Vector3,M4=THREE.Matrix4,TAU=Math.PI*2;
const lin=h=>new THREE.Color(h).convertSRGBToLinear();
const cv=(w,h)=>{const c=document.createElement('canvas');c.width=Math.max(2,Math.round(w));c.height=Math.max(2,Math.round(h));return[c,c.getContext('2d')];};
function mul(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function seedOf(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),lerp=(a,b,t)=>a+(b-a)*t;
const spow=(x,p)=>Math.sign(x)*Math.pow(Math.abs(x),p);
function tex(c,o){o=o||{};const t=new THREE.CanvasTexture(c);t.encoding=o.lin?THREE.LinearEncoding:THREE.sRGBEncoding;t.anisotropy=Math.min(8,R3.maxAniso||4);
 if(o.repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;
 if(!o.keep)t.onUpdate=function(){try{this.image.width=1;this.image.height=1;}catch(e){}this.onUpdate=null;};return t;}

/* ---------- normal map from a height canvas ---------- */
function normalFrom(hc,str,wrapX){
 const W=hc.width,H=hc.height,sx=hc.getContext('2d').getImageData(0,0,W,H).data,[nc,nx]=cv(W,H),out=nx.createImageData(W,H),o=out.data;
 for(let y=0;y<H;y++){const y0=y>0?y-1:0,y1=y<H-1?y+1:y;
  for(let x=0;x<W;x++){const x0=x>0?x-1:(wrapX?W-1:0),x1=x<W-1?x+1:(wrapX?0:x);
   const dx=(sx[(y*W+x1)*4]-sx[(y*W+x0)*4])*str/255,dy=(sx[(y1*W+x)*4]-sx[(y0*W+x)*4])*str/255,il=1/Math.sqrt(dx*dx+dy*dy+1),i=(y*W+x)*4;
   o[i]=(-dx*il*0.5+0.5)*255;o[i+1]=(dy*il*0.5+0.5)*255;o[i+2]=(il*0.5+0.5)*255;o[i+3]=255;}}
 nx.putImageData(out,0,0);return nc;
}

/* ---------- merge helper: collect many geometries, emit one mesh per material ---------- */
class Mrg{
 constructor(){this.m=new Map();}
 add(g,mat,mx){let e=this.m.get(mat);if(!e){e={mat,gs:[]};this.m.set(mat,e);}e.gs.push([g,mx||null]);}
 build(parent,cast,recv){
  const out=[];
  for(const e of this.m.values()){
   let np=0,ni=0;for(const[g]of e.gs){np+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;}
   const P=new Float32Array(np*3),N=new Float32Array(np*3),U=new Float32Array(np*2),I=new Uint32Array(ni);let po=0,io=0;const nm=new THREE.Matrix3();
   for(const[g,mx]of e.gs){
    const gp=g.attributes.position,gn=g.attributes.normal,gu=g.attributes.uv,n=gp.count;
    const v=new V3();if(mx)nm.getNormalMatrix(mx);
    for(let i=0;i<n;i++){v.fromBufferAttribute(gp,i);if(mx)v.applyMatrix4(mx);P[(po+i)*3]=v.x;P[(po+i)*3+1]=v.y;P[(po+i)*3+2]=v.z;
     if(gn){v.fromBufferAttribute(gn,i);if(mx)v.applyMatrix3(nm).normalize();N[(po+i)*3]=v.x;N[(po+i)*3+1]=v.y;N[(po+i)*3+2]=v.z;}
     if(gu){U[(po+i)*2]=gu.getX(i);U[(po+i)*2+1]=gu.getY(i);}}
    if(g.index){for(let i=0;i<g.index.count;i++)I[io++]=g.index.getX(i)+po;}else for(let i=0;i<n;i++)I[io++]=po+i;
    po+=n;}
   const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));G.setAttribute('normal',new THREE.BufferAttribute(N,3));G.setAttribute('uv',new THREE.BufferAttribute(U,2));G.setIndex(new THREE.BufferAttribute(I,1));
   const m=new THREE.Mesh(G,e.mat);m.castShadow=!!cast;m.receiveShadow=recv!==false;parent.add(m);out.push(m);}
  return out;
 }
}
const mx=(x,y,z,rx,ry,rz,sx,sy,sz)=>{const m=new M4();const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0));m.compose(new V3(x||0,y||0,z||0),q,new V3(sx===undefined?1:sx,sy===undefined?(sx===undefined?1:sx):sy,sz===undefined?(sx===undefined?1:sx):sz));return m;};

/* =====================================================================
   TYPE SPECIFICATIONS
   ===================================================================== */
const TS={
 A320:{k:'narrow',nl:0.118,tl:0.225,p:2.15,nd:0.20,hr:1.035,upw:0.62,wl:'sharklet',eng:'cfm',R:0.53,fin:3.0,stab:0.36,win:0.60,gear:1,mzf:1.7},
 A321:{k:'narrow',nl:0.105,tl:0.205,p:2.15,nd:0.20,hr:1.035,upw:0.60,wl:'sharklet',eng:'cfm',R:0.53,fin:3.0,stab:0.36,win:0.60,gear:1,mzf:1.7},
 B738:{k:'narrow',nl:0.120,tl:0.230,p:2.30,nd:0.14,hr:1.00,upw:0.55,wl:'blended',eng:'cfm737',R:0.50,fin:2.95,stab:0.35,win:0.62,gear:1,mzf:1.7},
 E190:{k:'regional',nl:0.115,tl:0.225,p:2.05,nd:0.16,hr:1.05,upw:0.55,wl:'small',eng:'cf34',R:0.50,fin:2.8,stab:0.36,win:0.60,gear:1,mzf:1.7},
 E175:{k:'regional',nl:0.118,tl:0.225,p:2.05,nd:0.16,hr:1.05,upw:0.55,wl:'small',eng:'cf34',R:0.50,fin:2.8,stab:0.36,win:0.60,gear:1,mzf:1.7},
 DH8D:{k:'prop',nl:0.105,tl:0.265,p:1.95,nd:0.10,hr:1.06,upw:0.50,wl:null,eng:'prop',R:0.50,fin:3.1,stab:0.30,win:0.64,gear:1,mzf:0},
 A333:{k:'wide',nl:0.125,tl:0.195,p:2.05,nd:0.20,hr:1.03,upw:0.52,wl:'fence',eng:'trent',R:0.58,fin:2.55,stab:0.33,win:0.58,gear:2,mzf:1.7},
 A359:{k:'wide',nl:0.130,tl:0.190,p:1.95,nd:0.24,hr:1.00,upw:0.48,wl:'curved',eng:'xwb',R:0.60,fin:2.55,stab:0.33,win:0.58,gear:3,mzf:1.7},
 B789:{k:'wide',nl:0.128,tl:0.190,p:2.00,nd:0.18,hr:1.00,upw:0.52,wl:'raked',eng:'gen',R:0.60,fin:2.55,stab:0.33,win:0.58,gear:3,mzf:1.7},
 B77W:{k:'wide',nl:0.120,tl:0.185,p:2.15,nd:0.12,hr:1.00,upw:0.60,wl:'raked',eng:'ge90',R:0.68,fin:2.50,stab:0.33,win:0.56,gear:3,mzf:1.7},
 A388:{k:'super',nl:0.115,tl:0.190,p:1.90,nd:0.10,hr:1.20,upw:0.30,wl:'fence',eng:'trent',R:0.50,fin:2.55,stab:0.30,win:0.55,gear:2,mzf:3.5},
 // ---- later additions (cloned / tuned from the benchmark types)
 A319:{k:'narrow',nl:0.122,tl:0.225,p:2.15,nd:0.20,hr:1.035,upw:0.62,wl:'sharklet',eng:'cfm',R:0.53,fin:3.0,stab:0.36,win:0.60,gear:1,mzf:1.7},
 A20N:{k:'narrow',nl:0.118,tl:0.225,p:2.15,nd:0.20,hr:1.035,upw:0.62,wl:'sharklet',eng:'cfm',R:0.58,fin:3.0,stab:0.36,win:0.60,gear:1,mzf:1.7},
 A21N:{k:'narrow',nl:0.105,tl:0.205,p:2.15,nd:0.20,hr:1.035,upw:0.60,wl:'sharklet',eng:'cfm',R:0.58,fin:3.0,stab:0.36,win:0.60,gear:1,mzf:1.7},
 B38M:{k:'narrow',nl:0.120,tl:0.230,p:2.30,nd:0.14,hr:1.00,upw:0.55,wl:'blended',eng:'cfm737',R:0.53,fin:2.95,stab:0.35,win:0.62,gear:1,mzf:1.7},
 B752:{k:'narrow',nl:0.105,tl:0.200,p:2.20,nd:0.15,hr:1.00,upw:0.50,wl:'blended',eng:'cfm737',R:0.56,fin:2.9,stab:0.34,win:0.62,gear:1,mzf:1.8},
 B763:{k:'wide',nl:0.120,tl:0.200,p:2.10,nd:0.14,hr:1.00,upw:0.48,wl:'blended',eng:'ge90',R:0.54,fin:2.5,stab:0.33,win:0.58,gear:2,mzf:1.6},
 B772:{k:'wide',nl:0.120,tl:0.185,p:2.15,nd:0.12,hr:1.00,upw:0.58,wl:null,eng:'ge90',R:0.66,fin:2.5,stab:0.33,win:0.56,gear:3,mzf:1.7},
 B788:{k:'wide',nl:0.130,tl:0.195,p:2.00,nd:0.18,hr:1.00,upw:0.52,wl:'raked',eng:'gen',R:0.58,fin:2.55,stab:0.33,win:0.58,gear:3,mzf:1.7},
 A332:{k:'wide',nl:0.125,tl:0.195,p:2.05,nd:0.20,hr:1.03,upw:0.52,wl:'fence',eng:'trent',R:0.56,fin:2.55,stab:0.33,win:0.58,gear:2,mzf:1.7},
 A339:{k:'wide',nl:0.125,tl:0.195,p:2.05,nd:0.20,hr:1.03,upw:0.52,wl:'raked',eng:'trent',R:0.62,fin:2.55,stab:0.33,win:0.58,gear:2,mzf:1.7},
 A35K:{k:'wide',nl:0.125,tl:0.185,p:1.95,nd:0.24,hr:1.00,upw:0.48,wl:'curved',eng:'xwb',R:0.62,fin:2.55,stab:0.33,win:0.58,gear:3,mzf:1.7},
 B744:{k:'wide',ws:'jumbo',nl:0.115,tl:0.190,p:2.10,nd:0.12,hr:1.00,upw:0.62,wl:'small',eng:'ge90',R:0.55,fin:2.5,stab:0.33,win:0.56,gear:3,mzf:1.7,hump:0.52,h0:0.60,hp:0.855,h1:0.915},
 B748:{k:'wide',ws:'jumbo',nl:0.112,tl:0.185,p:2.10,nd:0.12,hr:1.00,upw:0.62,wl:'raked',eng:'gen',R:0.58,fin:2.5,stab:0.33,win:0.56,gear:3,mzf:1.7,hump:0.52,h0:0.60,hp:0.86,h1:0.915},
 B742:{k:'wide',ws:'jumbo',nl:0.115,tl:0.190,p:2.10,nd:0.12,hr:1.00,upw:0.62,wl:null,eng:'ge90',R:0.55,fin:2.4,stab:0.33,win:0.56,gear:3,mzf:1.7,hump:0.50,h0:0.66,hp:0.88,h1:0.925},
 A343:{k:'wide',nl:0.125,tl:0.195,p:2.05,nd:0.20,hr:1.03,upw:0.52,wl:'fence',eng:'cfm',R:0.50,fin:2.55,stab:0.33,win:0.58,gear:2,mzf:1.7},
 A346:{k:'wide',nl:0.115,tl:0.185,p:2.05,nd:0.20,hr:1.03,upw:0.52,wl:'fence',eng:'trent',R:0.54,fin:2.45,stab:0.33,win:0.58,gear:3,mzf:1.7},
 A3ST:{k:'wide',nl:0.115,tl:0.225,p:2.10,nd:0.12,hr:1.00,upw:0.30,wl:null,eng:'ge90',R:0.50,fin:2.0,stab:0.33,win:0.56,gear:2,mzf:1.7,hump:1.15,h0:0.10,hp:0.62,h1:0.93,humpw:0.35},
 B74L:{k:'wide',ws:'jumbo',nl:0.115,tl:0.190,p:2.10,nd:0.12,hr:1.00,upw:0.62,wl:'small',eng:'ge90',R:0.55,fin:2.5,stab:0.33,win:0.56,gear:3,mzf:1.7,hump:0.95,h0:0.14,hp:0.52,h1:0.84,humpw:0.40}
};
const WSPEC={ // planform; same numbers gfx.js used so gear / engine placement stays consistent
 narrow:{rootC:0.158,tipC:0.04,sweep:25,dih:5,wy:-0.45,lex:0.16,eng:0.32,kink:0.36,kc:0.60,tw:-3,tr:0.10},
 regional:{rootC:0.15,tipC:0.042,sweep:23,dih:5,wy:-0.42,lex:0.15,eng:0.33,kink:0.38,kc:0.62,tw:-3,tr:0.11},
 wide:{rootC:0.172,tipC:0.03,sweep:32,dih:6,wy:-0.42,lex:0.14,eng:0.31,kink:0.34,kc:0.58,tw:-4,tr:0.105},
 super:{rootC:0.172,tipC:0.03,sweep:33,dih:5,wy:-0.42,lex:0.14,eng:0.31,kink:0.34,kc:0.58,tw:-4,tr:0.115},
 jumbo:{rootC:0.18,tipC:0.028,sweep:37.5,dih:6,wy:-0.42,lex:0.13,eng:0.31,kink:0.36,kc:0.58,tw:-4,tr:0.105},
 prop:{rootC:0.115,tipC:0.066,sweep:3,dih:1.5,wy:0.80,lex:0.10,eng:0.30,kink:0.45,kc:0.82,tw:-2,tr:0.15}
};

/* =====================================================================
   FUSELAGE LOFT
   ===================================================================== */
function secAt(t,L,rf,S){
 // returns {y0,w,h,n} for fraction t (0 tail … 1 nose)
 const nl=S.nl,tl=S.tl;let s;
 if(t>1-nl){const u=(1-t)/nl,r=Math.sqrt(Math.max(0,1-Math.pow(1-u,S.p)));
  s={y0:-rf*S.nd*Math.pow(1-u,2.2)+(S.k==='super'?rf*0.04:0),w:rf*r,h:rf*S.hr*r*(1+0.05*(1-u)*0),n:2.0+0.35*u};
  // windscreen shoulder: slightly lift the roof behind the nose
  s.h+=rf*0.04*Math.sin(u*Math.PI)*(1-u)*0;}
 else if(t<tl){const v=t/tl,q=1-v,r=0.055+0.945*Math.pow(Math.max(0,1-Math.pow(q,2.15)),0.72);
  s={y0:rf*S.upw*q*q*(S.k==='prop'?1.15:1),w:rf*r*(1-0.16*q),h:rf*S.hr*r,n:2.2};}
 else s={y0:S.k==='super'?rf*0.05:0,w:rf,h:rf*S.hr,n:S.k==='super'?2.45:2.15};
 if(S.hump&&t>S.h0&&t<S.h1){let b=t<S.hp?(t-S.h0)/(S.hp-S.h0):(S.h1-t)/(S.h1-S.hp);b=b*b*(3-2*b);const d=rf*S.hump*b;s.y0+=d*0.5;s.h+=d*0.5;if(S.humpw)s.w+=rf*S.humpw*b;}
 return s;
}
function fusPoint(t,th,L,rf,S,out,off){
 const s=secAt(t,L,rf,S),c=Math.cos(th),sn=Math.sin(th);
 let y=s.h*spow(c,2/s.n),z=s.w*spow(sn,2/s.n);
 if(off){const d=Math.hypot(y/(s.h||1),z/(s.w||1))||1;y+=off*(y/(s.h||1))/d;z+=off*(z/(s.w||1))/d;}
 out.set((t-0.5)*L,s.y0+y,z);return out;
}
function fusTs(S,sec){
 const ts=[],nl=S.nl,tl=S.tl,nN=Math.round(sec*0.30),nT=Math.round(sec*0.30),nC=Math.round(sec*0.40);
 for(let i=0;i<=nT;i++){const v=i/nT;ts.push(tl*(1-Math.pow(1-v,1.6)));}   // dense toward the tail end
 for(let i=1;i<nC;i++)ts.push(tl+(1-nl-tl)*i/nC);
 for(let i=0;i<=nN;i++){const u=i/nN;ts.push(1-nl+nl*(1-Math.pow(1-u,1.9)*1));}
 // ensure monotonic & unique
 const o=[];for(const t of ts)if(!o.length||t>o[o.length-1]+1e-5)o.push(Math.min(1,t));return o;
}
function fuselageGeo(L,rf,S,ring,sec){
 const ts=fusTs(S,sec),P=[],U=[],I=[],v=new V3();
 ts.forEach((t,k)=>{for(let j=0;j<=ring;j++){const th=j/ring*TAU;fusPoint(t,th,L,rf,S,v);P.push(v.x,v.y,v.z);U.push(j/ring,t);}});
 const R1=ring+1;
 for(let k=0;k<ts.length-1;k++)for(let j=0;j<ring;j++){const a=k*R1+j,b=a+1,c=a+R1,d=c+1;I.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();
 // winding check: first quad of mid section should face outward
 {const k=Math.floor(ts.length/2),j=Math.floor(ring/4),a=(k*R1+j)*3,c=((k+1)*R1+j)*3,b=(k*R1+j+1)*3,p=g.attributes.position.array;
  const e1=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],e2=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
  const n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];
  const out=[0,p[a+1]-0,p[a+2]];if(n[1]*out[1]+n[2]*out[2]>0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const q=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=q;}g.computeVertexNormals();}}
 g.setAttribute('uv2',g.attributes.uv.clone());
 // average seam normals
 const nn=g.attributes.normal;for(let k=0;k<ts.length;k++){const a=k*R1,b=a+ring;const x=nn.getX(a)+nn.getX(b),y=nn.getY(a)+nn.getY(b),z=nn.getZ(a)+nn.getZ(b),l=Math.hypot(x,y,z)||1;nn.setXYZ(a,x/l,y/l,z/l);nn.setXYZ(b,x/l,y/l,z/l);}
 return g;
}
// patch of the hull surface (glass panels, frames, fairings) following the same loft
function hullPatch(L,rf,S,t0,t1,a0,a1,a2,a3,off,nu,nv,mirror){
 // t from t0..t1 ; angle range varies linearly along t: at t0 [a0,a1], at t1 [a2,a3]
 const P=[],I=[],v=new V3();
 for(let i=0;i<=nu;i++){const f=i/nu,t=lerp(t0,t1,f),A=lerp(a0,a2,f),B=lerp(a1,a3,f);
  for(let j=0;j<=nv;j++){const th=lerp(A,B,j/nv)*(mirror||1);fusPoint(t,th,L,rf,S,v,off);P.push(v.x,v.y,v.z);}}
 for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,b=a+1,c=a+nv+1,d=c+1;I.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
 // orient outward
 const p=g.attributes.position.array,n=g.attributes.normal.array,m=Math.floor(p.length/6)*3;
 if(n[m+1]*p[m+1]+n[m+2]*p[m+2]<0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const q=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=q;}g.computeVertexNormals();}
 return g;
}

/* =====================================================================
   LIFTING SURFACES
   sec: {x (LE), y, z (abs), c (chord), tc (thickness ratio), cam (camber ratio), tw (twist rad), ny, nz (thickness direction, side-agnostic nz), u}
   ===================================================================== */
function liftSurface(secs,side,K){
 K=K||16;const P=[],U=[],I=[],ring=(K+1)*2;
 const S=[];for(let i=0;i<=K;i++)S.push((1-Math.cos(Math.PI*i/K))/2);
 secs.forEach(sc=>{
  const ny=sc.ny===undefined?1:sc.ny,nzv=(sc.nz||0)*side,nl=Math.hypot(ny,nzv)||1,Ny=ny/nl,Nz=nzv/nl;
  const pts=[];
  for(let surf=0;surf<2;surf++)for(let i=0;i<=K;i++){
   const s=S[i],yt=5*sc.tc*(0.2969*Math.sqrt(s)-0.1260*s-0.3516*s*s+0.2843*s*s*s-0.1036*s*s*s*s),yc=(sc.cam||0)*4*s*(1-s)*(1-0.35*s);
   let px=-s*sc.c,pn=yc+(surf===0?yt:-yt)*sc.c/sc.c;pn*=sc.c;
   if(sc.tw){const qx=px+0.25*sc.c,cs=Math.cos(sc.tw),sn=Math.sin(sc.tw),rx=qx*cs-pn*sn,rn=qx*sn+pn*cs;px=rx-0.25*sc.c;pn=rn;}
   P.push(sc.x+px,sc.y+Ny*pn,side*sc.z+Nz*pn);
   U.push(sc.u,surf===0?1-0.5*s:0.5-0.5*s);
  }
 });
 const Ns=secs.length;
 for(let k=0;k<Ns-1;k++)for(let surf=0;surf<2;surf++)for(let i=0;i<K;i++){
  const a=k*ring+surf*(K+1)+i,b=a+1,c=a+ring,d=c+1;
  if(surf===0)I.push(a,b,c,b,d,c);else I.push(a,c,b,b,c,d);}
 // trailing-edge closure
 for(let k=0;k<Ns-1;k++){const a=k*ring+K,b=k*ring+(K+1)+K,c=a+ring,d=b+ring;I.push(a,c,b,b,c,d);}
 // tip cap
 {const base=(Ns-1)*ring;for(let i=0;i<K;i++){I.push(base+i,base+(K+1)+i,base+i+1,base+i+1,base+(K+1)+i,base+(K+1)+i+1);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();
 // winding: upper-surface mid quad must face +N
 {const sc=secs[0],ny=sc.ny===undefined?1:sc.ny,nzv=(sc.nz||0)*side,nl=Math.hypot(ny,nzv)||1;const a=(Math.floor(K/2))*3,c=(ring+Math.floor(K/2))*3,b=(Math.floor(K/2)+1)*3,p=g.attributes.position.array;
  const e1=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],e2=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]];
  const n1=e1[2]*e2[0]-e1[0]*e2[2],n2=e1[0]*e2[1]-e1[1]*e2[0];
  // triangle (a,b,c) is an upper-surface triangle: its normal should have positive component along N
  if(n1*(ny/nl)+n2*(nzv/nl)<0){const ix=g.index.array;for(let i=0;i<ix.length;i+=3){const q=ix[i+1];ix[i+1]=ix[i+2];ix[i+2]=q;}g.computeVertexNormals();}}
 // blend LE normals
 const nn=g.attributes.normal;for(let k=0;k<Ns;k++){const a=k*ring,b=a+K+1;const x=nn.getX(a)+nn.getX(b),y=nn.getY(a)+nn.getY(b),z=nn.getZ(a)+nn.getZ(b),l=Math.hypot(x,y,z)||1;nn.setXYZ(a,x/l,y/l,z/l);nn.setXYZ(b,x/l,y/l,z/l);}
 g.setAttribute('uv2',g.attributes.uv.clone());
 return g;
}

/* =====================================================================
   TEXTURES
   ===================================================================== */
const REGP={BAW:'G-EU',DLH:'D-AI',AFR:'F-HB',EZY:'G-UZ',RYR:'EI-E',KLM:'PH-B',VIR:'G-V',UAE:'A6-E',SAS:'SE-R',QTR:'A7-A',ETD:'A6-E',THY:'TC-J',SWR:'HB-J',IBE:'EC-M',SIA:'9V-S',SCO:'9V-T',AAL:'N',DAL:'N',UAL:'N',SWA:'N',JBU:'N',ASA:'N',ACA:'C-F',FDB:'A6-F',JAL:'JA',ANA:'JA',QFA:'VH-O',JST:'VH-V',VOZ:'VH-Y',ANZ:'ZK-O',TRA:'PH-H'};
const FLAG={BAW:'uk',VIR:'uk',EZY:'uk',DLH:'de',AFR:'fr',RYR:'ie',KLM:'nl',TRA:'nl',UAE:'ae',ETD:'ae',FDB:'ae',SAS:'se',QTR:'qa',THY:'tr',SWR:'ch',IBE:'es',SIA:'sg',SCO:'sg',AAL:'us',DAL:'us',UAL:'us',SWA:'us',JBU:'us',ASA:'us',ACA:'ca',JAL:'jp',ANA:'jp',QFA:'au',JST:'au',VOZ:'au',ANZ:'nz'};
function regOf(al,R){const p=REGP[al.icao]||'N',L=()=>String.fromCharCode(65+Math.floor(R()*26)),D=()=>Math.floor(R()*10);
 if(p==='N')return 'N'+(100+Math.floor(R()*899))+L()+L();if(p==='JA')return 'JA'+(100+Math.floor(R()*899))+L();
 return p+(p.length<4||/-.$/.test(p)?L()+L():L());}
function flag(x,k,fx,fy,w,h){
 const bands=(cols,vert)=>cols.forEach((c,i)=>{x.fillStyle=c;if(vert)x.fillRect(fx+w*i/cols.length,fy,w/cols.length+0.5,h);else x.fillRect(fx,fy+h*i/cols.length,w,h/cols.length+0.5);});
 switch(k){
  case'uk':x.fillStyle='#012169';x.fillRect(fx,fy,w,h);x.strokeStyle='#fff';x.lineWidth=h*0.2;x.beginPath();x.moveTo(fx,fy);x.lineTo(fx+w,fy+h);x.moveTo(fx+w,fy);x.lineTo(fx,fy+h);x.stroke();x.strokeStyle='#c8102e';x.lineWidth=h*0.07;x.stroke();
   x.fillStyle='#fff';x.fillRect(fx+w*0.4,fy,w*0.2,h);x.fillRect(fx,fy+h*0.35,w,h*0.3);x.fillStyle='#c8102e';x.fillRect(fx+w*0.44,fy,w*0.12,h);x.fillRect(fx,fy+h*0.41,w,h*0.18);break;
  case'de':bands(['#111','#dd0000','#ffce00']);break;case'fr':bands(['#0055a4','#fff','#ef4135'],1);break;case'ie':bands(['#169b62','#fff','#ff883e'],1);break;
  case'nl':bands(['#ae1c28','#fff','#21468b']);break;case'se':x.fillStyle='#006aa7';x.fillRect(fx,fy,w,h);x.fillStyle='#fecc00';x.fillRect(fx+w*0.3,fy,w*0.14,h);x.fillRect(fx,fy+h*0.42,w,h*0.16);break;
  case'ae':bands(['#00732f','#fff','#000']);x.fillStyle='#ff0000';x.fillRect(fx,fy,w*0.28,h);break;case'qa':x.fillStyle='#8a1538';x.fillRect(fx,fy,w,h);x.fillStyle='#fff';x.fillRect(fx,fy,w*0.28,h);break;
  case'tr':x.fillStyle='#e30a17';x.fillRect(fx,fy,w,h);x.fillStyle='#fff';x.beginPath();x.arc(fx+w*0.38,fy+h/2,h*0.3,0,TAU);x.fill();x.fillStyle='#e30a17';x.beginPath();x.arc(fx+w*0.43,fy+h/2,h*0.25,0,TAU);x.fill();break;
  case'ch':x.fillStyle='#d52b1e';x.fillRect(fx,fy,w,h);x.fillStyle='#fff';x.fillRect(fx+w*0.42,fy+h*0.18,w*0.16,h*0.64);x.fillRect(fx+w*0.28,fy+h*0.4,w*0.44,h*0.2);break;
  case'es':bands(['#aa151b','#f1bf00','#f1bf00','#aa151b']);break;case'sg':bands(['#ef3340','#fff']);break;
  case'us':for(let i=0;i<7;i++){x.fillStyle=i%2?'#fff':'#b22234';x.fillRect(fx,fy+h*i/7,w,h/7+0.5);}x.fillStyle='#3c3b6e';x.fillRect(fx,fy,w*0.42,h*0.54);break;
  case'ca':x.fillStyle='#fff';x.fillRect(fx,fy,w,h);x.fillStyle='#d52b1e';x.fillRect(fx,fy,w*0.25,h);x.fillRect(fx+w*0.75,fy,w*0.25,h);x.beginPath();x.arc(fx+w/2,fy+h/2,h*0.22,0,TAU);x.fill();break;
  case'jp':x.fillStyle='#fff';x.fillRect(fx,fy,w,h);x.fillStyle='#bc002d';x.beginPath();x.arc(fx+w/2,fy+h/2,h*0.3,0,TAU);x.fill();break;
  case'au':case'nz':x.fillStyle='#012169';x.fillRect(fx,fy,w,h);x.fillStyle='#fff';x.fillRect(fx,fy,w*0.45,h*0.45);x.fillStyle='#c8102e';x.fillRect(fx+w*0.2,fy,w*0.06,h*0.45);x.fillRect(fx,fy+h*0.19,w*0.45,h*0.07);break;
 }
 x.strokeStyle='rgba(0,0,0,0.35)';x.lineWidth=1;x.strokeRect(fx,fy,w,h);
}
function rrect(x,px,py,w,h,r){r=Math.min(r,w/2,h/2);x.beginPath();x.moveTo(px+r,py);x.arcTo(px+w,py,px+w,py+h,r);x.arcTo(px+w,py+h,px,py+h,r);x.arcTo(px,py+h,px,py,r);x.arcTo(px,py,px+w,py,r);x.closePath();}
function blotch(x,W,H,R,n,rmin,rmax,col,a0,a1,ymin,ymax){for(let i=0;i<n;i++){const px=R()*W,py=lerp(ymin||0,ymax||H,R()),r=lerp(rmin,rmax,R()),a=lerp(a0,a1,R());const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba('+col+','+a+')');g.addColorStop(1,'rgba('+col+',0)');x.fillStyle=g;x.fillRect(px-r,py-r,r*2,r*2);}}
function streak(x,px,py,len,w,col,a){const g=x.createLinearGradient(0,py,0,py+len);g.addColorStop(0,'rgba('+col+',0)');g.addColorStop(0.15,'rgba('+col+','+a+')');g.addColorStop(1,'rgba('+col+',0)');x.fillStyle=g;x.fillRect(px-w/2,py,w,len);}

const HULLD={
 A320:{doors:[0.845,0.225],exits:[0.505],w0:0.19,w1:0.83,cargo:[0.735,0.31],pitch:0.53},
 A321:{doors:[0.87,0.715,0.275,0.145],exits:[0.535,0.465],w0:0.115,w1:0.855,cargo:[0.775,0.2],pitch:0.53},
 B738:{doors:[0.83,0.215],exits:[0.495,0.55],w0:0.185,w1:0.81,cargo:[0.72,0.30],pitch:0.55},
 E190:{doors:[0.835,0.215],exits:[0.51],w0:0.2,w1:0.82,cargo:[0.28],pitch:0.55},
 E175:{doors:[0.835,0.215],exits:[0.51],w0:0.2,w1:0.82,cargo:[0.28],pitch:0.55},
 DH8D:{doors:[0.14,0.80],exits:[0.50],w0:0.24,w1:0.76,cargo:[0.84],pitch:0.52},
 A333:{doors:[0.875,0.775,0.585,0.395,0.185],exits:[],w0:0.095,w1:0.895,cargo:[0.69,0.30],pitch:0.53},
 A359:{doors:[0.875,0.78,0.60,0.345,0.185],exits:[],w0:0.09,w1:0.9,cargo:[0.69,0.30],pitch:0.53},
 B789:{doors:[0.885,0.795,0.60,0.335,0.18],exits:[],w0:0.09,w1:0.9,cargo:[0.70,0.30],pitch:0.55},
 B77W:{doors:[0.885,0.80,0.585,0.315,0.185],exits:[],w0:0.085,w1:0.9,cargo:[0.71,0.30],pitch:0.55},
 A319:{doors:[0.835,0.215],exits:[0.50],w0:0.19,w1:0.83,cargo:[0.72,0.30],pitch:0.53},
 A20N:{doors:[0.845,0.225],exits:[0.505],w0:0.19,w1:0.83,cargo:[0.735,0.31],pitch:0.53},
 A21N:{doors:[0.87,0.715,0.275,0.145],exits:[0.535,0.465],w0:0.115,w1:0.855,cargo:[0.775,0.2],pitch:0.53},
 B38M:{doors:[0.83,0.215],exits:[0.495,0.55],w0:0.185,w1:0.81,cargo:[0.72,0.30],pitch:0.55},
 B752:{doors:[0.865,0.17],exits:[0.52,0.585],w0:0.14,w1:0.84,cargo:[0.74,0.26],pitch:0.55},
 B763:{doors:[0.875,0.72,0.43,0.15],exits:[],w0:0.10,w1:0.89,cargo:[0.66,0.28],pitch:0.55},
 B772:{doors:[0.885,0.78,0.60,0.34,0.185],exits:[],w0:0.09,w1:0.90,cargo:[0.69,0.30],pitch:0.55},
 B788:{doors:[0.885,0.79,0.60,0.34,0.18],exits:[],w0:0.09,w1:0.90,cargo:[0.70,0.30],pitch:0.55},
 A332:{doors:[0.875,0.775,0.585,0.395,0.185],exits:[],w0:0.095,w1:0.895,cargo:[0.69,0.30],pitch:0.53},
 A339:{doors:[0.875,0.775,0.585,0.395,0.185],exits:[],w0:0.095,w1:0.895,cargo:[0.69,0.30],pitch:0.53},
 A35K:{doors:[0.885,0.80,0.62,0.37,0.19],exits:[],w0:0.09,w1:0.905,cargo:[0.71,0.30],pitch:0.53},
 B744:{doors:[0.915,0.80,0.665,0.47,0.30,0.145],exits:[],w0:0.07,w1:0.92,cargo:[0.74,0.31],pitch:0.55},
 B748:{doors:[0.92,0.81,0.68,0.49,0.32,0.15],exits:[],w0:0.07,w1:0.92,cargo:[0.75,0.31],pitch:0.55},
 B742:{doors:[0.915,0.80,0.665,0.47,0.30,0.145],exits:[],w0:0.07,w1:0.92,cargo:[0.74,0.31],pitch:0.55},
 A343:{doors:[0.875,0.775,0.585,0.395,0.185],exits:[],w0:0.095,w1:0.895,cargo:[0.69,0.30],pitch:0.53},
 A346:{doors:[0.895,0.80,0.68,0.52,0.36,0.185],exits:[],w0:0.085,w1:0.905,cargo:[0.72,0.31],pitch:0.53},
 A3ST:{doors:[0.90,0.06],exits:[],w0:0.5,w1:0.5,cargo:[0.40],pitch:0.55},
 B74L:{doors:[0.915,0.06],exits:[],w0:0.5,w1:0.5,cargo:[0.40],pitch:0.55},
 A388:{doors:[0.905,0.835,0.665,0.415,0.225],exits:[],w0:0.085,w1:0.925,cargo:[0.74,0.33],pitch:0.55,deck2:true}
};
const LAYC={};
function hullLayout(ty,variant){
 const key=ty.n+variant;if(LAYC[key])return LAYC[key];
 const S=TS[ty.n]||TS.A320,H=HULLD[ty.n]||HULLD.A320,L=ty.len,rf=ty.rf,R=mul(seedOf('lay'+key));
 const lay={ty,S,H,L,rf,R,seed:seedOf('lay'+key),wins:[],seamC:[],seamL:[],panels:[],reg:null};
 const dm=(ty.wide?1.1:0.95)/L,skip=t=>{for(const d of H.doors)if(Math.abs(t-d)<dm*0.62+0.3/L)return true;for(const d of H.exits)if(Math.abs(t-d)<0.78/L)return true;return false;};
 for(let t=H.w0;t<H.w1;t+=H.pitch/L){if(skip(t))continue;lay.wins.push(t);}
 for(let m=1.4;m<L-1;m+=2.7+R()*0.9){const t=1-m/L;const bands=6,off=R();for(let b=0;b<bands;b++){const u0=(b+off*0.3)/bands*0.5,u1=(b+1+off*0.3)/bands*0.5;const dj=(R()-0.5)*0.8/L;lay.seamC.push([t+dj,u0,Math.min(0.5,u1)]);lay.seamC.push([t+dj,1-Math.min(0.5,u1),1-u0]);}}
 const nl=ty.wide?26:20;for(let i=1;i<nl;i++)lay.seamL.push(i/nl+(R()-0.5)*0.004);
 for(let i=0;i<10;i++)lay.panels.push([R(),H.w0+(H.w1-H.w0)*R(),0.015+R()*0.03,(0.3+R()*0.6)*2.2/L]);
 return LAYC[key]=lay;
}
/* draw hull structure into whichever layers are present: c={x:colour,h:height,r:rough,a:ao,e:emissive} */
function drawHull(c,lay,W,H){
 const ty=lay.ty,L=lay.L,rf=lay.rf,Y=t=>(1-t)*H,X=u=>u*W,ppm=W/(TAU*rf*1.03),pyl=H/L;
 const D=lay.H;
 // panel tone variation (colour only)
 var x=c.x,h=c.h,r=c.r,a=c.a,e=c.e;const RT=mul(lay.seed^0x5151),RW=mul(lay.seed^0x7777);
 // seams: circumferential panel breaks
 for(let i=0;i<lay.seamC.length;i++){const s=lay.seamC[i],q=[RT(),RT(),RT(),RT()];if(x&&q[0]<0.55){x.fillStyle='rgba('+(q[1]<0.5?'255,255,255':'0,0,0')+','+(0.012+q[2]*0.022)+')';x.fillRect(X(s[1]),Y(s[0]),X(s[2])-X(s[1]),pyl*(1.3+q[3]*1.4)*2);}}
 const lines=(ctx,col,wd,fn)=>{if(!ctx)return;ctx.strokeStyle=col;ctx.lineWidth=wd;ctx.beginPath();fn(ctx);ctx.stroke();};
 const segC=ctx=>{for(const s of lay.seamC){ctx.moveTo(X(s[1]),Y(s[0]));ctx.lineTo(X(s[2]),Y(s[0]));}};
 const segL=ctx=>{for(const u of lay.seamL){ctx.moveTo(X(u),0);ctx.lineTo(X(u),H);}};
 lines(h,'rgb(104,104,104)',1.6,segC);lines(h,'rgb(112,112,112)',1.4,segL);
 if(h){h.setLineDash([1.2,5]);lines(h,'rgb(158,158,158)',1.6,ctx=>{for(const s of lay.seamC){ctx.moveTo(X(s[1]),Y(s[0])-3.2);ctx.lineTo(X(s[2]),Y(s[0])-3.2);ctx.moveTo(X(s[1]),Y(s[0])+3.2);ctx.lineTo(X(s[2]),Y(s[0])+3.2);}});
  lines(h,'rgb(158,158,158)',1.6,ctx=>{for(const u of lay.seamL){ctx.moveTo(X(u)-3,0);ctx.lineTo(X(u)-3,H);}});h.setLineDash([]);}
 lines(x,'rgba(46,54,62,0.20)',1,segC);lines(x,'rgba(46,54,62,0.14)',1,segL);
 if(x){x.setLineDash([1.2,5]);lines(x,'rgba(60,66,72,0.30)',1,ctx=>{for(const s of lay.seamC){ctx.moveTo(X(s[1]),Y(s[0])-3.2);ctx.lineTo(X(s[2]),Y(s[0])-3.2);}});x.setLineDash([]);}
 lines(a,'rgba(0,0,0,0.20)',2.4,segC);lines(a,'rgba(0,0,0,0.12)',2,segL);lines(r,'rgb(120,120,120)',2,segC);
 // windows
 const ww=0.235*ppm,wh=0.34*pyl,decks=D.deck2?[[0.205,0.795,0],[0.128,0.872,1]]:[[0.183,0.817,0]];
 const upper=D.deck2;
 const winAt=(u,t,sc)=>{
  const cx=X(u),cy=Y(t),q1=RW(),q2=RW(),q3=RW();
  // frame
  if(x){rrect(x,cx-ww*0.82,cy-wh*0.78,ww*1.64,wh*1.56,ww*0.55);x.fillStyle='rgba(188,194,200,0.55)';x.fill();
   rrect(x,cx-ww/2,cy-wh/2,ww,wh,ww*0.42);const g=x.createLinearGradient(cx,cy-wh/2,cx,cy+wh/2);g.addColorStop(0,'#26333f');g.addColorStop(0.5,'#10181f');g.addColorStop(1,'#1b2630');x.fillStyle=g;x.fill();
   if(q1<0.22){rrect(x,cx-ww/2,cy-wh/2,ww,wh*(0.25+q2*0.4),ww*0.4);x.fillStyle='rgba(232,236,240,0.9)';x.fill();}}
  if(h){rrect(h,cx-ww*0.82,cy-wh*0.78,ww*1.64,wh*1.56,ww*0.55);h.fillStyle='rgb(150,150,150)';h.fill();rrect(h,cx-ww/2,cy-wh/2,ww,wh,ww*0.42);h.fillStyle='rgb(82,82,82)';h.fill();}
  if(r){rrect(r,cx-ww/2,cy-wh/2,ww,wh,ww*0.42);r.fillStyle='rgb(18,18,18)';r.fill();}
  if(a){rrect(a,cx-ww*0.9,cy-wh*0.85,ww*1.8,wh*1.7,ww*0.6);a.strokeStyle='rgba(0,0,0,0.35)';a.lineWidth=3;a.stroke();}
  if(e){rrect(e,cx-ww/2,cy-wh/2,ww,wh,ww*0.42);const k=q3;e.fillStyle=k<0.12?'#3c4a66':k<0.2?'#c8d8ff':'#ffd9a0';e.globalAlpha=0.55+q2*0.45;e.fill();e.globalAlpha=1;}
 };
 for(const t of lay.wins){for(const d of decks){winAt(d[0],t);winAt(d[1],t);}}
 if(upper){for(const t of lay.wins){if(t<0.17||t>0.86)continue;}}
 // doors
 const dw=(ty.wide?1.1:0.95)*ppm,dh=(ty.wide?1.9:1.75)*pyl,doorU=ty.n==='A388'?[0.215,0.785]:[0.215,0.785];
 const doorAt=(u,t,w,hh,exit,cargo)=>{const cx=X(u),cy=Y(t);
  if(x){rrect(x,cx-w/2,cy-hh/2,w,hh,w*0.18);x.strokeStyle='rgba(52,60,68,0.9)';x.lineWidth=2.2;x.stroke();x.strokeStyle='rgba(255,255,255,0.18)';x.lineWidth=1;rrect(x,cx-w/2+2,cy-hh/2+2,w-4,hh-4,w*0.16);x.stroke();
   if(!exit&&!cargo){rrect(x,cx-w*0.22,cy-hh*0.32,w*0.44,w*0.44,w*0.2);x.fillStyle='#10181f';x.fill();x.strokeStyle='rgba(190,196,202,0.7)';x.lineWidth=1.6;x.stroke();x.fillStyle='rgba(40,48,56,0.55)';x.fillRect(cx+w*0.2,cy+hh*0.05,w*0.14,hh*0.1);}
   if(exit){x.fillStyle='rgba(30,38,46,0.55)';x.fillRect(cx-w*0.1,cy-hh*0.1,w*0.2,hh*0.12);}
   if(!exit&&!cargo){x.fillStyle='rgba(200,40,40,0.8)';x.fillRect(cx+w*0.28,cy-hh*0.46,w*0.1,hh*0.03);}}
  if(h){rrect(h,cx-w/2,cy-hh/2,w,hh,w*0.18);h.strokeStyle='rgb(70,70,70)';h.lineWidth=3;h.stroke();h.strokeStyle='rgb(150,150,150)';h.lineWidth=1.4;rrect(h,cx-w/2-3,cy-hh/2-3,w+6,hh+6,w*0.2);h.stroke();if(!exit&&!cargo){rrect(h,cx-w*0.22,cy-hh*0.32,w*0.44,w*0.44,w*0.2);h.fillStyle='rgb(88,88,88)';h.fill();}}
  if(a){rrect(a,cx-w/2,cy-hh/2,w,hh,w*0.18);a.strokeStyle='rgba(0,0,0,0.5)';a.lineWidth=3.5;a.stroke();}
  if(r&&!exit&&!cargo){rrect(r,cx-w*0.22,cy-hh*0.32,w*0.44,w*0.44,w*0.2);r.fillStyle='rgb(20,20,20)';r.fill();}};
 const dY=(ty.wide?1:1);
 for(const t of D.doors){for(const u of[0.21,0.79]){doorAt(u,t,dw,dh,false,false);}}
 if(D.deck2){for(const t of D.doors.slice(0,4)){for(const u of[0.13,0.87])doorAt(u,t,dw*0.8,dh*0.8,false,false);}}
 for(const t of D.exits){for(const u of[0.21,0.79])doorAt(u,t,0.52*ppm,1.0*pyl,true,false);}
 // cargo holds (below the window line; right side visible mainly) + service panels
 D.cargo.forEach((t,i)=>{doorAt(0.67,t,(ty.wide?2.7:1.5)*ppm,(ty.wide?1.7:1.2)*pyl,false,true);if(i===0||ty.wide)doorAt(0.33,t+0.02,1.2*ppm,1.0*pyl,false,true);});
 for(const p of lay.panels){const u=0.62+p[0]*0.2,t=p[1],w=p[2]*W*0.55,hh=p[3]*H*0.9;
  if(x){x.strokeStyle='rgba(52,60,68,0.55)';x.lineWidth=1.4;x.strokeRect(X(u),Y(t),w,hh);x.fillStyle='rgba(60,66,72,0.5)';for(const[dx,dy]of[[2,2],[w-2,2],[2,hh-2],[w-2,hh-2]]){x.fillRect(X(u)+dx-0.8,Y(t)+dy-0.8,1.6,1.6);}}
  if(h){h.strokeStyle='rgb(88,88,88)';h.lineWidth=2;h.strokeRect(X(u),Y(t),w,hh);}if(a){a.strokeStyle='rgba(0,0,0,0.35)';a.lineWidth=3;a.strokeRect(X(u),Y(t),w,hh);}}
 // static ports / sensors (colour + bump)
 for(const t of[0.925,0.935])for(const u of[0.29,0.71]){if(x){x.fillStyle='#4a525a';x.beginPath();x.arc(X(u),Y(t),ppm*0.05,0,TAU);x.fill();}if(h){h.fillStyle='rgb(90,90,90)';h.beginPath();h.arc(X(u),Y(t),ppm*0.05,0,TAU);h.fill();}}
}


const hexs=h=>'#'+('000000'+h.toString(16)).slice(-6);
const NAMES={BAW:'British Airways',DLH:'Lufthansa',AFR:'AIR FRANCE',EZY:'easyJet',RYR:'RYANAIR',KLM:'KLM',VIR:'Virgin Atlantic',UAE:'Emirates',SAS:'SAS'};
const INIT={BAW:'BA',DLH:'LH',AFR:'AF',EZY:'easy',RYR:'R',KLM:'KLM',VIR:'V',UAE:'EK',SAS:'SAS'};
function hullDims(ty){const px=ty.n==='A388'?27:ty.wide?31:ty.prop?44:40;return{W:Math.round(TAU*ty.rf*1.03*px),H:Math.round(ty.len*px),px};}
const SHARED={};
function hullShared(ty,variant){
 const key=ty.n+variant;if(SHARED[key])return SHARED[key];
 const lay=hullLayout(ty,variant),{W,H}=hullDims(ty),R=mul(lay.seed^0x99);
 const[hc,h]=cv(W,H),[rc,r]=cv(W,H),[ac,a]=cv(W,H),[ec,e]=cv(W,H);
 h.fillStyle='rgb(128,128,128)';h.fillRect(0,0,W,H);r.fillStyle='rgb(88,88,88)';r.fillRect(0,0,W,H);a.fillStyle='#fff';a.fillRect(0,0,W,H);e.fillStyle='#000';e.fillRect(0,0,W,H);
 // roughness: large soft variation, belly grime rougher, nose/radome smoother
 blotch(r,W,H,R,70,W*0.08,W*0.25,'255,255,255',0.04,0.10);blotch(r,W,H,R,60,W*0.06,W*0.2,'0,0,0',0.05,0.12);
 const gb=r.createLinearGradient(0,0,W,0);[[0.38,0],[0.47,0.28],[0.53,0.28],[0.62,0]].forEach(s=>gb.addColorStop(s[0],'rgba(255,255,255,'+s[1]+')'));r.fillStyle=gb;r.fillRect(0,0,W,H);
 // ambient occlusion: belly + tail-cone + under-wing root shading baked in
 const ga=a.createLinearGradient(0,0,W,0);[[0,0],[0.3,0],[0.42,0.22],[0.5,0.42],[0.58,0.22],[0.7,0],[1,0]].forEach(s=>ga.addColorStop(s[0],'rgba(0,0,0,'+s[1]+')'));a.fillStyle=ga;a.fillRect(0,0,W,H);
 const wl=lay.S.k==='prop'?0.5:0.44;
 for(const sd of[0.30,0.70]){const gg=a.createRadialGradient(sd*W,(1-0.46)*H,0,sd*W,(1-0.46)*H,W*0.16);gg.addColorStop(0,'rgba(0,0,0,0.32)');gg.addColorStop(1,'rgba(0,0,0,0)');a.fillStyle=gg;a.fillRect(0,(1-0.62)*H,W,0.3*H);}
 drawHull({h,r,a,e},lay,W,H);
 const nrm=normalFrom(hc,3.6,true);
 const o={lay,W,H,normalMap:tex(nrm,{lin:true}),roughMap:tex(rc,{lin:true}),aoMap:tex(ac,{lin:true}),emiMap:tex(ec)};
 return SHARED[key]=o;
}
function paintLivery(al,ty,lay,W,H){
 const[c,x]=cv(W,H),L=lay.L,rf=lay.rf,Y=t=>(1-t)*H,X=u=>u*W,ppm=W/(TAU*rf*1.03),pyl=H/L,R=mul(lay.seed^seedOf(al.icao));
 const body=al.body||(al.icao==='VIR'?'#c8102e':al.icao==='AAL'?'#cdd2d6':'#f3f4f4'),tail=hexs(al.tail),acc=hexs(al.acc),ink=al.tailInk||'#fff';
 const isMetal=al.icao==='AAL',redBody=al.icao==='VIR';
 x.fillStyle=body;x.fillRect(0,0,W,H);
 // paint tone variation per panel (very subtle)
 // underside shading (baked) and sun-bleached top
 const gr=x.createLinearGradient(0,0,W,0);[[0,'rgba(255,255,255,0.07)'],[0.12,'rgba(255,255,255,0)'],[0.30,'rgba(0,0,0,0)'],[0.40,'rgba(70,78,88,0.10)'],[0.5,'rgba(52,60,70,0.40)'],[0.6,'rgba(70,78,88,0.10)'],[0.70,'rgba(0,0,0,0)'],[0.88,'rgba(255,255,255,0)'],[1,'rgba(255,255,255,0.07)']].forEach(s=>gr.addColorStop(s[0],s[1]));x.fillStyle=gr;x.fillRect(0,0,W,H);
 if(redBody){const g2=x.createLinearGradient(0,0,W,0);g2.addColorStop(0.45,'rgba(0,0,0,0)');g2.addColorStop(0.5,'rgba(60,0,10,0.3)');g2.addColorStop(0.55,'rgba(0,0,0,0)');x.fillStyle=g2;x.fillRect(0,0,W,H);}
 // dark belly band for airlines with grey belly
 // tail colour block with a swept boundary
 if(al.icao!=='VIR'||true){
  x.fillStyle=tail;x.beginPath();x.moveTo(0,H);const NB=48;
  for(let i=0;i<=NB;i++){const u=i/NB,top=Math.pow(Math.max(0,Math.cos(u*TAU)),1.4),t=0.165+0.075*top-0.02*Math.pow(Math.max(0,-Math.cos(u*TAU)),2);x.lineTo(X(u),Y(t));}
  x.lineTo(W,H);x.closePath();x.fill();
  // paint edge: faint overspray line
  x.strokeStyle='rgba(0,0,0,0.10)';x.lineWidth=1.2;x.beginPath();for(let i=0;i<=NB;i++){const u=i/NB,top=Math.pow(Math.max(0,Math.cos(u*TAU)),1.4),t=0.165+0.075*top-0.02*Math.pow(Math.max(0,-Math.cos(u*TAU)),2);i?x.lineTo(X(u),Y(t)):x.moveTo(X(u),Y(t));}x.stroke();
 }
 // accent cheat line (tapering toward the nose)
 if(!redBody){x.fillStyle=acc;for(const u of[0.232,0.768]){const w0=Math.max(5,0.34*ppm),w1=Math.max(2,0.12*ppm);x.beginPath();x.moveTo(u*W-w0/2,Y(0.19));x.lineTo(u*W+w0/2,Y(0.19));x.lineTo(u*W+w1/2,Y(0.93));x.lineTo(u*W-w1/2,Y(0.93));x.closePath();x.fill();}}
 if(al.deco)al.deco(x,W,H,ppm,X,Y);
 // radome / nose cap, cockpit surround
 x.fillStyle='rgba(58,64,70,0.9)';x.fillRect(0,0,W,Y(0.987));
 x.fillStyle='rgba(30,34,38,0.55)';x.fillRect(0,0,W,Y(0.992));
 // title
 const nm=al.nm||NAMES[al.icao]||al.rt;let fs=0.9*ppm;x.font='700 '+fs+'px Helvetica,Arial,sans-serif';const maxLen=L*pyl*0.40;const tw=x.measureText(nm).width;if(tw>maxLen)fs*=maxLen/tw;
 x.font='700 '+Math.max(10,fs)+'px Helvetica,Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';
 const dark=(al.tail>>16&255)*0.3+(al.tail>>8&255)*0.59+(al.tail&255)*0.11<150,lightBody=body==='#f3f4f4'||body==='#cdd2d6';
 x.fillStyle=redBody?'#ffffff':lightBody?(dark||al.icao==='EZY'?tail:acc==='#ffffff'?tail:tail):(al.tailInk||'#1b1b1b');if(al.icao==='EZY'||al.icao==='RYR')x.fillStyle=al.icao==='RYR'?'#073590':'#ff6600';
 for(const[u,rot]of[[0.30,-Math.PI/2],[0.70,Math.PI/2]]){x.save();x.translate(u*W,Y(0.575));x.rotate(rot);x.scale(1,-1);x.fillText(nm,0,0);x.restore();}
 // registration + flag at the rear
 const reg=regOf(al,R);lay.reg=reg;x.fillStyle='#2b3036';x.font='600 '+Math.max(8,0.46*ppm)+'px Helvetica,Arial,sans-serif';
 for(const[u,rot]of[[0.265,-Math.PI/2],[0.735,Math.PI/2]]){x.save();x.translate(u*W,Y(0.255));x.rotate(rot);x.scale(1,-1);x.fillStyle='#e8eaec';x.fillText(reg,0,0);x.restore();}
 const fk=FLAG[al.icao];if(fk){for(const[u,rot]of[[0.30,-Math.PI/2],[0.70,Math.PI/2]]){x.save();x.translate(u*W,Y(0.35));x.rotate(rot);x.scale(1,-1);flag(x,fk,-0.3*ppm,-0.19*ppm,0.6*ppm,0.38*ppm);x.restore();}}
 // maintenance / servicing stencils
 x.font='600 '+Math.max(6,0.15*ppm)+'px Arial,sans-serif';x.fillStyle='rgba(30,36,42,0.75)';
 const sten=[['FWD CARGO',0.735,0.67],['AFT CARGO',0.31,0.67],['GND POWER',0.88,0.60],['NO PUSH',0.50,0.60],['FUEL',0.52,0.40],['BATTERY',0.95,0.62],['POTABLE WATER',0.12,0.62]];
 for(const[tx,t,u]of sten){for(const uu of[u,1-u]){x.save();x.translate(uu*W,Y(t));x.rotate(uu<0.5?-Math.PI/2:Math.PI/2);x.scale(1,-1);x.textAlign='center';x.fillText(tx,0,0);x.restore();}}
 x.fillStyle='rgba(210,50,40,0.85)';for(const t of[0.935,0.52])for(const u of[0.255,0.745]){x.beginPath();x.moveTo(u*W,Y(t)-4);x.lineTo(u*W+4,Y(t)+3);x.lineTo(u*W-4,Y(t)+3);x.closePath();x.fill();}
 // structure on top
 drawHull({x},lay,W,H);
 // ---- weathering ----
 const WR=mul(lay.seed^seedOf('wx'+al.icao));
 blotch(x,W,H,WR,140,W*0.05,W*0.16,'92,84,72',0.012,0.03);
 // belly grime and fuel / hydraulic residue
 const gg=x.createLinearGradient(0,0,W,0);[[0.34,0],[0.44,0.16],[0.5,0.38],[0.56,0.16],[0.66,0]].forEach(q=>gg.addColorStop(q[0],'rgba(56,50,42,'+q[1]+')'));x.fillStyle=gg;x.fillRect(0,0,W,H);
 blotch(x,W,H,WR,60,W*0.03,W*0.09,'40,34,28',0.05,0.14,0,H);
 // window / door streaks running aft
 for(const t of lay.wins){if(WR()<0.3)for(const u of[0.183,0.817]){streak(x,X(u)+(WR()-0.5)*6,Y(t)-4,pyl*(1.2+WR()*2.2),1+WR()*2,'60,56,50',0.05+WR()*0.05);}}
 for(let i=0;i<46;i++){const u=WR(),t=lerp(0.15,0.95,WR());streak(x,X(u),Y(t),pyl*(0.8+WR()*2.4),1+WR()*2.4,'70,64,56',0.03+WR()*0.05);}
 // nose dirt + bugs, tail-cone soot, wing-root rubbing
 blotch(x,W,H,WR,40,ppm*0.15,ppm*0.45,'46,40,30',0.08,0.2,Y(1),Y(0.93));
 blotch(x,W,H,WR,24,ppm*0.4,ppm*0.9,'20,18,16',0.10,0.2,Y(0.06),Y(0));
 for(const u of[0.23,0.77])blotch(x,W,H,WR,18,ppm*0.3,ppm*0.7,'80,76,70',0.05,0.12,Y(0.51),Y(0.40));
 // door-edge scuffs & paint wear
 for(let i=0;i<30;i++){x.fillStyle='rgba(235,235,235,'+(0.12+WR()*0.12)+')';const t=lerp(0.2,0.9,WR()),u=lerp(0.18,0.82,WR());x.fillRect(X(u),Y(t),1+WR()*3,1+WR()*2);}
 return c;
}
/* ---------- wing / tailplane texture (upper = top half, lower = bottom half) ---------- */
const WTEX={};
function wingTextures(ty,variant){
 const key=ty.n+variant;if(WTEX[key])return WTEX[key];
 const S=TS[ty.n]||TS.A320,WS=WSPEC[S.ws||S.k],R=mul(seedOf('w'+key)),W=2048,H=1024,hf=H/2;
 const[c,x]=cv(W,H),[hc,h]=cv(W,H),[rc,r]=cv(W,H),[ac,a]=cv(W,H);
 const prop=S.k==='prop',half=ty.wing/2,zE=half*WS.eng;
 for(let s=0;s<2;s++){const y0=s*hf;const g=x.createLinearGradient(0,y0,0,y0+hf);if(s===0){g.addColorStop(0,'#dde1e4');g.addColorStop(1,'#cfd5d9');}else{g.addColorStop(0,'#c3c9ce');g.addColorStop(1,'#b6bdc3');}x.fillStyle=g;x.fillRect(0,y0,W,hf);}
 h.fillStyle='rgb(128,128,128)';h.fillRect(0,0,W,H);r.fillStyle='rgb(100,100,100)';r.fillRect(0,0,W,H);a.fillStyle='#fff';a.fillRect(0,0,W,H);
 const U=u=>u*W,V=(v,s)=>s*hf+v*hf;
 const ln=(ctx,s,u0,v0,u1,v1,col,w)=>{ctx.strokeStyle=col;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(U(u0),V(v0,s));ctx.lineTo(U(u1),V(v1,s));ctx.stroke();};
 const both=(s,u0,v0,u1,v1,w)=>{ln(x,s,u0,v0,u1,v1,'rgba(62,70,78,0.7)',w||1.5);ln(h,s,u0,v0,u1,v1,'rgb(84,84,84)',(w||1.5)*1.7);ln(a,s,u0,v0,u1,v1,'rgba(0,0,0,0.3)',(w||1.5)*2.4);};
 const inB=prop?0.5:0.34,outB=0.66;
 for(let s=0;s<2;s++){
  // leading-edge slats + tracks
  const slat=prop?0.0:0.115;
  if(!prop){x.fillStyle='rgba(150,158,166,0.22)';x.fillRect(U(0.1),V(0,s),U(0.87),hf*slat);both(s,0.1,slat,0.97,slat,1.6);for(const u of[0.1,0.26,0.41,0.55,0.69,0.81,0.9,0.97])both(s,u,0,u,slat,1.3);}
  else{x.fillStyle='rgba(35,40,46,0.45)';x.fillRect(U(0.04),V(0,s),U(0.92),hf*0.045);}
  // flaps, aileron, spoilers (TE panels)
  const te=prop?0.72:0.70;
  both(s,0.06,te,inB,te,1.8);both(s,0.06,te,0.06,1,1.6);both(s,inB,te-0.02,inB,1,1.6);
  both(s,outB,te+0.06,0.95,te+0.06,1.8);both(s,outB,te+0.06,outB,1,1.6);both(s,0.8,te+0.06,0.8,1,1.4);
  const rb=prop?0.82:0.78;both(s,0.06,rb,inB,rb,0.9);
  for(let i=0;i<7;i++){const u0=0.08+i*0.082;if(u0+0.075>outB+0.02)break;both(s,u0,0.48,u0,te,1.2);both(s,u0,0.48,u0+0.075,0.48,1.2);}
  for(const u of[0.16,0.27,0.5,0.8]){x.fillStyle='rgba(88,96,104,0.40)';x.fillRect(U(u)-5,V(te+0.02,s),10,hf*0.28);both(s,u-0.004,te,u-0.004,1,1);}
  // fuel access panels with screws
  for(let i=0;i<14;i++)for(let j=0;j<3;j++){const u0=0.06+i*0.062,v0=0.17+j*0.105,w=0.052,hh=0.085;const px=U(u0),py=V(v0,s),pw=U(w),ph=hh*hf;
   x.strokeStyle='rgba(66,74,82,0.55)';x.lineWidth=1.2;x.strokeRect(px,py,pw,ph);h.strokeStyle='rgb(92,92,92)';h.lineWidth=2;h.strokeRect(px,py,pw,ph);
   x.fillStyle='rgba(60,66,72,0.6)';for(let k=0;k<8;k++){const t=k/8,qx=px+3+(pw-6)*t,qy=py+3;x.fillRect(qx,qy,1.5,1.5);x.fillRect(qx,py+ph-4,1.5,1.5);}}
  // rib / rivet rows
  h.setLineDash([1.2,5]);x.setLineDash([1.2,5]);for(let i=1;i<24;i++){const u=i/24;ln(h,s,u,0.02,u,0.68,'rgb(158,158,158)',1.5);ln(x,s,u,0.02,u,0.68,'rgba(60,66,72,0.24)',1);}h.setLineDash([]);x.setLineDash([]);
 }
 // upper surface: walkway, NO STEP, fences
 x.fillStyle='rgba(58,62,66,0.55)';x.fillRect(U(0.015),V(0.36,0),U(0.17),hf*0.12);x.fillStyle='rgba(235,235,235,0.9)';x.font='700 '+Math.round(hf*0.055)+'px Arial';x.textAlign='left';x.textBaseline='middle';x.fillText('NO STEP',U(0.03),V(0.42,0));
 r.fillStyle='rgb(170,170,170)';r.fillRect(U(0.015),V(0.36,0),U(0.17),hf*0.12);h.fillStyle='rgb(140,140,140)';h.fillRect(U(0.015),V(0.36,0),U(0.17),hf*0.12);
 x.strokeStyle='rgba(230,230,230,0.85)';x.lineWidth=2;x.strokeRect(U(0.015),V(0.36,0),U(0.17),hf*0.12);
 // lower surface: gear bay, flap-track fairings, vents, hatches
 x.fillStyle='rgba(70,76,82,0.45)';x.fillRect(U(0.02),V(0.15,1),U(0.14),hf*0.55);x.strokeStyle='rgba(30,34,38,0.7)';x.lineWidth=2;x.strokeRect(U(0.02),V(0.15,1),U(0.14),hf*0.55);
 for(const u of[0.14,0.3,0.5,0.7]){x.fillStyle='rgba(60,66,72,0.5)';x.fillRect(U(u)-6,V(0.55,1),12,hf*0.45);}
 // exhaust soot behind the engines and weather
 const ue=(zE-ty.rf*0.45)/(half-ty.rf*0.45);
 for(let s=0;s<2;s++)for(const k of(ty.eng===4?[ue,ue*2.0]:[ue])){const gg=x.createLinearGradient(0,V(0.25,s),0,V(1,s));gg.addColorStop(0,'rgba(30,26,22,0)');gg.addColorStop(0.5,'rgba(30,26,22,'+(s?0.30:0.14)+')');gg.addColorStop(1,'rgba(30,26,22,0)');x.fillStyle=gg;x.fillRect(U(k)-W*0.03,V(0.2,s),W*0.06,hf*0.8);}
 for(let s=0;s<2;s++){blotch(x,W,H,R,70,30,90,'86,78,66',0.025,0.07,s*hf,s*hf+hf);for(let i=0;i<60;i++){const u=R(),v=R()*0.9;streak(x,U(u),V(v,s),hf*(0.2+R()*0.4),1+R()*2,'70,62,52',0.04+R()*0.05);}
  const gl=x.createLinearGradient(0,V(0,s),0,V(0.12,s));gl.addColorStop(0,'rgba(80,72,62,0.30)');gl.addColorStop(1,'rgba(80,72,62,0)');x.fillStyle=gl;x.fillRect(0,V(0,s),W,hf*0.12);}
 for(let i=0;i<40;i++){x.fillStyle='rgba(235,238,240,'+(0.1+R()*0.15)+')';x.fillRect(R()*W,R()*H,1+R()*5,1+R()*1.5);}
 const nrm=normalFrom(hc,3.0,false);
 const o={map:tex(c),normalMap:tex(nrm,{lin:true}),roughMap:tex(rc,{lin:true}),aoMap:tex(ac,{lin:true})};
 return WTEX[key]=o;
}
/* ---------- fin texture: each half = one side of the fin ---------- */
function finTexture(al,ty){
 const W=1024,H=1024,hf=H/2,[c,x]=cv(W,H),[hc,h]=cv(W,H),tail=hexs(al.tail),acc=hexs(al.acc),ink=al.tailInk||'#fff',R=mul(seedOf('fin'+al.icao+ty.n));
 h.fillStyle='rgb(128,128,128)';h.fillRect(0,0,W,H);
 const dark=(al.tail>>16&255)*0.3+(al.tail>>8&255)*0.59+(al.tail&255)*0.11<150,init=al.init||INIT[al.icao]||al.icao[0];
 for(let s=0;s<2;s++){const y0=s*hf;x.fillStyle=tail;x.fillRect(0,y0,W,hf);
  const gg=x.createLinearGradient(0,y0,W,y0);gg.addColorStop(0,'rgba(0,0,0,0.0)');gg.addColorStop(1,'rgba(255,255,255,0.05)');x.fillStyle=gg;x.fillRect(0,y0,W,hf);
  if(al.finBase)al.finBase(x,W,hf,y0,s);
  // logo, drawn upright: fin "up" is +u (to the right)
  x.save();x.beginPath();x.rect(0,y0,W,hf);x.clip();x.translate(W*0.46,y0+hf*0.52);x.rotate(s===0?-Math.PI/2:Math.PI/2);
  const big=hf*0.36;
  if(al.icao==='KLM'||al.icao==='EZY'||al.icao==='TRA'||al.icao==='SWA'||al.icao==='SCO'||al.icao==='JBU'){x.fillStyle=al.tailInk||'#fff';x.font='800 '+big*1.05+'px Helvetica,Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(init,0,0);}
  else{x.fillStyle=ink==='#fff'?(dark?'#f6f6f6':'#ffffff'):ink;x.beginPath();x.arc(0,0,big*0.95,0,TAU);x.fill();x.fillStyle=al.icao==='RYR'?acc:(dark?tail:tail);if(!dark&&tail==='#ffffff')x.fillStyle=acc;x.font='800 '+big*0.8+'px Helvetica,Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(init.length>3?init.slice(0,3):init,0,big*0.04);}
  x.restore();
  if(al.finTop)al.finTop(x,W,hf,y0,s);
  // accent stripes near the tip and root, rudder hinge, panel lines
  x.fillStyle=acc;x.globalAlpha=0.9;x.fillRect(W*0.9,y0,W*0.1,hf);x.globalAlpha=1;x.fillStyle='rgba(255,255,255,0.0)';
  x.strokeStyle='rgba(0,0,0,0.30)';x.lineWidth=2;x.beginPath();x.moveTo(0,y0+hf*0.70);x.lineTo(W*0.9,y0+hf*0.70);x.stroke();
  h.strokeStyle='rgb(80,80,80)';h.lineWidth=3;h.beginPath();h.moveTo(0,y0+hf*0.70);h.lineTo(W,y0+hf*0.70);h.stroke();
  for(let i=1;i<14;i++){const u=i/14*W*0.9;x.strokeStyle='rgba(0,0,0,0.16)';x.lineWidth=1.2;x.beginPath();x.moveTo(u,y0+hf*0.70);x.lineTo(u,y0+hf);x.stroke();h.strokeStyle='rgb(92,92,92)';h.lineWidth=2;h.beginPath();h.moveTo(u,y0+hf*0.70);h.lineTo(u,y0+hf);h.stroke();}
  for(let i=1;i<20;i++){const u=i/20*W;x.strokeStyle='rgba(0,0,0,0.10)';x.lineWidth=1;x.beginPath();x.moveTo(u,y0);x.lineTo(u,y0+hf*0.70);x.stroke();}
  x.setLineDash([1.2,5]);h.setLineDash([1.2,5]);for(let i=1;i<12;i++){const u=i/12*W;h.strokeStyle='rgb(160,160,160)';h.lineWidth=1.6;h.beginPath();h.moveTo(u,y0);h.lineTo(u,y0+hf*0.70);h.stroke();}x.setLineDash([]);h.setLineDash([]);
  // leading-edge dirt, sealant streaks
  const gl=x.createLinearGradient(0,y0,0,y0+hf*0.12);gl.addColorStop(0,'rgba(70,64,56,0.38)');gl.addColorStop(1,'rgba(70,64,56,0)');x.fillStyle=gl;x.fillRect(0,y0,W,hf*0.12);
  blotch(x,W,H,R,40,30,100,'60,56,50',0.03,0.08,y0,y0+hf);for(let i=0;i<30;i++)streak(x,R()*W,y0+R()*hf*0.7,hf*(0.15+R()*0.3),1+R()*2,'60,56,50',0.05);
  // HF / anti-collision stencil
  x.fillStyle='rgba(235,235,235,0.9)';x.font='700 '+hf*0.045+'px Arial';x.textAlign='left';x.fillText('NO STEP',W*0.03,y0+hf*0.93);
 }
 const nrm=normalFrom(hc,3,false);
 return{map:tex(c),normalMap:tex(nrm,{lin:true})};
}
/* ---------- nacelle texture: u around, v from exhaust (0) to inlet lip (1) ---------- */
function engineTexture(al,ty,S){
 const W=1024,H=256,[c,x]=cv(W,H),[hc,h]=cv(W,H),tail=hexs(al.tail),acc=hexs(al.acc),R=mul(seedOf('eng'+al.icao+ty.n));
 const base=al.icao==='EZY'?'#ff6a10':al.icao==='VIR'?'#c8102e':al.icao==='SCO'?'#ffd800':'#eceff0';
 x.fillStyle=base;x.fillRect(0,0,W,H);h.fillStyle='rgb(128,128,128)';h.fillRect(0,0,W,H);
 const Yv=v=>(1-v)*H;
 // shading: underside darker
 const gr=x.createLinearGradient(0,0,W,0);[[0,'rgba(255,255,255,0.05)'],[0.25,'rgba(0,0,0,0)'],[0.4,'rgba(60,66,74,0.12)'],[0.5,'rgba(50,56,64,0.34)'],[0.6,'rgba(60,66,74,0.12)'],[0.75,'rgba(0,0,0,0)'],[1,'rgba(255,255,255,0.05)']].forEach(s=>gr.addColorStop(s[0],s[1]));x.fillStyle=gr;x.fillRect(0,0,W,H);
 // inlet lip band + aft nozzle band
 x.fillStyle=al.icao==='EZY'||al.icao==='VIR'?'#f3f3f3':acc;x.globalAlpha=al.icao==='EZY'||al.icao==='VIR'?0.9:0.0;x.fillRect(0,Yv(1),W,H*0.06);x.globalAlpha=1;
 x.fillStyle='#9ca4ab';x.fillRect(0,Yv(1),W,H*0.025);x.fillStyle='rgba(40,46,52,0.6)';x.fillRect(0,Yv(0.09),W,H*0.09);
 // panel lines: fan-cowl split, thrust reverser, hinge lines
 const hl=(v,col,w)=>{x.strokeStyle=col;x.lineWidth=w;x.beginPath();x.moveTo(0,Yv(v));x.lineTo(W,Yv(v));x.stroke();h.strokeStyle='rgb(84,84,84)';h.lineWidth=w*1.8;h.beginPath();h.moveTo(0,Yv(v));h.lineTo(W,Yv(v));h.stroke();};
 hl(0.62,'rgba(50,58,66,0.7)',1.6);hl(0.34,'rgba(50,58,66,0.7)',1.6);hl(0.78,'rgba(50,58,66,0.5)',1.2);
 for(const u of[0,0.5,0.25,0.75]){x.strokeStyle='rgba(50,58,66,0.55)';x.lineWidth=1.4;x.beginPath();x.moveTo(u*W,Yv(0.34));x.lineTo(u*W,Yv(0.92));x.stroke();h.strokeStyle='rgb(88,88,88)';h.lineWidth=2.4;h.beginPath();h.moveTo(u*W,Yv(0.34));h.lineTo(u*W,Yv(0.92));h.stroke();}
 for(let i=0;i<40;i++){const u=i/40;for(const v of[0.62,0.34]){h.fillStyle='rgb(150,150,150)';h.fillRect(u*W,Yv(v)-4,1.6,1.6);}}
 // hazard markings + manufacturer text (both sides)
 for(const u of[0.25,0.75]){x.save();x.translate(u*W,Yv(0.5));x.rotate(Math.PI/2);x.fillStyle='rgba(30,36,42,0.85)';x.font='700 '+H*0.12+'px Helvetica,Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(S.txt,0,0);
  x.fillStyle='rgba(200,40,36,0.9)';x.font='700 '+H*0.06+'px Arial';x.fillText('DANGER  ENGINE  INTAKE',-H*0.0,-W*0.0+H*0.12);x.restore();}
 x.fillStyle='rgba(200,40,36,0.9)';x.beginPath();x.moveTo(W*0.5-10,Yv(0.82));x.lineTo(W*0.5+10,Yv(0.82));x.lineTo(W*0.5,Yv(0.72));x.closePath();x.fill();
 // soot at the exhaust, oil streaks, wear on the lip
 const gs=x.createLinearGradient(0,Yv(0.5),0,Yv(0));gs.addColorStop(0,'rgba(22,18,14,0)');gs.addColorStop(1,'rgba(22,18,14,0.68)');x.fillStyle=gs;x.fillRect(0,Yv(0.5),W,H*0.5);
 const gb=x.createLinearGradient(0,0,W,0);[[0.3,0],[0.5,0.45],[0.7,0]].forEach(s=>gb.addColorStop(s[0],'rgba(30,26,22,'+s[1]+')'));x.fillStyle=gb;x.fillRect(0,Yv(0.55),W,H*0.4);
 for(let i=0;i<50;i++){const u=R();streak(x,u*W,Yv(0.9)+R()*H*0.2,H*(0.2+R()*0.5),1+R()*3,'40,34,28',0.05+R()*0.07);}
 blotch(x,W,H,R,30,12,40,'80,76,70',0.04,0.1);
 const nrm=normalFrom(hc,3,true);
 return{map:tex(c),normalMap:tex(nrm,{lin:true})};
}

/* =====================================================================
   MATERIALS
   ===================================================================== */
const MP={};
function initMP(M){
 if(MP.ok)return;MP.ok=1;
 const S=(c,o)=>new THREE.MeshStandardMaterial(Object.assign({color:lin(c),roughness:0.5,metalness:0.2},o));
 MP.steel=S(0x9aa2a9,{metalness:0.8,roughness:0.38});MP.chrome=S(0xdde2e6,{metalness:1,roughness:0.1,envMapIntensity:1.4});
 MP.black=S(0x16181c,{roughness:0.75,metalness:0.2});MP.tire=S(0x121315,{roughness:0.94,metalness:0});
 MP.hub=S(0xb4bbc1,{metalness:0.9,roughness:0.3});MP.brake=S(0x3b3028,{metalness:0.6,roughness:0.55});
 MP.gearW=S(0xdfe2e4,{roughness:0.5,metalness:0.15});MP.nozzle=S(0x5d574f,{metalness:0.85,roughness:0.42});
 MP.lining=S(0x15181b,{roughness:0.9,metalness:0.1,side:THREE.DoubleSide});MP.fanB=S(0x888e96,{metalness:0.85,roughness:0.3});
 MP.spin=S(0xf0f1f2,{roughness:0.3,metalness:0.2});MP.glass=S(0x16222d,{roughness:0.03,metalness:0.7,envMapIntensity:2.4});
 MP.frame=S(0x1b1e22,{roughness:0.6,metalness:0.4});MP.comp=S(0x2a2d31,{roughness:0.5,metalness:0.3,side:THREE.DoubleSide});
 MP.tip=S(0xf2d21c,{roughness:0.45});MP.ant=S(0xe6e8ea,{roughness:0.45,metalness:0.2});MP.dark=S(0x24272b,{roughness:0.7,metalness:0.4});
 MP.red=S(0xc2202a,{roughness:0.5});
}
const WM={},LV={};
function wingMat(ty,variant){
 const k=ty.n+variant;if(WM[k])return WM[k];const t=wingTextures(ty,variant);
 return WM[k]=new THREE.MeshStandardMaterial({map:t.map,normalMap:t.normalMap,normalScale:new THREE.Vector2(0.9,0.9),roughness:1,roughnessMap:t.roughMap,metalness:0.18,aoMap:t.aoMap,envMapIntensity:1.0,side:THREE.FrontSide});
}
R3.acMaterials=function(a){
 const ty=a.type,al=a.al,variant=(a.id||0)%2,key=al.icao+(al.skey||'')+'|'+ty.n+'|'+variant;if(LV[key])return LV[key];
 initMP(this.mat);
 const sh=hullShared(ty,variant),lay=sh.lay,color=paintLivery(al,ty,lay,sh.W,sh.H),metal=al.icao==='AAL';
 const bodyM=new THREE.MeshStandardMaterial({map:tex(color),normalMap:sh.normalMap,normalScale:new THREE.Vector2(1,1),roughness:1,roughnessMap:sh.roughMap,metalness:metal?0.75:0.1,aoMap:sh.aoMap,aoMapIntensity:1,emissive:0xffffff,emissiveMap:sh.emiMap,emissiveIntensity:this.P?this.P.win*1.3:0,envMapIntensity:1.0});
 this.acMats.push(bodyM);
 const fin=finTexture(al,ty),S=TS[ty.n]||TS.A320,eng=engineTexture(al,ty,{txt:ENGTXT[ty.n]||'TURBOFAN'});
 const finM=new THREE.MeshStandardMaterial({map:fin.map,normalMap:fin.normalMap,roughness:0.36,metalness:0.12,envMapIntensity:1.0});
 const engM=new THREE.MeshStandardMaterial({map:eng.map,normalMap:eng.normalMap,roughness:0.34,metalness:0.28,side:THREE.DoubleSide,envMapIntensity:1.0});
 const tailM=new THREE.MeshStandardMaterial({color:lin(al.tail),roughness:0.34,metalness:0.12});
 const fairM=new THREE.MeshStandardMaterial({color:lin(0xdadee1),roughness:0.42,metalness:0.1});
 return LV[key]={bodyM,wingM:wingMat(ty,variant),engM,finM,tailM,fairM,lay};
};
const ENGTXT={A320:'CFM56-5B / V2500',A321:'CFM56-5B / V2500',B738:'CFM56-7B27',E190:'GE CF34-10E',E175:'GE CF34-8E',A333:'ROLLS-ROYCE TRENT 700',A359:'ROLLS-ROYCE TRENT XWB',B789:'GEnx-1B',B77W:'GE90-115B',A388:'ROLLS-ROYCE TRENT 900',A319:'CFM56-5B / V2500',A20N:'LEAP-1A / PW1100G',A21N:'LEAP-1A / PW1100G',B38M:'LEAP-1B',B752:'ROLLS-ROYCE RB211-535',B763:'GE CF6-80C2',B772:'GE90-94B',B788:'GEnx-1B',A332:'ROLLS-ROYCE TRENT 700',A339:'ROLLS-ROYCE TRENT 7000',A35K:'ROLLS-ROYCE TRENT XWB-97',B744:'GE CF6-80C2',B748:'GEnx-2B',B742:'PRATT & WHITNEY JT9D',A343:'CFM56-5C',A346:'ROLLS-ROYCE TRENT 500',A3ST:'GE CF6-80C2',B74L:'GE CF6-80C2',DH8D:'PW150A'};

/* =====================================================================
   COMPONENT BUILDERS
   ===================================================================== */
const GEOC={};
function cachedGeo(key,fn){return GEOC[key]||(GEOC[key]=fn());}
function lathe(pts,seg){return new THREE.LatheGeometry(pts.map(p=>new THREE.Vector2(p[1],p[0])),seg);}  // pts: [axial,radius]
function wheelGeos(R,w){
 return cachedGeo('wh'+R.toFixed(2)+'_'+w.toFixed(2),()=>{
  const rim=R*0.56,hw=w/2;
  const tp=[[-hw,rim],[-hw,R*0.80],[-hw*0.93,R*0.94],[-hw*0.78,R*0.985],[-hw*0.62,R*0.99],[-hw*0.52,R*0.965],[-hw*0.46,R*0.99],[-hw*0.08,R],[hw*0.08,R],[hw*0.46,R*0.99],[hw*0.52,R*0.965],[hw*0.62,R*0.99],[hw*0.78,R*0.985],[hw*0.93,R*0.94],[hw,R*0.80],[hw,rim]];
  const tire=lathe(tp,18);tire.rotateX(Math.PI/2);
  const hp=[[-hw*0.9,rim],[-hw*0.8,rim*0.95],[-hw*0.78,rim*0.45],[-hw*0.98,rim*0.30],[-hw*0.98,0],[hw*0.98,0],[hw*0.98,rim*0.30],[hw*0.78,rim*0.45],[hw*0.8,rim*0.95],[hw*0.9,rim]];
  const hub=lathe(hp,16);hub.rotateX(Math.PI/2);
  const br=new THREE.CylinderGeometry(rim*0.82,rim*0.82,w*0.5,14);br.rotateX(Math.PI/2);
  return{tire,hub,br};});
}
function cyl(r0,r1,len,seg){return new THREE.CylinderGeometry(r0,r1,len,seg||10);}
// cylinder between two points
function strut(A,B,r0,r1){const d=new V3().subVectors(B,A),len=d.length(),g=cyl(r1,r0,len,10);const q=new THREE.Quaternion().setFromUnitVectors(new V3(0,1,0),d.clone().normalize());const m=new M4().compose(new V3().addVectors(A,B).multiplyScalar(0.5),q,new V3(1,1,1));return[g,m];}
function addStrut(G,mat,A,B,r0,r1){const[g,m]=strut(A,B,r0,r1);G.add(g,mat,m);}
function addWheel(G,R,w,x,y,z){const wg=wheelGeos(R,w),m=mx(x,y,z);G.add(wg.tire,MP.tire,m);G.add(wg.hub,MP.hub,m);G.add(wg.br,MP.brake,m);}
function mainLeg(G,x,top,axY,z,Rw,ww,axles,side){
 const sp=Rw*2.5,S0=Math.max(0.5,Rw*0.5),mid=axY+(top-axY)*0.46;
 addStrut(G,MP.gearW,new V3(x,top,z),new V3(x,mid,z),S0*0.34,S0*0.30);                     // upper cylinder
 addStrut(G,MP.chrome,new V3(x,mid+0.05,z),new V3(x,axY+Rw*0.55,z),S0*0.2,S0*0.19);        // piston
 // torque links
 G.add(new THREE.BoxGeometry(0.07,(mid-axY)*0.34,0.05),MP.black,mx(x+0.1,mid-(mid-axY)*0.1,z+S0*0.33,0,0,0.5));
 G.add(new THREE.BoxGeometry(0.07,(mid-axY)*0.34,0.05),MP.black,mx(x+0.1,mid-(mid-axY)*0.32,z+S0*0.33,0,0,-0.5));
 G.add(new THREE.SphereGeometry(S0*0.22,8,6),MP.steel,mx(x+0.1,mid-(mid-axY)*0.2,z+S0*0.33));
 // drag brace + side stay
 addStrut(G,MP.steel,new V3(x,mid+0.1,z),new V3(x-Rw*1.6,top-0.04,z+(z>0?-0.15:0.15)),S0*0.12,S0*0.1);
 addStrut(G,MP.steel,new V3(x,mid+0.15,z),new V3(x,top-0.02,z*0.72),S0*0.09,S0*0.08);
 G.add(new THREE.SphereGeometry(S0*0.36,10,8),MP.gearW,mx(x,top,z));
 // bogie beam + axles + wheels
 const n=axles,len=(n-1)*sp+Rw*0.5;
 G.add(cyl(S0*0.2,S0*0.2,len,8),MP.steel,mx(x,axY,z,0,0,Math.PI/2));
 for(let k=0;k<n;k++){const ax=x+(k-(n-1)/2)*sp;G.add(cyl(S0*0.13,S0*0.13,ww*2.4,8),MP.steel,mx(ax,axY,z,Math.PI/2,0,0));
  for(const o of[-1,1])addWheel(G,Rw,ww,ax,axY,z+o*ww*0.62);}
 // door panel (hinged leaf standing beside the leg)
 G.add(new THREE.BoxGeometry(Rw*3.2,0.04,Rw*2.4),MP.gearW,mx(x-Rw*0.2,top-Rw*1.2,z+side*(ww*1.8+0.3),0,0,0.0));
}
function noseLeg(G,x,top,ng,Rn,ww,rf){
 const mid=ng+(top-ng)*0.5;
 addStrut(G,MP.gearW,new V3(x,top,0),new V3(x,mid,0),0.13,0.12);addStrut(G,MP.chrome,new V3(x,mid,0),new V3(x,ng+Rn*0.4,0),0.09,0.085);
 G.add(cyl(0.16,0.16,0.14,10),MP.black,mx(x,mid+0.02,0));
 G.add(new THREE.BoxGeometry(0.06,(mid-ng)*0.3,0.04),MP.black,mx(x+0.07,mid-(mid-ng)*0.2,0.1,0,0,0.5));G.add(new THREE.BoxGeometry(0.06,(mid-ng)*0.3,0.04),MP.black,mx(x+0.07,mid-(mid-ng)*0.4,0.1,0,0,-0.5));
 addStrut(G,MP.steel,new V3(x,mid+0.1,0),new V3(x+0.9,top-0.12,0),0.06,0.05);
 G.add(cyl(0.06,0.06,Rn*1.9,8),MP.steel,mx(x,ng,0,Math.PI/2,0,0));
 for(const o of[-1,1])addWheel(G,Rn,Rn*0.68,x,ng,o*Rn*0.62);
 // taxi / turn-off light housing
 G.add(new THREE.BoxGeometry(0.12,0.1,0.18),MP.dark,mx(x+0.1,mid+0.25,0));
 for(const o of[-1,1])G.add(new THREE.BoxGeometry(0.9,0.04,0.7),MP.gearW,mx(x+0.1,top-0.6,o*0.7,0,0,0));   // nose-gear doors
}
// turbofan nacelle -> group with parts tagged for the damage / crash systems
function buildNacelle(ty,S,mats,side,R,Ln,pylonH,es){
 const g=new THREE.Group(),flat=S.eng==='cfm737',big=/ge90|trent|xwb|gen/.test(S.eng);
 const key='nac'+ty.n+R.toFixed(2);
 const outer=cachedGeo(key+'o',()=>{const pts=[[-0.50,0.80],[-0.485,0.835],[-0.44,0.895],[-0.34,0.955],[-0.20,0.99],[-0.05,1.0],[0.12,0.995],[0.28,0.975],[0.40,0.945],[0.46,0.915],[0.495,0.885],[0.508,0.85],[0.50,0.82]].map(p=>[p[0]*Ln,p[1]*R]);
  const ge=lathe(pts,40);ge.rotateZ(-Math.PI/2);if(flat){const P=ge.attributes.position;for(let i=0;i<P.count;i++){if(P.getY(i)<0)P.setY(i,P.getY(i)*0.88);}ge.computeVertexNormals();}return ge;});
 g.add(new THREE.Mesh(outer,mats.engM));
 const liner=cachedGeo(key+'l',()=>{const ge=lathe([[0.50,0.82],[0.47,0.805],[0.42,0.795],[0.36,0.79],[0.30,0.785]].map(p=>[p[0]*Ln,p[1]*R]),28);ge.rotateZ(-Math.PI/2);return ge;});
 const sub=new Mrg();sub.add(liner,MP.lining);
 // exhaust duct interior, core cowl and plug
 const duct=cachedGeo(key+'d',()=>{const ge=lathe([[-0.50,0.80],[-0.47,0.74],[-0.40,0.66],[-0.28,0.60],[-0.12,0.56]].map(p=>[p[0]*Ln,p[1]*R]),28);ge.rotateZ(-Math.PI/2);return ge;});
 sub.add(duct,MP.lining);
 const core=cachedGeo(key+'c',()=>{const ge=lathe([[-0.84,0.0],[-0.78,0.05],[-0.70,0.11],[-0.62,0.17],[-0.56,0.22],[-0.50,0.27],[-0.44,0.33],[-0.36,0.38],[-0.26,0.43],[-0.15,0.5]].map(p=>[p[0]*Ln*0.70,p[1]*R]),22);ge.rotateZ(-Math.PI/2);return ge;});
 sub.add(core,MP.nozzle);
 const ring=cachedGeo(key+'r',()=>{const ge=new THREE.TorusGeometry(R*0.31,R*0.022,6,24);ge.rotateY(Math.PI/2);return ge;});
 sub.add(ring,MP.steel,mx(-0.5*Ln*0.9,0,0));
 // pylon (extruded side profile)
 const pH=Math.max(0.12,pylonH);
 const pyl=cachedGeo(key+'p'+pH.toFixed(2),()=>{const sh=new THREE.Shape();const top=R*0.92+pH;sh.moveTo(0.14*Ln,R*0.78);sh.lineTo(0.40*Ln,top+0.02);sh.lineTo(-0.10*Ln,top+0.06);sh.lineTo(-0.50*Ln,top+0.03);sh.lineTo(-0.56*Ln,top-0.2*pH);sh.lineTo(-0.42*Ln,R*0.62);sh.lineTo(-0.1*Ln,R*0.72);sh.closePath();
  const ge=new THREE.ExtrudeGeometry(sh,{depth:R*0.26,bevelEnabled:true,bevelSize:R*0.05,bevelThickness:R*0.05,bevelSegments:2,curveSegments:4});ge.translate(0,0,-R*0.13);return ge;});
 sub.add(pyl,mats.wingM);
 // fan: disc, blades, spinner (spins)
 const fan=new THREE.Group();fan.position.x=0.30*Ln;
 const fm=new Mrg();
 const disc=cachedGeo('fd'+R.toFixed(2),()=>{const ge=new THREE.CircleGeometry(R*0.79,28);ge.rotateY(Math.PI/2);return ge;});fm.add(disc,MP.lining);
 const nb=big?24:20,bl=cachedGeo('fb'+R.toFixed(2),()=>new THREE.BoxGeometry(R*0.22,R*0.58,R*0.018));
 for(let i=0;i<nb;i++){const a=i/nb*TAU,m=new M4().makeRotationX(a).multiply(new M4().makeTranslation(0,R*0.50,0)).multiply(new M4().makeRotationY(-0.95));fm.add(bl,MP.fanB,m);}
 const spin=cachedGeo('sp'+R.toFixed(2),()=>{const ge=lathe([[0,0],[R*0.16,R*0.07],[R*0.3,R*0.15],[R*0.45,R*0.2],[R*0.5,R*0.215]].map(p=>[p[0],p[1]]),18);ge.rotateZ(-Math.PI/2);return ge;});fm.add(spin,MP.spin);
 fm.build(fan,false,false);g.add(fan);
 // chevrons on nozzle for the modern engines
 if(/xwb|gen/.test(S.eng)){const nC=18,cg=new THREE.BufferGeometry(),P=[];for(let i=0;i<nC;i++){const a0=i/nC*TAU,a1=(i+1)/nC*TAU,am=(a0+a1)/2,r0=R*0.80;P.push(-0.5*Ln,Math.cos(a0)*r0,Math.sin(a0)*r0,-0.5*Ln,Math.cos(a1)*r0,Math.sin(a1)*r0,-0.5*Ln-R*0.30,Math.cos(am)*r0*0.9,Math.sin(am)*r0*0.9);}
  cg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));cg.computeVertexNormals();sub.add(cg,mats.engM);}
 const parts=sub.build(g,false,false);
 const nacMesh=g.children[0];nacMesh.castShadow=true;
 g.userData.part='eng';g.userData.side=side;g.userData.eR=R;g.userData.eL=Ln;g.userData.fan=fan;
 return g;
}
function bladeGeo(R,len){
 return cachedGeo('pb'+R.toFixed(2)+len.toFixed(2),()=>{
  const sh=new THREE.Shape(),c0=R*0.17,c1=R*0.10;
  sh.moveTo(0,-c0*0.5);sh.lineTo(len*0.25,-c0*0.55);sh.quadraticCurveTo(len*0.7,-c0*0.35,len,-c1*0.2);sh.lineTo(len,c1*0.55);sh.quadraticCurveTo(len*0.7,c0*0.4,len*0.3,c0*0.5);sh.lineTo(0,c0*0.5);sh.closePath();
  const ge=new THREE.ExtrudeGeometry(sh,{depth:R*0.02,bevelEnabled:true,bevelSize:R*0.01,bevelThickness:R*0.008,bevelSegments:1,curveSegments:5});
  ge.translate(0,0,-R*0.01);ge.rotateZ(Math.PI/2);   // length along +y
  return ge;});
}
function buildProp(ty,S,mats,side,R,Ln,rf){
 const g=new THREE.Group();
 const outer=cachedGeo('pn'+ty.n,()=>{const pts=[[-0.50,0.16],[-0.47,0.36],[-0.40,0.62],[-0.26,0.86],[-0.08,0.99],[0.14,1.0],[0.32,0.94],[0.44,0.80],[0.49,0.60],[0.5,0.32]].map(p=>[p[0]*Ln,p[1]*R]);const ge=lathe(pts,26);ge.rotateZ(-Math.PI/2);
  const P=ge.attributes.position;for(let i=0;i<P.count;i++){const x=P.getX(i);if(P.getY(i)<0&&x>0.05*Ln)P.setY(i,P.getY(i)*1.0);P.setZ(i,P.getZ(i)*0.95);}ge.computeVertexNormals();return ge;});
 g.add(new THREE.Mesh(outer,mats.engM));g.children[0].castShadow=true;
 const sub=new Mrg();
 // air-intake scoop below the spinner and exhaust stacks
 sub.add(new THREE.SphereGeometry(1,14,10),mats.engM,mx(Ln*0.38,-R*0.55,0,0,0,0,R*0.8,R*0.45,R*0.62));
 sub.add(new THREE.TorusGeometry(R*0.34,R*0.05,6,20),MP.dark,mx(Ln*0.455,-R*0.60,0,0,Math.PI/2,0));
 for(const o of[-1,1])sub.add(cyl(R*0.07,R*0.09,R*0.5,8),MP.nozzle,mx(-Ln*0.12,R*0.55,o*R*0.42,0,0,Math.PI/2.4*o*0.2+Math.PI/2*0.0-1.2*o*0));
 for(const o of[-1,1])sub.add(cyl(R*0.075,R*0.09,R*0.55,8),MP.nozzle,mx(-Ln*0.08,R*0.62,o*R*0.45,0,0,1.25));
 // pylon-less: wing blends into the nacelle top
 // nacelle bulge to house the main gear
 sub.add(new THREE.SphereGeometry(1,16,10),mats.engM,mx(-Ln*0.22,-R*0.34,0,0,0,0,Ln*0.34,R*0.7,R*0.75));
 sub.build(g,true,true);
 // prop: spinner, hub, 6 blades
 const pr=new THREE.Group();pr.position.x=Ln*0.5+R*0.1;
 const pm=new Mrg();
 const sp=cachedGeo('psp'+R.toFixed(2),()=>{const ge=lathe([[0,0],[R*0.1,R*0.14],[R*0.26,R*0.27],[R*0.5,R*0.37],[R*0.62,R*0.37]].map(p=>[p[0],p[1]]),18);ge.rotateZ(-Math.PI/2);return ge;});
 pm.add(sp,MP.spin);
 const rl=rf*1.45,bg=bladeGeo(R*2.0,rl);
 for(let b=0;b<6;b++){const m=new M4().makeRotationX(b*Math.PI/3).multiply(new M4().makeTranslation(R*0.5,R*0.30,0)).multiply(new M4().makeRotationY(0.0)).multiply(new M4().makeRotationX(0));
  // pitch: rotate blade about its own radial axis
  const pitch=new M4().makeRotationY(0.45);
  pm.add(bg,MP.comp,new M4().makeRotationX(b*Math.PI/3).multiply(new M4().makeTranslation(R*0.55,R*0.34,0)).multiply(pitch));
  pm.add(new THREE.BoxGeometry(R*0.1,rl*0.09,R*0.2),MP.tip,new M4().makeRotationX(b*Math.PI/3).multiply(new M4().makeTranslation(R*0.55,R*0.34+rl*0.96,0)).multiply(pitch));}
 pm.build(pr,false,false);
 const disc=new THREE.Mesh(new THREE.CircleGeometry(rl,28),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.09,depthWrite:false,side:THREE.DoubleSide}));disc.rotation.y=Math.PI/2;pr.add(disc);
 g.add(pr);g.userData.part='eng';g.userData.side=side;g.userData.eR=R;g.userData.eL=Ln;g.userData.prop=pr;
 return g;
}
function glassPatches(Mg,L,rf,S){
 const nl=S.nl,d=a=>a*Math.PI/180,wide=S.k==='wide'||S.k==='super';
 const wsh=[[1-nl*0.60,1-nl*0.36,d(4),d(31),d(3.5),d(21)]];
 const side=[[1-nl*0.66,1-nl*0.46,d(37),d(55),d(35),d(50)],[1-nl*0.80,1-nl*0.68,d(38),d(53),d(38),d(53)]];
 const mk=(P,off,grow,mat)=>{for(const m of[1,-1]){const[t0,t1,a0,a1,a2,a3]=P;Mg.add(hullPatch(L,rf,S,t0-grow*0.002,t1+grow*0.002,a0-d(grow),a1+d(grow),a2-d(grow),a3+d(grow),off,6,8,m),mat);}};
 for(const P of wsh){mk(P,0.016,0,MP.glass);mk(P,0.006,1.6,MP.frame);}
 for(const P of side){mk(P,0.016,0,MP.glass);mk(P,0.006,1.6,MP.frame);}
}

/* =====================================================================
   AIRCRAFT ASSEMBLY
   ===================================================================== */
const FUSC={};
function wingPlan(ty,S,WS){
 const L=ty.len,rf=ty.rf,half=ty.wing/2,z0=rf*0.45,lex=WS.lex*L,wy=WS.wy*rf,tanS=Math.tan(WS.sweep*Math.PI/180),tanD=Math.tan(WS.dih*Math.PI/180),rootC=WS.rootC*L,tipC=WS.tipC*L,big=S.k==='wide'||S.k==='super';
 const wLE=z=>lex-tanS*(z-z0),wY=z=>wy+(z-z0)*tanD+(big?rf*0.2*Math.pow((z-z0)/(half-z0),3):rf*0.04*Math.pow((z-z0)/(half-z0),3));
 const chord=f=>f<=WS.kink?lerp(rootC*1.1,WS.kc*rootC,f/WS.kink):lerp(WS.kc*rootC,tipC,(f-WS.kink)/(1-WS.kink));
 return{L,rf,half,z0,lex,wy,rootC,tipC,wLE,wY,chord,big};
}
function wingSecs(P,S,WS){
 const secs=[],fs=[0,0.07,0.15,WS.kink,0.5,0.68,0.84,0.95,1];
 for(const f of fs){const z=P.z0+(P.half-P.z0)*f,strake=P.rootC*0.22*Math.pow(Math.max(0,1-f/0.16),1.5);
  secs.push({x:P.wLE(z)+strake,y:P.wY(z),z,c:P.chord(f)+strake*0.8*0,tc:lerp(WS.tr*1.15,WS.tr*0.68,f),cam:lerp(0.025,0.012,f),tw:WS.tw*Math.PI/180*f,ny:1,nz:0,u:f});}
 return secs;
}
// continues the wing tip as a blended / curved / raked tip (same surface as the wing)
function tipExt(P,S,WS,secs,kind){
 const last=secs[secs.length-1];let x=last.x,y=last.y,z=last.z,c=last.c,out=[];
 const n=kind==='curved'?5:3,len=kind==='curved'?P.rf*0.95:P.rf*0.8,cant1=kind==='curved'?62:7;
 for(let k=1;k<=n;k++){const a=k/n,ph0=(a-1/n)*cant1*Math.PI/180,ph1=a*cant1*Math.PI/180,ph=(ph0+ph1)/2,ds=len/n;
  z+=ds*Math.cos(ph);y+=ds*Math.sin(ph);x-=ds*(kind==='curved'?0.55:1.05);c=lerp(last.c,last.c*(kind==='curved'?0.42:0.5),a);
  out.push({x,y,z,c,tc:last.tc*lerp(1,0.8,a),cam:0.01,tw:last.tw,ny:Math.cos(ph1),nz:-Math.sin(ph1),u:1});}
 return out;
}
function wingletSecs(P,last,h,cant0,cant1,cTip,sweep,n){
 const out=[];let x=last.x,y=last.y,z=last.z;
 out.push({x,y,z,c:last.c,tc:last.tc,cam:0.01,tw:0,ny:Math.cos(cant0*Math.PI/180),nz:-Math.sin(cant0*Math.PI/180),u:1});
 for(let k=1;k<=n;k++){const a=k/n,ph0=lerp(cant0,cant1,(k-1)/n)*Math.PI/180,ph1=lerp(cant0,cant1,a)*Math.PI/180,ph=(ph0+ph1)/2,ds=h/n;
  z+=ds*Math.cos(ph);y+=ds*Math.sin(ph);x-=ds*sweep;const ca=lerp(last.c,cTip,Math.pow(a,0.9));
  out.push({x,y,z,c:ca,tc:last.tc*lerp(1,0.8,a),cam:0.008,tw:0,ny:Math.cos(ph1),nz:-Math.sin(ph1),u:1});}
 return out;
}
R3.buildAC=function(a){
 const ty=a.type,L=ty.len,W=ty.wing,rf=ty.rf,S=TS[ty.n]||TS.A320,WS=WSPEC[S.ws||S.k],prop=S.k==='prop',big=S.k==='wide'||S.k==='super';
 const mats=this.acMaterials(a),M=this.mat,variant=(a.id||0)%2;
 if(!M.glowM)M.glowM=new THREE.SpriteMaterial({map:this.glow,color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
 const root=new THREE.Group(),pivot=new THREE.Group(),body=new THREE.Group(),detail=new THREE.Group();
 const gearH=rf*1.85;
 const P=wingPlan(ty,S,WS),half=P.half;
 // nacelle geometry numbers first (turboprop gear sits in the nacelle, so the pivot depends on it)
 const Rn0=rf*S.R,LnE=prop?L*0.205:Rn0*(big?3.55:3.3);
 const zE0=half*WS.eng,xcP=P.wLE(zE0)+Rn0*0.9-LnE/2+(prop?0.9:0);
 const mainX=prop?xcP-LnE*0.2:L*0.045;
 root.add(pivot);pivot.position.set(mainX,0,0);body.position.set(-mainX,gearH,0);pivot.add(body);body.add(detail);
 // ---- fuselage ----
 const fc=FUSC[ty.n]||(FUSC[ty.n]={hi:fuselageGeo(L,rf,S,52,96),lo:fuselageGeo(L,rf,S,22,46)});
 const fus=new THREE.Mesh(fc.hi,mats.bodyM);fus.castShadow=true;fus.receiveShadow=true;body.add(fus);
 const Mg=new Mrg();glassPatches(Mg,L,rf,S);Mg.build(body,false,true);
 // ---- wings ----
 const secs=wingSecs(P,S,WS);let winSecs=secs;
 if(S.wl==='curved'||S.wl==='raked')winSecs=secs.concat(tipExt(P,S,WS,secs,S.wl));
 const tipY=P.wY(half),tipLE=P.wLE(half),tipC=P.tipC;
 const wingGeoC=cachedGeo('wg'+ty.n,()=>({r:liftSurface(winSecs,1,16),l:liftSurface(winSecs,-1,16)}));
 for(const sd of[-1,1]){
  const wg=new THREE.Group();wg.userData.part='wing';wg.userData.side=sd;
  const wm=new THREE.Mesh(sd>0?wingGeoC.r:wingGeoC.l,mats.wingM);wm.castShadow=true;wm.receiveShadow=true;wg.add(wm);
  const sm=new Mrg();
  // flap-track fairings and aileron actuator pods
  for(const f of[0.2,0.38,0.58,0.75]){const z=P.z0+(half-P.z0)*f,ch=P.chord(f);const fg=new THREE.SphereGeometry(1,12,8);
   sm.add(fg,mats.fairM,mx(P.wLE(z)-ch*0.84,P.wY(z)-rf*0.06-ch*0.012,sd*z,0,0,0,ch*0.22,rf*0.045+ch*0.008,0.1+ch*0.008));}
  // wing-tip lens fairing and static dischargers
  sm.build(wg,false,true);
  // winglet
  const lastS=winSecs[winSecs.length-1];
  const wl=S.wl;
  if(wl==='sharklet'||wl==='blended'||wl==='small'||wl==='fence'){
   const lc=lastS;const h=wl==='small'?rf*0.6:wl==='fence'?rf*0.62:rf*(wl==='sharklet'?1.35:1.3);
   const ws=wingletSecs(P,lc,h,wl==='fence'?86:wl==='small'?60:12,wl==='fence'?88:wl==='small'?78:82,lc.c*(wl==='fence'?0.45:wl==='small'?0.5:0.38),wl==='sharklet'?0.72:wl==='small'?0.62:0.85,wl==='fence'?2:5);
   const wlm=new THREE.Mesh(liftSurface(ws,sd,10),wl==='fence'?mats.wingM:mats.tailM);wlm.castShadow=true;wg.add(wlm);}
  body.add(wg);
 }
 // belly fairing (wing-to-body)
 if(!prop){const bf=new THREE.Mesh(new THREE.SphereGeometry(1,28,14),mats.fairM);bf.scale.set(P.rootC*1.05,rf*0.26,rf*0.80);bf.position.set(P.lex-P.rootC*0.55,-rf*(S.hr)*0.80,0);bf.castShadow=true;body.add(bf);
  // canoe nose cone
  const fl=new THREE.Mesh(new THREE.SphereGeometry(1,18,10),mats.fairM);fl.scale.set(P.rootC*0.45,rf*0.17,rf*0.55);fl.position.set(P.lex-P.rootC*0.95,-rf*S.hr*0.82,0);body.add(fl);}
 // ---- engines ----
 const props=[],fans=[];
 const ENG=ty.eng===4?[0.30,0.60]:[WS.eng];
 body.userData.engs=[];
 if(!prop){
  const R=Rn0,Ln=LnE;
  for(const ef of ENG){const zE=half*ef,leE=P.wLE(zE),yW=P.wY(zE);const yE=-(gearH-R-0.5),xc=leE+R*0.9-Ln/2;
   const ph=(yW-0.35)-(yE+R*0.92);
   for(const sd of[-1,1]){const gE=buildNacelle(ty,S,mats,sd,R,Ln,Math.max(0.12,ph),null);gE.position.set(xc,yE,sd*zE);if(sd<0)gE.rotation.y=0;body.userData.engs.push(gE);body.add(gE);fans.push(gE.userData.fan);}}
 }else{
  const R=Rn0,Ln=LnE,yE=P.wY(zE0)-R*0.62;
  for(const sd of[-1,1]){const gE=buildProp(ty,S,mats,sd,R,Ln,rf);gE.position.set(xcP,yE,sd*zE0);body.userData.engs.push(gE);body.add(gE);props.push(gE.userData.prop);}
 }
 // ---- tail ----
 const fh=S.fin*rf,leF=-L*0.275,cF=(big?0.17:0.19)*L,tF=0.075*L,swF=Math.tan(0.63),baseY=rf*0.42;
 const fs=[0,0.3,0.65,1].map(f=>({x:leF-swF*fh*f-(f===0?cF*0.05:0),y:baseY+fh*f,z:0,c:lerp(cF,tF,f),tc:lerp(0.115,0.085,f),cam:0,tw:0,ny:0,nz:1,u:f}));
 const fin=new THREE.Mesh(cachedGeo('fin'+ty.n,()=>liftSurface(fs,1,14)),mats.finM);fin.castShadow=true;fin.userData.part='tail';body.add(fin);
 // dorsal fillet + tail-tip fairing
 {const ds=[{x:leF+L*0.05,y:baseY,z:0,c:cF*0.55,tc:0.06,cam:0,tw:0,ny:0,nz:1,u:0},{x:leF-swF*fh*0.28+L*0.012,y:baseY+fh*0.30,z:0,c:cF*0.30,tc:0.04,cam:0,tw:0,ny:0,nz:1,u:0.2}];
  const dm=new THREE.Mesh(cachedGeo('dors'+ty.n,()=>liftSurface(ds,1,10)),mats.finM);dm.userData.part='tail';body.add(dm);}
 // tailplane
 const tT=prop,hh=(prop?0.30:S.stab)*half,hz0=rf*0.18,hLE=tT?(leF-swF*fh-0.01*L):-L*0.385,hY=tT?baseY+fh:rf*0.12,hC=(prop?0.1:0.09)*L,hTC=0.034*L,hSw=Math.tan(0.5);
 const hs=[0,0.35,0.7,1].map(f=>({x:hLE-hSw*(hh-hz0)*f,y:hY+f*(hh-hz0)*0.1,z:hz0+(hh-hz0)*f,c:lerp(hC,hTC,f),tc:lerp(0.115,0.08,f),cam:0,tw:0,ny:1,nz:0,u:f}));
 const hgeo=cachedGeo('hs'+ty.n,()=>({r:liftSurface(hs,1,14),l:liftSurface(hs,-1,14)}));
 for(const sd of[-1,1]){const m=new THREE.Mesh(sd>0?hgeo.r:hgeo.l,mats.wingM);m.castShadow=true;m.userData.part='tail';body.add(m);}
 // ---- airframe detail (merged) ----
 const dm=new Mrg();
 if(!prop){dm.add(new THREE.SphereGeometry(1,14,8),MP.ant,mx(L*0.04,rf*S.hr*0.97,0,0,0,0,rf*0.55,rf*0.15,rf*0.3));}
 dm.add(cyl(rf*0.12,rf*0.16,rf*0.42,12),MP.nozzle,mx(-L*0.5+rf*0.06,rf*0.55*S.upw+0.0,0,0,0,Math.PI/2));
 dm.add(new THREE.TorusGeometry(rf*0.14,rf*0.015,6,16),MP.steel,mx(-L*0.5+0.0,rf*0.55*S.upw,0,0,Math.PI/2,0));
 for(const[ax,ay,r2]of[[-L*0.12,rf*S.hr+0.12,0.35],[L*0.14,-rf*S.hr-0.1,-0.35],[L*0.20,rf*S.hr+0.1,0.3],[-L*0.30,rf*S.hr*0.9,0.5]])dm.add(new THREE.BoxGeometry(0.3,0.42,0.04),MP.ant,mx(ax,ay,0,0,0,r2));
 for(const sd of[-1,1]){dm.add(cyl(0.025,0.025,0.8,6),MP.steel,mx(L*0.5-rf*1.45,rf*0.05,sd*rf*0.9,0,0,Math.PI/2));   // pitots
  dm.add(new THREE.BoxGeometry(0.2,0.06,0.04),MP.steel,mx(L*0.5-rf*1.2,rf*0.18,sd*rf*0.96,0,0,0.0));
  for(const f of[0.8,0.9,0.97]){const z=P.z0+(half-P.z0)*f;dm.add(cyl(0.012,0.012,0.7,5),MP.black,mx(P.wLE(z)-P.chord(f)-0.35,P.wY(z)+0.02,sd*z,0,0,Math.PI/2));}}
 dm.add(new THREE.BoxGeometry(0.25,0.05,0.25),MP.ant,mx(L*0.5-rf*0.9,-rf*S.hr+0.05,0));
 dm.add(new THREE.BoxGeometry(0.3,0.08,0.5),MP.red,mx(-L*0.5+rf*0.5,rf*0.6,0));
 dm.build(detail,false,false);
 // ---- landing gear ----
 const gear=new THREE.Group(),G=new Mrg();
 const Rw=rf*(big?0.21:0.27)*(prop?0.78:1),ww=Rw*0.72,Rnw=Rw*0.82,axles=S.gear;
 if(S.k==='super'){
  for(const sd of[-1,1]){mainLeg(G,mainX,P.wY(rf*3.45)-0.2,-gearH+Rw,sd*rf*3.45,Rw,ww,2,sd);mainLeg(G,mainX-rf*0.35,-rf*S.hr*0.85,-gearH+Rw,sd*rf*0.55,Rw,ww,3,sd);}
 }else if(prop){
  const yE=P.wY(zE0)-Rn0*0.62;for(const sd of[-1,1])mainLeg(G,mainX,yE-Rn0*0.15,-gearH+Rw,sd*zE0,Rw,ww,1,sd);
 }else{
  const mz=rf*S.mzf;for(const sd of[-1,1])mainLeg(G,mainX,P.wY(mz)-0.15,-gearH+Rw,sd*mz,Rw,ww,axles,sd);
 }
 noseLeg(G,L*0.31,-rf*S.hr*0.8,-gearH+Rnw,Rnw,Rnw*0.68,rf);
 G.build(gear,true,true);body.add(gear);root.userData.gear=gear;
 // ---- lights ----
 const lite=(col,x,y,z,r,sc)=>{const g=new THREE.Group();g.position.set(x,y,z);const m=new THREE.Mesh(new THREE.SphereGeometry(r||0.22,8,6),new THREE.MeshBasicMaterial({color:col,toneMapped:false}));g.add(m);
  const sp=new THREE.Sprite(M.glowM.clone());sp.material.color.setHex(col);sp.scale.set(sc||3,sc||3,1);g.add(sp);body.add(g);return g;};
 const tipX=tipLE-tipC*0.55;
 lite(0xff2a2a,tipX,tipY,-(half+0.05),0.2,2.2);lite(0x2aff5a,tipX,tipY,half+0.05,0.2,2.2);
 root.userData.strobes=[lite(0xffffff,tipX-0.4,tipY,-(half+0.05),0.25,5),lite(0xffffff,tipX-0.4,tipY,half+0.05,0.25,5),lite(0xffffff,-L*0.5+0.2,rf*0.5*S.upw+0.1,0,0.25,5)];
 root.userData.beacon=lite(0xff1a1a,-L*0.02,rf*S.hr*1.04,0,0.28,5);
 root.userData.land=lite(0xfff6dc,L*0.31+0.2,-rf*S.hr*0.8,0,0.3,6);
 const cone=new THREE.ConeGeometry(16,150,18,1,true);cone.translate(0,-75,0);cone.rotateZ(Math.PI/2);
 const beam=new THREE.Mesh(cone,new THREE.MeshBasicMaterial({color:0xfff2d0,transparent:true,opacity:0.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false}));
 beam.position.set(L*0.31,-rf*S.hr*0.8,0);beam.rotation.z=-0.05;beam.visible=false;body.add(beam);root.userData.beam=beam;
 if(props.length)root.userData.props=props;root.userData.fans=fans;
 const sh=new THREE.Mesh(new THREE.CircleGeometry(1,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.16,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));sh.rotation.x=-Math.PI/2;sh.position.y=0.12;root.userData.shadow=sh;
 const holder=new THREE.Group();holder.add(root);this.scene.add(holder);this.scene.add(sh);
 root.userData.fus=body;root.userData.dims={L,rf,gearH,mainX,half,mz:prop?zE0:rf*S.mzf,wy:P.wy,lex:P.lex,rootC:P.rootC};
 root.userData.lod={fus,hi:fc.hi,lo:fc.lo,detail};
 return{holder,root,body:pivot,sh,a};
};
// wing texture accessor kept for any caller
R3.liftSurface=liftSurface;
R3.wingTex=function(){return wingTextures(TYPES.A320,0).map;};

/* ---------- per-frame: fan spin + LOD ---------- */
const _ex=R3.extra;
R3.extra=function(dt,t){
 _ex.call(this,dt,t);
 const cp=this.camera.position;
 for(const[id,m]of this.meshes){
  if(m.veh)continue;const u=m.root.userData,lod=u.lod;if(!lod)continue;
  const d=cp.distanceTo(m.holder.position);
  const near=d<520,hi=d<1300;
  if(lod.detail.visible!==near)lod.detail.visible=near;
  const g=hi?lod.hi:lod.lo;if(lod.fus.geometry!==g)lod.fus.geometry=g;
  const e=m.a;if(e&&u.fans&&near&&e.phase&&!['BOARDING','AT_GATE','PARKED'].includes(e.phase)){const sp=['PUSHBACK','TAXI','LINEUP'].includes(e.phase)?5:e.v>5||e.y>1?16:9;u.fans.forEach(f=>{if(f)f.rotation.x+=dt*sp;});}
 }
};
})();



