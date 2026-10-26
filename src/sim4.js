'use strict';
/* =====================================================================
   REALISM LAYER — drifting thunderstorm cells, crosswind crab, low-visibility procedures,
   wake-turbulence encounters, departure slot times, bird-strike go-arounds, late fuel declarations.
   ===================================================================== */
const COMPASS8=['north','north-east','east','south-east','south','south-west','west','north-west'];
function compassOf(dx,dz){const b=(Math.atan2(dx,-dz)*180/Math.PI+360)%360;return COMPASS8[Math.round(b/45)%8];}

/* ---------- thunderstorm cells ---------- */
function cellUpdate(dt){
 if(G.cellNext===undefined){G.cellNext=G.cfg.cells===false?1e9:(G.wx==='storm'?90:G.wx==='rain'?260:G.cfg.level==='trainee'?1e9:rnd(420,900));G.cell=null;}
 let c=G.cell;
 if(!c&&G.t>=G.cellNext){
  const w=G.wind,to=(w.dir+180)*D2R,ux=Math.sin(to),uz=-Math.cos(to);   // unit vector the wind blows towards (x east, z south)
  const sp=clamp(w.spd*KT*1.8,7,13),r=rnd(1300,2100),off=(Math.random()<0.6?rnd(-600,600):rnd(-3200,3200));
  const px=-uz,pz=ux;                                  // perpendicular
  c=G.cell={x:-ux*9500+px*off,z:-uz*9500+pz*off,vx:ux*sp,vz:uz*sp,r,age:0,hot:0,warned:false,near:false,over:false};
  G.stats.cells=(G.stats.cells||0)+1;
  sysMsg('Weather radar: thunderstorm cell approaching from the '+compassOf(-ux,-uz)+' ('+Math.round(sp*1.94)+' kt). Expect gusts, lightning, and go-arounds if it crosses the approach.','warn');
  emit('cell',c);
 }
 if(!c)return;
 c.age+=dt;c.x+=c.vx*dt;c.z+=c.vz*dt;
 const d=Math.hypot(c.x,c.z);
 c.near=d<c.r+2800;c.over=d<c.r*0.9;
 G.cellGust=c.over?15:d<c.r+1500?7:0;
 const wasRamp=G.rampClosed;G.rampClosed=c.near;
 if(c.near&&!wasRamp)sysMsg('Lightning within 5 nm: ramp closed — boarding and ground services suspended.','warn');
 if(!c.near&&wasRamp&&d>c.r+2800)sysMsg('Lightning has moved away: ramp reopened.','ok');
 // arrivals whose final approach runs through the cell
 for(const a of G.ents){
  if(a.dead||a.phase!=='APPROACH'||a.D<-250)continue;
  const dd=Math.hypot(a.x-c.x,a.z-c.z),Dnm=a.D/NM;
  if(!a.cellWarn&&Dnm<9.5&&dd<c.r*1.15+1200){a.cellWarn=true;say('pilot',a,fmt('Tower, {cs}, weather radar shows heavy returns ahead on the approach. We may have to go around.',V(a)),'');}
  if(!a.cellGA&&a.D>0&&Dnm<1.6&&dd<c.r*0.95){a.cellGA=true;if(Math.random()<0.85){startGoAround(a,'storm cell on final');}}
 }
 // departures lined up inside the storm get hit by windshear
 for(const a of G.ents){
  if(a.dead||a.phase!=='ROLL'||a.windshear||!c.over)continue;
  if(a.v>25&&Math.random()<0.02){a.windshear=true;say('pilot',a,'Windshear, windshear! Stopping, stopping, '+csName(a)+'!','urgent');a.phase='RTO';}
 }
 if(d>c.r+14000&&c.age>300){G.cell=null;G.cellNext=G.t+rnd(900,1500);G.cellGust=0;G.rampClosed=false;sysMsg('The storm cell has passed.','ok');emit('cell',null);}
}

/* ---------- crosswind crab (nose points into the wind on final, kicked straight at touchdown) ---------- */
function crabTh(a,th0){
 const w=G.wind;if(!w||!a.type)return th0;
 const wz=w.spd*KT*Math.cos(w.dir*D2R);                 // wind component along +z (blowing south positive)
 const vapp=Math.max(55,a.v||70);
 const s=clamp(-wz/vapp,-0.5,0.5)*clamp((a.y-3)/10,0,1);
 return Math.atan2(s,Math.cos(th0)*Math.sqrt(1-s*s));
}

/* ---------- wake turbulence ---------- */
function wakeUpdate(dt){
 for(const a of G.ents){if(a.wakeT>0)a.wakeT-=dt;}
 const L=G.ents.filter(e=>!e.dead&&!e.veh&&e.phase==='APPROACH'&&e.D>0).sort((p,q)=>p.D-q.D);
 for(let i=0;i<L.length-1;i++){
  const lead=L[i],tr=L[i+1],gap=(tr.D-lead.D)/NM;
  if(lead.type.wake==='H'&&tr.type.wake!=='H'&&gap<3.6&&!tr.wakeHit&&tr.D<5.5*NM){
   tr.wakeHit=true;tr.wakeT=9;
   const sev=gap<2.6?0.7:0.35;
   if(Math.random()<sev+0.1){
    say('pilot',tr,fmt('Wake turbulence! {cs} is encountering the wake of the heavy ahead.',V(tr)),'urgent');
    sysMsg(tr.cs+' hit the wake of '+lead.cs+' ('+gap.toFixed(1)+' nm spacing, heavy needs 4+).','warn');
    G.stats.wake=(G.stats.wake||0)+1;
    if(gap<2.8&&Math.random()<0.55)startGoAround(tr,'wake turbulence');
    if(gap<2.2)incident('wake','WAKE ENCOUNTER: '+tr.cs+' behind '+lead.cs+' at '+gap.toFixed(1)+' nm',4);
   }
  }
 }
 // in-flight lead aircraft shed wake energy visually; handled in fx3d via type.wake
}

/* ---------- departure slots ---------- */
function assignSlot(a){
 if(Math.random()>0.38)return;
 const base=G.t+(a.boardTime||40)+rnd(150,330);
 a.slot={t:base,open:-300,close:600};
}
function checkSlot(a){
 if(!a.slot)return;const dt=G.t-a.slot.t;
 if(dt<a.slot.open){G.score=Math.max(0,G.score-5);sysMsg(a.cs+' departed '+Math.round(-dt/60)+' min before its slot time — flow control not happy (−5).','warn');}
 else if(dt>a.slot.close){G.score=Math.max(0,G.score-8);G.stats.delay+=2;sysMsg(a.cs+' missed its departure slot by '+Math.round((dt-a.slot.close)/60)+' min — the airline loses the slot (−8).','warn');}
 else{G.score+=10;sysMsg(a.cs+' departed inside its slot window (+10).','ok');}
 a.slotDone=true;
}
function slotText(a){
 if(!a.slot)return '';
 const c=G.clock-G.t;const f=t=>{const s=Math.floor(c+t)%86400;return String(Math.floor(s/3600)%24).padStart(2,'0')+String(Math.floor(s/60)%60).padStart(2,'0');};
 return 'SLOT '+f(a.slot.t)+'Z  ('+f(a.slot.t+a.slot.open)+'–'+f(a.slot.t+a.slot.close)+')';
}

/* ---------- new arrival problems ---------- */
function arrivalProblem(a,Dnm){
 if(a.mishap==='bstrike'&&a.D>0&&Dnm<2.4){
  a.mishap=null;G.flags.debris=true;a.emerg=null;
  say('pilot',a,'Bird strike! Bird strike on short final — going around, '+csName(a)+'.','urgent');
  sysMsg(a.cs+' hit birds on final: runway inspection needed.','warn');
  startGoAround(a,'bird strike');later(25,()=>spawnOps(true));return true;
 }
 if(a.mishap==='fuelhid'&&!a.fuelCalled&&Dnm<5.6){
  a.fuelCalled=true;a.mishap=null;a.emerg='fuel';a.squawk='7700';G.stats.emerg++;
  request(a,'LOWFUEL',{dist:Math.max(1,Math.round(Dnm))});return true;
 }
 return false;
}
