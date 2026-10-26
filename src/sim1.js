'use strict';
/* =====================================================================
   SIM CORE — geometry, taxi graph, aircraft physics, spawning, mishaps
   World units are metres. x = east, z = south (north is -z). Runway 09/27 lies on z = 0.
   ===================================================================== */
const D2R=Math.PI/180,R2D=180/Math.PI,KT=0.514444,NM=1852,TAN3=Math.tan(3*D2R),FT=3.2808;
const rnd=(a,b)=>a+Math.random()*(b-a);
const rint=(a,b)=>Math.floor(rnd(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const angDiff=(a,b)=>{let d=(a-b)%(2*Math.PI);if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;return d;};
const pad=(n,l)=>String(n).padStart(l,'0');

const AP={icao:AIRPORT.icao,name:AIRPORT.name,half:AIRPORT.rwy.len/2,thr:AIRPORT.rwy.len/2-50,w:AIRPORT.rwy.wid,hdg:HDG_A,elev:AIRPORT.elev,mv:AIRPORT.mv};
const RWD=()=>rwLabel(G.rwy);
const WOFF=AIRPORT.rwy.mag-90;               // sim frame (runway = 090/270) -> magnetic
const WDM=w=>((w.dir+WOFF)%360+360)%360;
const CONNK=['B','C','D','E'];
const HPN={},EXN={};CONNK.forEach((k,i)=>{HPN['H'+k]=AIRPORT.tx.conn[i];EXN[k]=AIRPORT.tx.conn[i];});
const NODES={},EDGES=[];
function N(id,x,z,t){NODES[id]={id,x,z,t,adj:[]};}
function E(a,b,name,rwy){const A=NODES[a],B=NODES[b];const e={a,b,name,len:Math.hypot(A.x-B.x,A.z-B.z),rwy:!!rwy};EDGES.push(e);A.adj.push({to:b,e});B.adj.push({to:a,e});}
(function buildAirport(){
 const hf=AP.half,CONN=[['B',-Math.round(hf*0.87),AIRPORT.tx.conn[0]],['C',-Math.round(hf*0.47),AIRPORT.tx.conn[1]],['D',Math.round(hf*0.47),AIRPORT.tx.conn[2]],['E',Math.round(hf*0.87),AIRPORT.tx.conn[3]]];
 CONN.forEach(([k,x])=>{N('A'+k,x,-150,'tw');N('V'+k,x,-105,'tw');N('H'+k,x,-60,'hold');N('R'+k,x,0,'rwy');});
 N('AF',-160,-150,'tw');N('AM',0,-150,'tw');N('AG',160,-150,'tw');
 const alpha=['AB','AC','AF','AM','AG','AD','AE'];
 for(let i=0;i<alpha.length-1;i++)E(alpha[i],alpha[i+1],AIRPORT.tx.par);
 CONN.forEach(([k,x,nm])=>{E('A'+k,'V'+k,nm);E('V'+k,'H'+k,nm);E('H'+k,'R'+k,nm,true);});
 const gx=[-400,-240,-80,80,240,400];
 gx.forEach((x,i)=>{N('P'+(i+1),x,-300,'lane');N('S'+(i+1),x,-350,'gate');});
 N('PF',-160,-300,'lane');N('PG',160,-300,'lane');
 const lane=['P1','P2','PF','P3','P4','PG','P5','P6'];
 for(let i=0;i<lane.length-1;i++)E(lane[i],lane[i+1],'Apron');
 gx.forEach((x,i)=>E('P'+(i+1),'S'+(i+1),'Stand'));
 E('AF','PF',AIRPORT.tx.fox);E('AG','PG',AIRPORT.tx.gol);
 N('DP',0,-110,'depot');E('AM','DP','Service Rd');
})();
const GATE_X=[-400,-240,-80,80,240,400];

function route(from,to,allowRwy){
 const dist={},prev={},pe={},done={};for(const k in NODES)dist[k]=Infinity;dist[from]=0;
 for(;;){let u=null,b=Infinity;for(const k in dist)if(!done[k]&&dist[k]<b){b=dist[k];u=k;}
  if(u===null||u===to)break;done[u]=1;
  for(const {to:v,e} of NODES[u].adj){if(e.rwy&&!allowRwy)continue;const nd=dist[u]+e.len;if(nd<dist[v]){dist[v]=nd;prev[v]=u;pe[v]=e;}}}
 if(dist[to]===Infinity)return null;
 const ids=[to],edges=[];let c=to;while(c!==from){edges.unshift(pe[c]);c=prev[c];ids.unshift(c);}
 return {ids,edges,len:dist[to]};
}
function viaNames(edges,drop){
 const out=[];edges.forEach(e=>{if(['Apron','Stand','Service Rd'].includes(e.name)||e.name===drop)return;if(out[out.length-1]!==e.name)out.push(e.name);});
 return out;
}
function buildPath(P,r){
 const out=[{x:P[0].x,z:P[0].z}];
 for(let i=1;i<P.length-1;i++){
  const a=P[i-1],b=P[i],c=P[i+1];
  const d1=Math.hypot(b.x-a.x,b.z-a.z),d2=Math.hypot(c.x-b.x,c.z-b.z);
  if(d1<1e-6||d2<1e-6)continue;
  const ux=(b.x-a.x)/d1,uz=(b.z-a.z)/d1,vx=(c.x-b.x)/d2,vz=(c.z-b.z)/d2;
  const cr=Math.abs(ux*vz-uz*vx),dt=ux*vx+uz*vz;
  if(cr<0.02&&dt>0){out.push({x:b.x,z:b.z});continue;}
  const rr=Math.min(r,d1*0.48,d2*0.48);
  const p0={x:b.x-ux*rr,z:b.z-uz*rr},p2={x:b.x+vx*rr,z:b.z+vz*rr};
  for(let k=0;k<=8;k++){const t=k/8,w0=(1-t)*(1-t),w1=2*t*(1-t),w2=t*t;out.push({x:w0*p0.x+w1*b.x+w2*p2.x,z:w0*p0.z+w1*b.z+w2*p2.z});}
 }
 if(P.length>1)out.push({x:P[P.length-1].x,z:P[P.length-1].z});
 const pts=[out[0]];for(let i=1;i<out.length;i++){const q=out[i],p=pts[pts.length-1];if(Math.hypot(q.x-p.x,q.z-p.z)>0.05)pts.push(q);}
 if(pts.length<2)pts.push({x:pts[0].x+0.1,z:pts[0].z});
 const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z));
 return {pts,cum,len:cum[cum.length-1],i:0};
}
function sample(p,s){
 s=clamp(s,0,p.len);let i=p.i;if(i>=p.pts.length-1||p.cum[i]>s)i=0;
 while(i<p.pts.length-2&&p.cum[i+1]<s)i++;p.i=i;
 const a=p.pts[i],b=p.pts[i+1],seg=(p.cum[i+1]-p.cum[i])||1,t=(s-p.cum[i])/seg,dx=b.x-a.x,dz=b.z-a.z;
 return {x:a.x+dx*t,z:a.z+dz*t,th:Math.atan2(dz,dx)};
}
function pathFromNodes(ids,startPt,r){
 const P=[];if(startPt)P.push({x:startPt.x,z:startPt.z});
 ids.forEach(id=>{const n=NODES[id];const l=P[P.length-1];if(!l||Math.hypot(l.x-n.x,l.z-n.z)>0.5)P.push({x:n.x,z:n.z});});
 return buildPath(P,r||40);
}

/* ---------------- global state ---------------- */
const G={hooks:{}};
const PRESETS={
 cadet:{dep:0.38,arr:0.32,mishap:0.07,err:0.03,maxAir:2,maxActive:2,assist:true},
 controller:{dep:0.62,arr:0.5,mishap:0.15,err:0.08,maxAir:3,maxActive:4,assist:false},
 veteran:{dep:1.05,arr:0.85,mishap:0.28,err:0.14,maxAir:4,maxActive:6,assist:false}
};
function emit(t,d){(G.hooks[t]||[]).forEach(f=>{try{f(d);}catch(e){console.error(e);}});}
function on(t,f){(G.hooks[t]=G.hooks[t]||[]).push(f);}
const dirOf=()=>G.rwy==='09'?1:-1;
const thrX=()=>-dirOf()*AP.thr;
function csName(a){return a.rt+(a.heavy?' heavy':'');}
function todWord(){const h=Math.floor(G.clock/3600)%24;return h<12?'morning':h<18?'afternoon':'evening';}
function V(a,x){
 const w=G.wind;let wd=Math.round(WDM(w)/10)*10%360;if(wd===0)wd=360;
 const v={cs:a?csName(a):'',unit:'',gate:a&&a.gate?a.gate:'',dest:a&&a.dest?a.dest.n:'',sid:a&&a.dest?a.dest.sid:'',sq:a&&a.squawk?a.squawk:'',alt:'5000',qnh:G.qnh,atis:ATIS_L[G.atis%26],rwy:RWD(),hp:a&&a.hp?HPN[a.hp]:'',via:'',hs:', hold short of runway '+RWD(),wdir:pad(wd,3),wspd:Math.round(w.spd),dist:'',facing:'',freq:UNITS.DEP.f,n:'1',exit:'',spd:'160',tod:todWord()};
 return Object.assign(v,x||{});
}
function say(who,a,text,sev){
 const e={t:G.t,clock:G.clock,who,cs:a?a.cs:'',name:a?csName(a):'',text,sev:sev||'',ent:a||null,voice:a&&a.al?a.al.voice:null,accent:a&&a.al?a.al.accent:'',urgent:sev==='urgent'};
 if(who!=='sys'){G.radioFree=Math.max(G.radioFree||0,G.t)+((text.match(/\S+/g)||[]).length*0.38+1.4);}
 G.log.push(e);if(G.log.length>400)G.log.shift();emit('say',e);return e;
}
const sysMsg=(t,sev)=>say('sys',null,t,sev||'');
function later(d,fn){G.q.push({t:G.t+d,fn});}
function incident(kind,text,pen,crit){
 G.safety=Math.max(0,G.safety-pen);G.stats[kind]=(G.stats[kind]||0)+1;
 sysMsg('⚠ '+text+' (safety −'+pen+')','bad');emit('incident',{kind,text,pen});
 if(G.safety<=0&&G.cfg.mode==='career'&&!G.over)endGame('licence','Your safety rating hit zero. The regulator has suspended your licence.');
}
function endGame(kind,reason,ents){G.over={kind,reason,t:G.t};emit('over',G.over);}

/* ---------------- game setup ---------------- */
function newGame(cfg){
 const base=Object.assign({},PRESETS[cfg.level||'controller'],cfg);
 G.cfg=Object.assign({level:'controller',mode:'career',shift:30,tod:'day',fog:false},base);
 G.v=null;G.fly=null;G.t=0;G.clock=({day:10*3600+20*60,dusk:18*3600+30*60,night:23*3600+10*60}[G.cfg.tod])||6*3600+10*60;G.rwy=Math.random()<0.5?'09':'27';
 const wd=G.rwy==='09'?rnd(60,120):rnd(240,300);
 G.wind={dir:wd,spd:rnd(6,12),target:wd,base:rnd(6,12)};G.qnh=rint(1004,1024);G.atis=rint(0,25);
 G.wx=G.cfg.wx||'clear';G.gust=G.wx==='storm'?9:G.wx==='rain'?4:0;if(G.wx==='storm'){G.wind.base+=11;G.qnh=rint(988,1002);}else if(G.wx==='rain'){G.wind.base+=4;G.qnh=rint(996,1010);}
 G.windShiftAt=rnd(480,780);G.fog=!!G.cfg.fog;
 G.cellNext=undefined;G.cell=null;G.rampClosed=false;G.cellGust=0;
 G.ents=[];G.log=[];G.q=[];G.score=0;G.safety=100;G.over=null;G.nextId=1;G.gates={};G.flags={debris:false};
 G.stats={dep:0,arr:0,goArounds:0,incursion:0,los:0,wake:0,emerg:0,delay:0,readback:0};
 G.acc={dep:0,arr:0};G.opsNext=200;G.pairs={};G.lastTO={t:-999,heavy:false};G.sqUsed={};G.scoreLog=[];G.rwyWarn=0;
 spawnDep(rnd(6,10));spawnDep(rnd(22,32));later(rnd(12,18),()=>spawnArr());
 sysMsg('Shift started. Runway '+RWD()+' in use. ATIS '+ATIS_L[G.atis]+', QNH '+G.qnh+'.','ok');
 if(G.fog)sysMsg('Low visibility procedures in force: slower taxi, wider spacing on final, expect delays.','warn');
 emit('new',G);
}

/* ---------------- entity helpers ---------------- */
function gatesFree(){const r=[];for(let i=1;i<=6;i++)if(!G.gates[i])r.push(i);return r;}
function newSquawk(){
 for(let k=0;k<200;k++){const s=[0,0,0,0].map(()=>rint(0,7)).join('');if(['7500','7600','7700','0000','7000','1200','2000'].includes(s)||G.sqUsed[s])continue;G.sqUsed[s]=1;return s;}
 return '4'+rint(0,7)+rint(0,7)+rint(0,7);
}
function uniqueNum(al){for(let k=0;k<50;k++){const n=String(rint(2,998)).padStart(rint(0,1)?3:2,'0').replace(/^0+(?=\d{2})/,'');if(!G.ents.some(e=>e.al&&e.al.icao===al.icao&&e.num===n))return n;}return String(rint(100,999));}
function wpickAl(){const L=AIRPORT.airlines;let t=0;L.forEach(x=>t+=x[1]);let r=Math.random()*t;for(const x of L){r-=x[1];if(r<=0)return AL_BY[x[0]];}return AL_BY[L[0][0]];}
function mkAc(kind,alF,tyF){
 let al=alF||wpickAl(),rare=false,prio=null,sp=null;
 if(!alF&&kind==='arr'&&Math.random()<(G.cfg.rare!==undefined?G.cfg.rare:0.05)){let t=0;RARE_OPS.forEach(x=>t+=x.w);let r=Math.random()*t;for(const x of RARE_OPS){r-=x.w;if(r<=0){al=x;break;}}rare=true;}
 else if(!alF&&kind==='arr'&&Math.random()<(G.cfg.prio!==undefined?G.cfg.prio:0.045)){al=pick(VIS_OPS.filter(o=>o.prio));prio=al.prio;}
 const ty=tyF||TYPES[(al.rareFleet&&al.rareFleet.length&&Math.random()<0.05)?pick(al.rareFleet):pick(al.fleet)]||TYPES.A320;
 if(!alF&&!rare&&!prio&&G.cfg.spec!==false&&specialEligible(al,ty)){
  if(G.forceSpec){sp=SPEC_BY[G.forceSpec];G.forceSpec=null;}
  else if(Math.random()<(G.cfg.spec!==undefined?G.cfg.spec:0.07)){let t=0;SPECIALS.forEach(x=>t+=x.w);let r=Math.random()*t;for(const x of SPECIALS){r-=x.w;if(r<=0){sp=x;break;}}}
  if(sp&&sp.w>=0)al=specialAirline(al,sp);else sp=null;
 }
 let num=uniqueNum(al);if(rare||prio){const f=al.nums.filter(n=>!G.ents.some(e=>e.al&&e.al.icao===al.icao&&e.num===n));num=pick(f.length?f:al.nums);}
 const a={id:G.nextId++,kind,al,type:ty,num,cs:al.icao+num,rt:al.rt+' '+num,heavy:ty.wake==='H',
  x:0,z:0,y:0,th:0,v:0,pitch:0,bank:0,vs:0,phase:'',req:null,nextReq:null,waitSec:0,dead:false,r:0.32*Math.max(ty.wing,ty.len),
  gate:null,dest:pick(DESTS),squawk:'',sqPlan:null,clrOk:false,pushDone:false,node:null,path:null,s:0,paused:false,back:false,
  hp:null,unit:'DEL',cleared:false,D:0,spdCmd:0,fuel:rnd(34,60),mishap:null,err:null,nordo:false,lightG:null,handed:false,
  autoTO:false,blowHold:false,rwyAuth:false,incurred:false,emerg:null,priority:false,t0:G.t,blockT:0,veh:false,chk:0,prio:prio,special:sp?al.special:null};
 if(sp){G.stats.spec=(G.stats.spec||0)+1;later(1.5,()=>{if(!a.dead)sysMsg('Spotter alert: '+a.cs+' ('+ty.n+') is wearing the '+al.special+'.','ok');});}
 return a;
}
function pickW(L){let t=0;L.forEach(x=>t+=x[1]);let r=Math.random()*t;for(const x of L){r-=x[1];if(r<=0)return x[0];}return L[0][0];}
function pickMishap(kind){
 if(G.forceMishap&&kind==='arr'){const m=G.forceMishap;G.forceMishap=null;return m;}
 if(Math.random()>=G.cfg.mishap)return null;
 return kind==='dep'?pickW([['rto',24],['engine',16],['bird',22],['nordo',8],['rtofire',6],['engfire_dep',7],['engsep',2.5],['birdeng',5]]):pickW([['panpan',22],['hijack',2.2],['divert',5],['lowfuel',16],['bstrike',7],['fuelhid',8],['nordo',7],['leak',10],['engfire',8],['gear',8],['hyd',6],['smoke',5]]);
}
function spawnDep(delay){
 const free=gatesFree();if(!free.length)return null;
 const n=pick(free);const a=mkAc('dep');a.gate=String(n);G.gates[n]=a.id;a.x=GATE_X[n-1];a.z=-350;a.th=-Math.PI/2;
 assignSlot(a);a.phase='BOARDING';a.board=0;a.boardTime=delay!==undefined?delay:rnd(30,55);a.mishap=pickMishap('dep');a.rtoSpeed=rnd(48,64);
 G.ents.push(a);emit('spawn',a);return a;
}
function spawnArr(){
 const air=G.ents.filter(e=>!e.dead&&['APPROACH','GOAROUND'].includes(e.phase)).length;
 if(air>=G.cfg.maxAir)return null;
 const d=dirOf();let D=rnd(8.3,9.6)*NM;const SP=G.fog?6.2:4.6;
 G.ents.forEach(e=>{if(e.phase==='APPROACH'&&Math.abs(e.D-D)<SP*NM)D=Math.max(D,e.D+(SP+0.1)*NM);});
 const a=mkAc('arr');a.phase='APPROACH';a.D=D;a.v=150*KT;a.mishap=pickMishap('arr');a.th=d>0?0:Math.PI;placeApproach(a);
 a.checked=false;
 G.ents.push(a);emit('spawn',a);
 if(a.mishap==='nordo'){a.nordo=true;a.squawk='7600';sysMsg('A '+a.cs+' squawking 7600: lost communications. Use the light gun.','warn');}
 else if(a.mishap==='panpan'){a.emerg='panpan';a.squawk='7700';G.stats.emerg++;request(a,'PANPAN',{dist:Math.round(D/NM)});}
 else if(a.mishap==='hijack')startHijack(a,D);
 else if(a.mishap==='divert')startDivert(a,D);
 else if(a.mishap==='fuelhid'){a.fuel=rnd(8,10);request(a,'CHECKIN',{dist:Math.round(D/NM)});}
 else if(a.mishap==='lowfuel'){a.fuel=rnd(9,11);request(a,'CHECKIN',{dist:Math.round(D/NM)});}
 else if(EMKIND[a.mishap]){startArrEmerg(a,D);}
 else if(a.prio)request(a,'PRIO',{dist:Math.round(D/NM),what:a.prio==='medevac'?'medical priority flight, patient on board':'VIP flight'});
 else request(a,'CHECKIN',{dist:Math.round(D/NM)});
 a.checked=true;return a;
}
function placeApproach(a){
 const d=dirOf();a.x=thrX()-d*a.D;const th0=d>0?0:Math.PI;
 a.z=a.zOff||0;a.y=(a.D>0?a.D*TAN3+15:15*clamp(1+a.D/300,0,1))+(a.yOff||0);
 const eps=a.zOff?clamp(a.zOff*0.005,-0.7,0.7):0;a.th=crabTh(a,th0)-d*eps;
}
/* lateral / vertical offsets left over from joining final from a circuit decay smoothly */
function settleOffsets(a,dt){
 if(a.zOff){const eps=clamp(a.zOff*0.005,-0.7,0.7),st=Math.min(Math.abs(a.zOff),a.v*Math.abs(Math.sin(eps))*dt+0.02);a.zOff-=Math.sign(a.zOff)*st;if(Math.abs(a.zOff)<0.5)a.zOff=0;}
 if(a.yOff){a.yOff-=Math.sign(a.yOff)*Math.min(Math.abs(a.yOff),7*dt);if(Math.abs(a.yOff)<0.3)a.yOff=0;}
}

/* ---------------- requests & reminders ---------------- */
/* radio discipline: non-urgent pilots wait for a quiet frequency and never stack more than two open requests */
function radioBusy(){
 if(typeof Mic!=='undefined'&&(Mic.active||Mic.starting))return true;   // the controller is transmitting
 if((G.radioFree||0)>G.t+0.2)return true;
 if(typeof Voice!=='undefined'&&Voice.on&&(Voice.busy||Voice.queue.length))return true;
 let n=0;for(const e of G.ents)if(e.req&&!e.dead&&!(PH[e.req.kind]&&PH[e.req.kind].urgent))n++;
 return n>=2;
}
function request(a,kind,x){
 const ph=PH[kind];if(!ph||a.nordo)return;
 const crit=(kind==='LANDREQ'||kind==='GAREQ')&&a.D&&a.D/NM<2.6;
 if(!ph.urgent&&!crit&&radioBusy()){if(a.pend)return;a.pend=true;later(3+Math.random()*2.5,()=>{a.pend=false;if(!a.dead)request(a,kind,x);});return;}
 a.req={kind,t:G.t,n:0,x:x||{}};a.unit=ph.unit;
 const v=V(a,Object.assign({unit:UNITS[ph.unit].n,dist:a.kind==='arr'&&a.D?String(Math.max(1,Math.round(a.D/NM))):''},x||{}));
 v.dist=String((x&&x.dist)||v.dist);
 if(kind==='VAC'||kind==='GNDTAXI'){v.exit=a.exitName||'Delta';}
 say('pilot',a,fmt(pick(ph.pilot),v),ph.urgent?'urgent':'');
 emit('req',a);
}
function remind(a){
 const ph=PH[a.req.kind];if(!ph.urgent&&((G.radioFree||0)>G.t+0.2||(typeof Mic!=='undefined'&&(Mic.active||Mic.starting))))return;const v=V(a,{unit:UNITS[ph.unit].n});
 const t=pick(['{unit}, {cs}, still waiting.','{unit}, {cs}, do you copy?','{unit}, {cs}, how do you read, we are still waiting.']);
 say('pilot',a,fmt(t,v),ph.urgent?'urgent':'');G.score=Math.max(0,G.score-1);G.stats.delay+=1;
}

/* ---------------- motion helpers ---------------- */
function turnTo(th,target,rate,dt){const d=angDiff(target,th);return th+clamp(d,-rate*dt,rate*dt);}
let BGB=null;
function blockGap(a,dx,dz,look){
 let best=1e9;BGB=null;
 for(const b of G.ents){
  if(b===a||b.dead||b.y>6)continue;
  if(a.veh&&b.veh&&(b.phase==='REQ'||b.phase==='WAIT'||a.vt===b.vt))continue;
  if(['BOARDING','AT_GATE','PARKED'].includes(b.phase)&&(b.gateFixed!==false)&&Math.abs(b.z-a.z)>25)continue;
  const rx=b.x-a.x,rz=b.z-a.z,d=Math.hypot(rx,rz);if(d<0.1)continue;
  const gap=d-a.r-b.r;
  if(gap>look)continue;
  if(a.bypass>0&&(a.veh||b.veh)&&(rx*dx+rz*dz)/d>0.2&&Math.abs(rx*dz-rz*dx)/d<a.r+b.r+14)continue;
  if((rx*dx+rz*dz)/d>0.62&&gap<best){best=gap;BGB=b;}
 }
 return best;
}
function follow(a,dt,o){
 const p=a.path;if(!p){a.v=0;return true;}
 const rem=p.len-a.s;let vt=o.vmax;
 const P=a.pers||(a.pers={s:0.9+Math.random()*0.2,a:0.82+Math.random()*0.36,ph:Math.random()*6.28,w:0.3+Math.random()*0.5,l:0});
 if(!o.fixed)vt*=P.s*(1+0.035*Math.sin(G.t*0.31+P.ph)+0.02*Math.sin(G.t*1.1+P.ph*2));
 const h0=sample(p,a.s).th,la=10+a.v*2.4,h1=sample(p,Math.min(p.len,a.s+la)).th,turnA=Math.abs(angDiff(h1,h0));
 if(turnA>0.1){const vtn=o.vturn||5.5;vt=Math.min(vt,vtn+Math.max(0,vt-vtn)*Math.max(0,1-turnA/0.85));}
 if(o.endStop!==false)vt=Math.min(vt,Math.sqrt(2*1.5*Math.max(0,rem-0.4))+0.2);
 if(G.fog)vt*=0.72;
 let blocked=false;
 if(o.block!==false){
  const q=sample(p,a.s);const sg=o.back?-1:1;
  const g=blockGap(a,Math.cos(q.th)*sg,Math.sin(q.th)*sg,60+a.v*4);
  if(g<1e8){const al=Math.max(0,g-14)*0.35;if(al<vt){vt=al;blocked=al<0.4;}}
 }
 // stuck behind a vehicle (or a vehicle behind anything)? after a short wait, resolve it
 if(blocked&&BGB&&(a.veh||BGB.veh)&&a.v<0.5){a.blkT=(a.blkT||0)+dt;
  if(a.blkT>9){a.blkT=0;
   if(!a.veh&&BGB.veh){BGB.yieldFor=a;BGB.yieldT=40;BGB.yDir=((a.x-BGB.x)*Math.sin(a.th)-(a.z-BGB.z)*Math.cos(a.th)>0)?1:-1;BGB.yMag=a.r+BGB.r+24;BGB.yDone=0;}
   else if(!(a.bypass>0)){a.bypass=24;a.latDir=(a.id%2)?1:-1;a.latMag=a.r+BGB.r+7;}
  }}else if(!blocked)a.blkT=0;
 if(a.bypass>0){a.bypass-=dt;if(vt<2.8)vt=Math.max(vt,2.8);}
 const wnd=(o.back||turnA>0.1)?0:Math.sin(G.t*0.23+P.ph)*P.w*Math.min(1,a.v/4)*(a.veh?0.7:1);
 a.lat=(a.lat||0)+((a.bypass>0?(a.latDir||1)*(a.latMag||9):wnd)-(a.lat||0))*Math.min(1,dt*(a.bypass>0?0.9:0.5));
 if(a.paused)vt=0;
 a.blocked=blocked;
 const acc=(o.acc||1.1)*P.a,dec=o.dec||2.2;
 const da=clamp((vt-a.v)*1.4,-dec,acc);a.ac=(a.ac||0)+(da-(a.ac||0))*Math.min(1,dt*(da<(a.ac||0)?4:2.2));
 a.v=Math.max(0,a.v+a.ac*dt);if(vt<=0.05&&a.v<0.15)a.v=0;
 a.s=Math.min(p.len,a.s+a.v*dt);
 const q=sample(p,a.s);a.x=q.x-Math.sin(q.th)*(a.lat||0);a.z=q.z+Math.cos(q.th)*(a.lat||0);
 if(!o.back){const tg=sample(p,Math.min(p.len,a.s+2+a.v*0.45)).th,dd=angDiff(tg,a.th),rt=(o.snap?4:o.turn||0.9);a.th+=clamp(dd*Math.min(1,dt*(o.snap?5:2.6+a.v*0.2)),-rt*dt,rt*dt);}
 return a.s>=p.len-0.08&&a.v<0.6;
}
function rwyOccupied(except){
 return G.ents.find(e=>e!==except&&!e.dead&&e.y<20&&Math.abs(e.z)<58&&Math.abs(e.x)<AP.half+30&&!['BOARDING','AT_GATE','PARKED'].includes(e.phase)&&e.phase!=='CLIMB'&&e.phase!=='GOAROUND'&&e.phase!=='APPROACH')||null;
}
function nearestConn(x){let b='B',bd=1e9;['B','C','D','E'].forEach(k=>{const d=Math.abs(NODES['H'+k].x-x);if(d<bd){bd=d;b=k;}});return b;}
function toffReq(a){const ty=a.type;const v=(ty.vr+6)*KT;return v*v/(2*ty.acc)*1.12;}
function availRoll(hpId){const x=NODES[hpId].x;return dirOf()>0?AP.half-x-70:x+AP.half-70;}
function defaultHold(a){
 const list=dirOf()>0?['HB','HC','HD','HE']:['HE','HD','HC','HB'];
 for(const h of list)if(availRoll(h)>=toffReq(a))return h;return list[0];
}
function facingFor(a){
 const from='P'+a.gate;const r=route(from,defaultHold(a));if(!r||r.ids.length<2)return 'west';
 const n1=NODES[r.ids[1]],n0=NODES[from];const dx=n1.x-n0.x;return dx>=0?'east':'west';
}

/* ---------------- main step ---------------- */
function step(dt){
 if(G.over)return;
 G.t+=dt;G.clock+=dt;
 for(let i=G.q.length-1;i>=0;i--){if(G.q[i].t<=G.t){const f=G.q[i].fn;G.q.splice(i,1);try{f();}catch(e){console.error(e);}}}
 weather(dt);cellUpdate(dt);wakeUpdate(dt);visUpdate(dt);spawnLogic(dt);
 for(const e of G.ents){if(e.dead)continue;if(e.yieldT>0){e.yieldT-=dt;if(e.yDone<e.yMag){const st=Math.min(6*dt,e.yMag-e.yDone);e.yDone+=st;e.x+=-Math.sin(e.th)*e.yDir*st;e.z+=Math.cos(e.th)*e.yDir*st;}}if(e.veh)updVeh(e,dt);else updAc(e,dt);}
 collisions();separation();
 for(let i=G.ents.length-1;i>=0;i--)if(G.ents[i].dead){emit('remove',G.ents[i]);G.ents.splice(i,1);}
 if(!G.over&&G.t>G.cfg.shift*60)endGame('shift','Shift complete.');
}
function weather(dt){
 const w=G.wind;
 if(G.t>G.windShiftAt&&!G.shifted){G.shifted=true;w.target=G.rwy==='09'?rnd(240,290):rnd(70,110);G.atis=(G.atis+1)%26;sysMsg('Wind is shifting. New ATIS '+ATIS_L[G.atis]+' — a runway change may be needed.','warn');emit('atis',G);}
 const dd=angDiff(w.target*D2R,w.dir*D2R)*R2D;w.dir=(w.dir+clamp(dd,-0.6*dt,0.6*dt)+360)%360;
 w.spd=Math.max(2,w.base+Math.sin(G.t/17)*2.2+Math.sin(G.t/5.3)*1.2+(G.gust||0)*Math.max(0,Math.sin(G.t*1.3)*Math.sin(G.t/2.9))+(G.cellGust||0)*(0.5+0.5*Math.sin(G.t*1.9)*Math.sin(G.t*0.7+1)));
 const hr=(G.rwy==='09'?90:270),head=w.spd*Math.cos((w.dir-hr)*D2R);G.head=head;
 G.rwyBetter=null;const other=G.rwy==='09'?270:90,ho=w.spd*Math.cos((w.dir-other)*D2R);
 if(head<-6&&ho>head+8)G.rwyBetter=G.rwy==='09'?'27':'09';
}
function spawnLogic(dt){
 const c=G.cfg;G.acc.dep+=c.dep*dt/60*(0.7+0.6*Math.random());G.acc.arr+=c.arr*dt/60*(0.7+0.6*Math.random());
 const active=G.ents.filter(e=>!e.veh&&!e.dead&&e.phase!=='BOARDING'&&e.phase!=='PARKED').length,full=active>=(c.maxActive||99);
 if(G.acc.dep>=1){if(!full&&gatesFree().length>=2&&spawnDep())G.acc.dep=0;else G.acc.dep=0.9;}
 if(G.acc.arr>=1){if(!full&&spawnArr())G.acc.arr=0;else G.acc.arr=0.95;}
 if(G.t>G.opsNext&&!G.ents.some(e=>e.veh&&e.vt==='ops')){G.opsNext=G.t+rnd(300,420);spawnOps(false);}
}

/* ---------------- aircraft update ---------------- */
function updAc(a,dt){
 emergTick(a,dt);if(G.over)return;
 if(a.req){if(a.req.hold&&G.t-a.req.hold<45){a.req.t=G.t;}else{a.req.hold=0;a.waitSec+=dt;}const lim=(PH[a.req.kind].patience||50)*(a.req.n+1);if(G.t-a.req.t>lim&&!a.nordo){a.req.n++;remind(a);}}
 if(!a.req&&a.nextReq&&G.t>=a.nextReq.at){const n=a.nextReq;a.nextReq=null;request(a,n.kind,n.x);}
 if(a.vis){visTick(a,dt);return;}
 specTick(a,dt);
 if(a.err&&G.t>=a.err.at)applyErr(a);
 // incursion detector
 if(!a.rwyAuth&&(a.phase==='TAXI'||(a.phase==='LINEUP'&&a.rogue))&&Math.abs(a.z)<56&&Math.abs(a.x)<AP.half+20&&!a.incurred){
  a.incurred=true;incident('incursion','RUNWAY INCURSION: '+a.cs+' crossed the hold line without clearance',15);
 }
 switch(a.phase){
 case 'BOARDING':
  if(!G.rampClosed)a.board+=dt/a.boardTime;if(a.board>=1){a.board=1;a.phase='AT_GATE';if(!a.clrOk)request(a,'CLR');}break;
 case 'AT_GATE':
  if(a.clrOk&&!a.req&&!a.nextReq&&!a.pushAsked){a.pushAsked=true;a.nextReq={kind:'PUSH',at:G.t+rnd(7,14)};}
  break;
 case 'PUSHBACK':{
  const done=follow(a,dt,{vmax:2.3,back:true,acc:0.7,dec:1.2,endStop:true});
  if(done){a.phase='PUSH_TURN';const r=route('P'+a.gate,defaultHold(a));const n1=r?NODES[r.ids[1]]:{x:-1,z:-300},n0=NODES['P'+a.gate];a.faceTh=Math.atan2(n1.z-n0.z,n1.x-n0.x);}
  break;}
 case 'PUSH_TURN':
  a.th=turnTo(a.th,a.faceTh,0.45,dt);
  if(Math.abs(angDiff(a.th,a.faceTh))<0.03){a.phase='STOPPED';a.node='P'+a.gate;a.pushDone=true;a.nextReq={kind:'TAXI',at:G.t+rnd(3,6)};}
  break;
 case 'STOPPED':case 'HOLDING':case 'VACATED':case 'ON_RWY_WAIT':break;
 case 'TAXI':{
  const apron=a.z<-240&&a.kind==='dep'||a.z<-240;
  const vmax=apron?5.5:(a.z>-120?7:11);
  if(a.blowHold&&a.kind==='dep'&&a.path&&a.s>=a.path.len-10){a.blowHold=false;startLineup(a,true);break;}
  const done=follow(a,dt,{vmax,vturn:5});
  if(done){
   if(a.kind==='dep'){a.phase='HOLDING';a.node=a.destNode;a.nextReq={kind:'READY',at:G.t+rnd(2,4)};}
   else{a.phase='PARKED';a.parkT=0;a.node=null;a.th=-Math.PI/2;emit('parked',a);}
  }
  break;}
 case 'LINEUP':{
  const done=follow(a,dt,{vmax:6,vturn:5,turn:0.8});
  a.rwyAuth=a.rwyAuth||!a.rogue;
  if(done){
   a.phase='ON_RWY';a.th=dirOf()>0?0:Math.PI;
   if(a.rollNext){a.rollNext=false;startRoll(a);break;}
   if(a.mishap==='nordo'&&!a.nordo&&!a.autoTO){a.nordo=true;a.squawk='7600';sysMsg(a.cs+' has stopped responding and is squawking 7600 on the runway.','warn');}
   else if(!a.autoTO)a.nextReq={kind:'TKOF',at:G.t+rnd(3,5)};
  }
  break;}
 case 'ON_RWY':
  if(a.autoTO&&!a.rogueTO){a.rogueTO=true;incident('incursion','TAKEOFF WITHOUT CLEARANCE: '+a.cs+' started rolling after a read-back error',10);startRoll(a);}
  if(a.nordo&&a.lightG==='green'){a.lightG=null;startRoll(a);}
  break;
 case 'ROLL':rollUpdate(a,dt);break;
 case 'RTO':
  a.v=Math.max(0,a.v-3.0*dt);a.x+=dirOf()*a.v*dt;
  if(a.v<=0.1){a.phase='RWY_STOP';a.stopT=G.t;if(a.mishap==='rtofire'){a.mishap=null;igniteAc(a,0.55,'brakes');request(a,'EVAC',{why:'fire warning, rejected takeoff'});a.emerg='evac';later(7,()=>{if(!a.dead)startEvac(a);});}else request(a,'RTO');if(!a.emerg)a.emerg='rto';G.stats.emerg++;sendFire(a.x);}
  if(a.mishap==='rtofire'&&a.v<45&&!a.dmg){a.dmg={brakes:true};}
  break;
 case 'RWY_STOP':
  if(a.req==null&&!a.towAt&&a.ack){a.towAt=G.t+(a.belly?170:a.burned?200:90);}
  if(a.towAt&&G.t>a.towAt&&(a.fire||0)<=0.02){sysMsg(a.cs+' towed clear of the runway.','ok');G.score+=60;a.emerg=null;finishAc(a,true);}
  break;
 case 'SLIDE':slideUpdate(a,dt);break;
 case 'CLIMB':climbUpdate(a,dt);break;
 case 'RETURN':
  if(G.t-a.retT>20){if(!a.circ){startCircuit(a,rnd(6.2,7));a.circ.vt=92;}circuitFly(a,dt,true);}
  else{a.v=Math.min(a.v+0.5*dt,80);a.x+=Math.cos(a.th)*a.v*dt;a.z+=Math.sin(a.th)*a.v*dt;a.y=Math.min(450,a.y+4*dt);}
  break;
 case 'APPROACH':appUpdate(a,dt);break;
 case 'GOAROUND':{
  if(!a.circ)startCircuit(a,rnd(5.4,6.0));
  a.gaT+=dt;
  if(a.y>300&&!a.gaCalled){a.gaCalled=true;request(a,'GAREQ');}
  circuitFly(a,dt);
  break;}
 case 'ROLLOUT':rolloutUpdate(a,dt);break;
 case 'BLOCKED_ROLL':
  a.v=Math.max(0,a.v-2.6*dt);a.x+=dirOf()*a.v*dt;
  if(a.v<=0.1){a.phase='RWY_STOP';request(a,'BURST');a.emerg='burst';G.stats.emerg++;sendFire(a.x);}
  break;
 case 'PARKED':
  a.parkT+=dt;if(a.parkT>32){finishAc(a,true);}
  break;
 }
 if(a.kind==='arr'&&['APPROACH','GOAROUND'].includes(a.phase)){
  a.fuel-=dt/60;
  if(a.fuel<12&&!a.lowCalled&&!a.emerg){a.lowCalled=true;a.emerg='fuel';G.stats.emerg++;request(a,'LOWFUEL');}
  if(a.fuel<4&&!a.maydayFuel){a.maydayFuel=true;a.squawk='7700';say('pilot',a,'Mayday, mayday, mayday, '+csName(a)+', fuel emergency, we must land now.','urgent');}
  if(a.fuel<=0&&!a.dead_stick&&!G.over){a.dead_stick=true;a.engOut=true;a.dmg=a.dmg||{};a.dmg.engL='out';a.dmg.engR='out';say('pilot',a,'Mayday mayday mayday, '+csName(a)+', flame out, both engines, we are gliding!','urgent');}
 }
}
function applyErr(a){
 const e=a.err;a.err=null;if(!e)return;
 G.stats.readback++;
 if(e.kind==='sq'){a.squawk=e.wrong;a.sqBad=true;incident('readback','Uncorrected read-back: '+a.cs+' set squawk '+e.wrong+' instead of '+e.real,3);}
 else if(e.kind==='hold'){a.blowHold=true;incident('readback','Uncorrected read-back: '+a.cs+' did not read back "hold short"',5);}
 else if(e.kind==='tko'){a.autoTO=true;incident('readback','Uncorrected read-back: '+a.cs+' read back "cleared for takeoff" to a line-up instruction',5);}
}
function finishAc(a,ok){
 if(a.dead)return;a.dead=true;
 if(a.gate&&G.gates[a.gate]===a.id)delete G.gates[a.gate];
 if(ok){
  const base=a.kind==='dep'?120:100;const pen=Math.min(70,a.waitSec/5);const sc=Math.round(base-pen+(a.emerg?0:0)+(a.bonus||0));
  G.score+=Math.max(10,sc);if(a.kind==='dep')G.stats.dep++;else G.stats.arr++;
  G.scoreLog.push({cs:a.cs,pts:Math.max(10,sc),kind:a.kind});emit('score',{a,pts:sc});
 }
}
function startLineup(a,rogue){
 const hid=a.node||a.destNode;const d=dirOf();const rx=NODES['R'+hid.slice(1)];
 const P=[{x:a.x,z:a.z},{x:rx.x,z:0},{x:rx.x+d*80,z:0}];
 a.path=buildPath(P,38);a.s=0;a.paused=false;a.phase='LINEUP';a.rogue=!!rogue;a.rwyAuth=!rogue;a.back=false;a.node=null;
}
function startRoll(a){
 a.phase='ROLL';a.rwyAuth=true;a.v=Math.max(a.v,0);a.z=0;a.th=dirOf()>0?0:Math.PI;a.req=null;a.nextReq=null;
 a.tkT=G.t;
}
function rollUpdate(a,dt){
 const d=dirOf(),ty=a.type;
 if((a.mishap==='rto'||a.mishap==='rtofire')&&!a.mDone&&a.v>=a.rtoSpeed){a.mDone=true;say('pilot',a,'Stopping, stopping! '+csName(a)+'.','urgent');a.phase='RTO';return;}
 const tail=Math.max(0,-G.head||0);
 a.v+=ty.acc*(a.v<8?0.85:1)*(1-tail*0.01)*dt;
 a.x+=d*a.v*dt;a.z=0;a.th=d>0?0:Math.PI;
 if(!a.obsChk&&a.v>12){a.obsChk=true;const ob=G.ents.find(e=>e!==a&&!e.dead&&e.y<20&&Math.abs(e.z)<30&&(e.x-a.x)*d>0&&(e.x-a.x)*d<1400&&e.phase!=='CLIMB');if(ob&&Math.random()<0.75){say('pilot',a,'Stopping, stopping, '+(ob.veh?'vehicle':'aircraft')+' on the runway, '+csName(a)+'!','urgent');a.phase='RTO';return;}}
 if(a.v>=ty.vr*KT)a.pitch=Math.min(0.12,a.pitch+0.045*dt);
 if(G.flags.debris&&!a.debrisChk&&a.v>30){a.debrisChk=true;if(Math.random()<0.5){a.phase='RTO';say('pilot',a,'Tyre burst! Stopping, stopping!','urgent');a.mishap=null;return;}}
 if(a.v>=(ty.vr+6)*KT){
  a.phase='CLIMB';a.y=0.6;a.vs=0.5;checkSlot(a);
  const prev=G.lastTO;const need=prev.heavy?120:60;
  if(G.t-prev.t<need&&G.t-prev.t>0){a.wakeT=9;incident('wake','WAKE TURBULENCE: '+a.cs+' departed only '+Math.round(G.t-prev.t)+' s behind '+(prev.heavy?'a heavy':'another aircraft')+' (need '+need+' s)',5);}
  G.lastTO={t:G.t,heavy:a.heavy};a.rwyAuth=false;a.outTh=(a.dest.th-AP.hdg)*D2R;a.tkLift=G.t;
  return;
 }
 if(Math.abs(a.x)>AP.half+60){crash([a],'RUNWAY OVERRUN: '+a.cs+' ran out of runway before rotating. Heavy aircraft need the full length.');}
}
function climbUpdate(a,dt){
 a.v=Math.min(a.v+1.1*dt,a.engOut?77:84);a.vs=Math.min(a.vs+2.6*dt,a.engOut?4.6:11);if(a.engOut){a.th+=0.011*(a.engSide||1)*dt;a.bank=lerp(a.bank,0.12*(a.engSide||1),dt);}a.y+=a.vs*dt;a.pitch=lerp(a.pitch,0.13,dt);
 if(a.y>110)a.th=turnTo(a.th,a.outTh,0.05,dt);
 if(!a.engOut)a.bank=lerp(a.bank,clamp(angDiff(a.outTh,a.th)*3,-0.35,0.35),dt);
 a.x+=Math.cos(a.th)*a.v*dt;a.z+=Math.sin(a.th)*a.v*dt;
 if(a.y>28&&!a.airCalled){a.airCalled=true;
  if(a.mishap==='engine'||a.mishap==='engfire_dep'||a.mishap==='engsep'||a.mishap==='birdeng'){climbEngFail(a);return;}
  if(a.mishap==='bird'){a.mishap=null;G.flags.debris=true;request(a,'BIRD',{});a.birdCall=true;spawnOps(true);return;}
  request(a,'AIRB');
 }
 if(a.y>900&&!a.handed){incident('readback','No handoff: '+a.cs+' left the frequency without a "contact Departure"',3);finishAc(a,true);return;}
 if(a.y>1600||Math.hypot(a.x,a.z)>20000){finishAc(a,true);}
}
function appUpdate(a,dt){
 const d=dirOf(),ty=a.type,vref=ty.vref*KT,Dnm=a.D/NM;
 let vt;if(a.spdCmd&&Dnm>3.2)vt=a.spdCmd*KT;else vt=Dnm>6?160*KT:Dnm<2.2?vref:lerp(vref,160*KT,(Dnm-2.2)/3.8);
 vt=Math.max(vt,vref);if(a.hyd)vt=Math.max(vt,vref+16*KT);a.v+=clamp(vt-a.v,-1.3*dt,1.0*dt);
 const thPrev=a.th;settleOffsets(a,dt);a.D-=a.v*dt;placeApproach(a);if(!a.engOut&&dt>0){const yr=angDiff(a.th,thPrev)/dt;a.bank=lerp(a.bank||0,clamp(yr*a.v/9.81,-0.45,0.45),Math.min(1,dt*2));}a.pitch=a.y<20?lerp(-0.03,0.075,clamp(1-a.y/20,0,1)):-0.03-0.02*clamp((a.y-20)/60,0,1);if(a.engOut)a.bank=lerp(a.bank,0.09*(a.engSide||1),dt);if(a.dead_stick){a.sinkX=(a.sinkX||0)+5.2*dt;a.y=Math.max(0,a.y-a.sinkX);if(a.y<=1&&a.D>40){a.x=a.x;deadStickCrash(a);return;}}
 if((!a.req||['CHECKIN','PRIO','DIVERT'].includes(a.req.kind))&&!a.nextReq&&!a.cleared&&a.D>0&&(!a.askedLand&&Dnm<4.2||a.askedLand&&Dnm<2.2&&G.t-(a.lastLR||0)>20)){a.askedLand=true;a.lastLR=G.t;request(a,'LANDREQ',{dist:Math.max(1,Math.round(Dnm))});}
 if(arrivalProblem(a,Dnm))return;
 if(a.D>0&&a.chk<1&&Dnm<0.62||a.D>0&&a.chk<2&&Dnm<0.27){
  a.chk=(a.chk||0)+1;
  const occ=rwyOccupied(a);const tail=Math.max(0,-G.head||0);
  let why=null;
  if(a.nordo&&a.lightG!=='green')why='no light signal';
  else if(!a.cleared&&!a.emerg&&a.chk===1&&Dnm<0.62)why=null;
  else if(occ&&(occ.veh||Math.random()<(a.chk===1?0.9:0.8)))why='runway occupied';
  else if(a.chk===1&&(tail>12||G.fog)&&Math.random()<0.28)why=tail>12?'tailwind':'no visual contact with the runway';
  if(why)startGoAround(a,why);
 }
 if(a.D>0&&Dnm<0.34&&!a.cleared&&!a.emerg&&!a.nordo)startGoAround(a,'no landing clearance received');
 if(a.D>0&&Dnm<0.34&&a.nordo&&a.lightG!=='green')startGoAround(a,'no light signal');
 if(a.D<=-300)touchdown(a);
}
function startGoAround(a,why){
 if(a.phase==='GOAROUND')return;
 a.phase='GOAROUND';a.gaT=0;a.vs=3;a.stats=0;a.req=null;G.stats.goArounds++;a.fuel-=3;a.gaCalled=false;
 say('pilot',a,'Going around, '+csName(a)+(why?' ('+why+')':'')+'.','urgent');
 if(why==='runway occupied'||/^no landing clearance/.test(why)){G.safety=Math.max(0,G.safety-2);sysMsg('Go-around: '+why+' (safety −2)','warn');}
 emit('goaround',a);
}
/* missed approach / return circuit: climb straight ahead, crosswind, downwind, base, re-join final */
function startCircuit(a,Dnm){
 const d=dirOf(),T=AP.thr,xF=thrX()-d*Dnm*NM,sd=a.cside||(a.cside=Math.random()<0.72?1:-1);
 const W=[];
 if(a.x*d<T+3200)W.push({x:d*(T+3600),z:0});
 W.push({x:d*(T+4800),z:sd*1800},{x:d*(T+3400),z:sd*4000},{x:d*(T+400),z:sd*4200},{x:xF-d*1500,z:sd*4200,tag:'dw'},{x:xF-d*3500,z:sd*2300},{x:xF,z:0,fin:true});
 a.circ={W,i:0,ext:0,Dnm,vt:95};a.stats=0;
}
function circuitFly(a,dt,isRet){
 const c=a.circ,w=c.W[c.i],d=dirOf(),th0=a.th;
 const dx=w.x-a.x,dz=w.z-a.z,dist=Math.hypot(dx,dz);
 const turnRate=a.engOut?0.035:0.052;
 a.th=turnTo(a.th,Math.atan2(dz,dx),turnRate,dt);
 a.v+=clamp(c.vt-a.v,-1.3*dt,1.5*dt);
 a.x+=Math.cos(a.th)*a.v*dt;a.z+=Math.sin(a.th)*a.v*dt;
 const Dnow=d*(thrX()-a.x);
 let altT=c.i<2?(c.W.length>6&&c.i===0?420:640):(w.fin||w.tag||c.i>=c.W.length-3)?clamp(Math.max(Dnow,2500)*TAN3+15,650,900):720;
 const vsT=clamp((altT-a.y)*0.22,-3.6,a.gaT<14&&!isRet?9.5:7.5);
 a.vs=lerp(a.vs||0,vsT,Math.min(1,dt*1.1));a.y+=a.vs*dt;
 a.pitch=lerp(a.pitch||0,clamp(a.vs/Math.max(a.v,30)*1.3+0.025,-0.05,0.15),Math.min(1,dt*1.4));
 const yr=angDiff(a.th,th0)/Math.max(dt,1e-3);a.bank=lerp(a.bank||0,clamp(yr*a.v/9.81,-0.48,0.48),Math.min(1,dt*2));
 if(w.tag==='dw'&&dist<1900&&!c.chkd){
  c.chkd=true;
  const Dint=c.Dnm*NM,blocked=G.ents.some(e=>e!==a&&!e.dead&&e.phase==='APPROACH'&&e.D>0&&Math.abs(e.D-4300-Dint)<4.3*NM);
  if(blocked&&c.ext<4){c.ext++;c.chkd=false;c.Dnm+=1.8;const sh=-d*3330;for(let k=c.i;k<c.W.length;k++){c.W[k].x+=sh;}
   if(c.ext===1)say('pilot',a,'Tower, '+csName(a)+', extending downwind for spacing.','');}
 }
 const lead=w.fin?350:w.tag?1500:1700;
 if(dist<lead||(w.fin&&Dnow<c.Dnm*NM+300&&dist<1400)){
  c.i++;c.chkd=false;
  if(c.i>=c.W.length){
   const D=Math.max(3*NM,Dnow);a.D=D;a.zOff=a.z;a.yOff=a.y-(D*TAN3+15);a.circ=null;a.phase='APPROACH';a.kind='arr';
   a.decided=false;a.chk=0;a.asked=false;a.askedLand=false;a.cleared=!!(isRet&&a.preCleared);a.gaCalled=false;a.req=null;a.nextReq=null;a.v=Math.max(a.v,a.type.vref*KT+8);
   if(!isRet)request(a,'CHECKIN',{dist:Math.round(a.D/NM)});
  }
 }
}
function touchdown(a){
 a.phase='ROLLOUT';a.y=0;a.pitch=0.07;a.tdT=G.t;a.tdHard=Math.random();a.rwyAuth=true;a.z=0;const d=dirOf();
 if(a.slideKind&&startSlide(a))return;
 if(G.flags.debris&&Math.random()<0.5){a.phase='BLOCKED_ROLL';say('pilot',a,'Tyre burst on landing, '+csName(a)+'!','urgent');return;}
 const ex=d>0?['D','E']:['C','B'];let pickX=null;
 for(const k of ex){const sx=Math.abs(NODES['R'+k].x-a.x);if(a.v*a.v-121<=6.5*sx&&sx>0){pickX=k;break;}}
 if(!pickX)pickX=ex[ex.length-1];
 a.exitKey=pickX;a.exitName=EXN[pickX];const X=NODES['R'+pickX].x;
 a.path=buildPath([{x:a.x,z:0},{x:X,z:0},{x:X,z:-105}],50);a.s=0;a.sExit=Math.abs(X-a.x);a.vacNode='V'+pickX;
 a.cleared=false;
 if(a.emerg&&a.emerg!=='fuel')sendFire(a.x);
}
function rolloutUpdate(a,dt){
 const p=a.path,rem=p.len-a.s;
 if(a.s<a.sExit-35){
  const dd=clamp((a.v*a.v-121)/(2*Math.max(30,a.sExit-35-a.s)),0.7,3.4);a.v=Math.max(a.v-dd*dt,3);
 }else{let vt=Math.min(10.5,Math.sqrt(2*1.5*Math.max(0,rem-0.5))+0.3);const g=blockGap(a,Math.cos(a.th),Math.sin(a.th),70);if(g<1e8)vt=Math.min(vt,Math.max(0,g-14)*0.4);a.v+=clamp(vt-a.v,-3*dt,1.0*dt);if(a.v<0.2&&rem<1)a.v=0;}
 a.pitch=a.pitch+(-0.012-a.pitch)*Math.min(1,dt*(a.v>35?0.7:1.5));if(a.v<45&&a.pitch<0)a.pitch*=Math.max(0,1-dt*0.8);
 a.s=Math.min(p.len,a.s+a.v*dt);const q=sample(p,a.s);a.x=q.x;a.z=q.z;a.th=turnTo(a.th,q.th,1.1,dt);
 if(a.s>=p.len-0.1){a.phase='VACATED';a.node=a.vacNode;a.rwyAuth=false;a.th=-Math.PI/2;a.v=0;a.nordo=false;if(a.mishap==='nordo')a.squawk='';request(a,'VAC');}
}

/* ---------------- vehicles ---------------- */
function mkVeh(vt,x,z){return {id:G.nextId++,kind:'veh',veh:true,vt,x,z,y:0,th:Math.PI,v:0,r:5,dead:false,phase:'WAIT',path:null,s:0,cs:vt==='ops'?'OPS1':'FIRE'+G.nextId,rt:vt==='ops'?'Operations 1':'Fire 1',num:'1',al:null,type:{wing:6,len:7},waitSec:0,req:null,rwyAuth:false,paused:false};}
function spawnOps(urgent){
 if(G.ents.some(e=>e.veh&&e.vt==='ops'&&!e.dead))return;
 const v=mkVeh('ops',0,-110);v.phase='REQ';v.rt='Operations 1';v.t0=G.t;G.ents.push(v);emit('spawn',v);
 later(urgent?14:2,()=>{if(!v.dead){v.req={kind:'INSP',t:G.t,n:0,x:{}};v.unit='GND';const t=fmt(PH.INSP.pilot[0],V(null,{unit:UNITS.GND.n,rwy:RWD()}));say('pilot',v,t,'');emit('req',v);}});
}
function sendFire(x){
 const ex=G.ents.filter(e=>e.veh&&e.vt==='fire'&&!e.dead);
 if(ex.length){ex.forEach((v,i)=>{v.target=x;v.off=(i?-1:1)*(55+i*8);v.until=G.t+160;});return;}
 for(let k=0;k<2;k++){
  const v=mkVeh('fire',(k?20:-20),-112);v.phase='GO';v.rt='Fire '+(k+1);v.fireIdx=k;v.target=x;v.off=(k?-1:1)*(55+k*8);
  const hk='H'+nearestConn(x);const r=route('DP',hk);
  const hn=NODES[hk];const ids=r.ids.slice(0,-1);const pts=[{x:v.x,z:v.z}];ids.forEach(id=>pts.push({x:NODES[id].x,z:NODES[id].z}));pts.push({x:hn.x,z:-62});pts.push({x:x+v.off,z:-62});
  v.path=buildPath(pts,30);if(k){v.paused=true;v.startAfter=G.t+7;}
  v.s=0;v.until=G.t+160;G.ents.push(v);emit('spawn',v);
 }
 sysMsg('Emergency services rolling.','warn');
}
function opsInspectPath(){
 const hk='H'+(G.rwy==='09'?'C':'D');const k=hk.slice(1);const rx=NODES['R'+k];
 const out=route('DP',hk),back=route(hk,'DP');
 const P=[];out.ids.forEach(id=>P.push({x:NODES[id].x,z:NODES[id].z}));
 P.push({x:rx.x,z:0});P.push({x:-AP.half+40,z:0});P.push({x:AP.half-40,z:0});P.push({x:rx.x,z:0});
 back.ids.forEach(id=>P.push({x:NODES[id].x,z:NODES[id].z}));
 return buildPath(P,28);
}
function updVeh(v,dt){
 switch(v.phase){
 case 'REQ':case 'WAIT':
  if(v.req){v.waitSec+=dt;if(G.t-v.req.t>(v.req.n+1)*75){v.req.n++;say('pilot',v,fmt('{unit}, Operations 1, still waiting for the runway inspection.',{unit:UNITS.GND.n}));}}
  break;
 case 'INSP':{
  if(v.s>=v.sIn-3&&!v.wasOn){
   const busy=G.ents.some(e=>!e.veh&&!e.dead&&(['ROLL','ROLLOUT','RTO','BLOCKED_ROLL','LINEUP','ON_RWY','RWY_STOP'].includes(e.phase)||(e.phase==='APPROACH'&&e.D<2.6*NM&&e.D>-300)));
   v.paused=busy;
  }else v.paused=false;
  const done=follow(v,dt,{vmax:v.s>v.sIn&&v.s<v.sOut?32:11,snap:true,block:true,endStop:true,acc:3,dec:8,turn:3});
  const onRwy=Math.abs(v.z)<58;
  if(onRwy&&!v.wasOn){v.wasOn=true;v.rwyAuth=true;}
  if(v.wasOn&&!onRwy&&v.s>v.sOut-10&&!v.reported){v.reported=true;v.rwyAuth=false;say('pilot',v,fmt('Runway {rwy} inspection complete, Operations 1 vacated.',{rwy:RWD()}));G.flags.debris=false;G.score+=25;}
  if(done){v.dead=true;}
  break;}
 case 'GO':{
  if(v.startAfter&&G.t>=v.startAfter){v.paused=false;v.startAfter=0;}
  const done=follow(v,dt,{vmax:16,snap:true,acc:3,dec:6,turn:3});
  if(done){v.phase='ONSCENE';}
  break;}
 case 'ONSCENE':
  if(v.target!==undefined&&Math.abs(v.x-(v.target+v.off))>25&&Math.abs(v.z+62)<10){v.path=buildPath([{x:v.x,z:v.z},{x:v.target+v.off,z:-62}],20);v.s=0;v.phase='GO';break;}
  if(G.t>v.until&&!G.ents.some(e=>(e.emerg||e.fire>0)&&!e.dead&&['RWY_STOP','ROLLOUT','BLOCKED_ROLL','APPROACH','RTO','SLIDE','RETURN'].includes(e.phase))){
   const hk=nearestConn(v.x);const r=route('H'+hk,'DP');v.path=pathFromNodes(r.ids,{x:v.x,z:-62},30);v.s=0;v.phase='BACK';v.spray=0;
  }
  break;
 case 'BACK':{const done=follow(v,dt,{vmax:v.fast?30:16,snap:true,acc:3,dec:8,turn:3});if(done)v.dead=true;break;}
 }
}

/* ---------------- collisions & separation ---------------- */
function crash(list,reason){
 if(G.over)return;
 const pos=list[0];list.forEach(e=>{e.crashV=e.v;e.crashVs=e.vs||0;});emit('accident',{x:pos.x,z:pos.z,y:pos.y,list,reason});
 if(G.cfg.mode==='training'){
  list.forEach(e=>{if(!e.veh){e.dead=true;if(e.gate&&G.gates[e.gate]===e.id)delete G.gates[e.gate];}else e.dead=true;});
  incident('crash','ACCIDENT (training mode): '+reason,35);return;
 }
 list.forEach(e=>{e.crashed=true;e.crashV=e.v;e.crashVs=e.vs||0;e.v=0;});
 G.crashed=list;endGame('accident',reason);
}
function collisions(){
 const L=G.ents;
 for(let i=0;i<L.length;i++){const a=L[i];if(a.dead)continue;
  for(let j=i+1;j<L.length;j++){const b=L[j];if(b.dead)continue;
   if(a.veh&&b.veh)continue;
   if(['BOARDING','AT_GATE','PARKED'].includes(a.phase)&&['BOARDING','AT_GATE','PARKED'].includes(b.phase))continue;
   if((a.phase==='PUSHBACK'||b.phase==='PUSHBACK')&&Math.hypot(a.x-b.x,a.z-b.z)>a.r+b.r)continue;
   const d=Math.hypot(a.x-b.x,a.z-b.z);
   if(d<(a.r+b.r)*0.92&&Math.abs(a.y-b.y)<14){
    if(a.veh&&a.vt==='fire'||b.veh&&b.vt==='fire'){if(a.veh&&b.veh)continue;}
    crash([a,b],'COLLISION between '+a.cs+' and '+b.cs+'.');return;
   }
  }
 }
}
function separation(){
 const L=G.ents.filter(e=>!e.dead&&!e.veh);
 for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){
  const a=L[i],b=L[j];const key=Math.min(a.id,b.id)+'_'+Math.max(a.id,b.id);if(G.pairs[key])continue;
  if(a.phase==='APPROACH'&&b.phase==='APPROACH'){
   const gap=Math.abs(a.D-b.D)/NM;const lead=a.D<b.D?a:b;const min=lead.heavy?4:3;
   if(gap<(lead.heavy?2.6:2.0)&&Math.max(a.D,b.D)>0){G.pairs[key]=1;incident('los','LOSS OF SEPARATION: '+a.cs+' / '+b.cs+' ('+gap.toFixed(1)+' nm on final, need '+min+')',10);}
  }else if(a.y>25&&b.y>25||(a.phase==='APPROACH'&&b.phase==='CLIMB')||(b.phase==='APPROACH'&&a.phase==='CLIMB')){
   if((a.phase==='CLIMB'||a.phase==='GOAROUND'||a.phase==='APPROACH')&&(b.phase==='CLIMB'||b.phase==='GOAROUND'||b.phase==='APPROACH')){
    const h=Math.hypot(a.x-b.x,a.z-b.z),vv=Math.abs(a.y-b.y);
    if(h<700&&vv<120){G.pairs[key]=1;incident('los','AIRPROX: '+a.cs+' and '+b.cs+' passed within '+Math.round(h)+' m',10);}
   }
  }
 }
}
