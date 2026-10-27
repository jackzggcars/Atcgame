'use strict';
/* =====================================================================
   VISITORS & EVENTS — helicopters and light aircraft asking to transit the zone, a military flypast
   (or a whole Airport Open Day), hijack (squawk 7500), medevac / VIP priority arrivals, weather diversions.
   ===================================================================== */
Object.assign(PH,{
 ZONE:{cat:'Visitor',title:'Zone transit request',unit:'TWR',patience:45,
  when:'A helicopter or light aircraft wants to cross the airfield zone.',
  pilot:['{unit}, {cs}, {what}, {dist} miles {from}, request zone transit {route}, {alt} feet.'],
  accept:'{cs}, cleared to transit the zone {route}, {alt} feet, remain clear of the runway and the approach, report clear.',
  rbAccept:'Cleared to transit the zone, {alt} feet, will report clear, {cs}.',
  deny:'{cs}, {unit}, unable, remain outside the zone.',rbDeny:'Remaining outside the zone, {cs}.',
  wait:'{cs}, {unit}, standby.',rbWait:'Standing by outside the zone, {cs}.',
  note:'Northern and southern routes stay clear of the runway. A crossing route cuts straight across the final approach: only approve it when nothing is on short final, or tell the aircraft to orbit.'},
 HIJACK:{cat:'Emergency',title:'HIJACK — squawk 7500',unit:'TWR',urgent:true,
  when:'An inbound flight squawks 7500: unlawful interference.',
  pilot:['{unit}, {cs}, {dist} miles final runway {rwy}, request priority landing, squawking seven five zero zero. We have a security situation on board, request police on arrival.'],
  accept:'{cs}, roger, runway {rwy}, wind {wdir} degrees {wspd} knots, cleared to land. Police and emergency services are standing by.',
  rbAccept:'Cleared to land runway {rwy}, thank you, {cs}.',
  deny:'{cs}, {unit}, unable.',rbDeny:'Say again? We must land immediately, {cs}.',
  wait:'{cs}, roger, standby.',rbWait:'Standing by, please be quick, {cs}.',
  note:'Give it priority and clear the runway. After vacating it stops where it is for about three minutes while police surround it, so keep that taxiway clear.'},
 PRIO:{cat:'Arrival',title:'Priority flight (medical / VIP)',unit:'TWR',patience:40,
  when:'A medevac or VIP flight asks for priority handling on the approach.',
  pilot:['{unit}, {cs}, {dist} miles final runway {rwy}, {what}, request priority handling.'],
  accept:'{cs}, roger, priority approved, continue approach, you are number one.',
  rbAccept:'Continuing approach, number one, {cs}.',
  deny:'{cs}, {unit}, unable priority, expect to follow traffic.',rbDeny:'Understood, {cs}.',
  wait:'{cs}, {unit}, standby.',rbWait:'Standing by, {cs}.',
  note:'Do not make it wait: a go-around or a delay costs points. Put it ahead of other arrivals.'},
 DIVERT:{cat:'Arrival',title:'Diversion — landing request',unit:'TWR',patience:40,
  when:'An aircraft diverts in because its destination airport is closed.',
  pilot:['{unit}, {cs}, diverting from {from}, {dist} miles final runway {rwy}, fuel is getting short, request priority approach.'],
  accept:'{cs}, roger, continue approach runway {rwy}, you are number one.',
  rbAccept:'Continuing approach, thank you, {cs}.',
  deny:'{cs}, {unit}, unable, expect delay.',rbDeny:'Say again? Our fuel is getting short, {cs}.',
  wait:'{cs}, {unit}, standby.',rbWait:'Standing by, but we are low on fuel, {cs}.',
  note:'Diversions arrive with little fuel. Keep delay to a minimum or they will declare a fuel emergency.'}
});
EMKEY.hijack='HIJACK';
const clkF=t=>{const s=Math.floor(G.clock-G.t+t)%86400;return String(Math.floor(s/3600)%24).padStart(2,'0')+String(Math.floor(s/60)%60).padStart(2,'0');};

/* ---------- wrappers over the core sim ---------- */
(function(){
 const _rq=request;request=function(a,kind,x){if(a&&a.sec&&G.t<a.sec)return;return _rq(a,kind,x);};
 const _ga=startGoAround;startGoAround=function(a,why){if(a)a.wasGA=true;return _ga(a,why);};
 const _td=touchdown;touchdown=function(a){
  _td(a);
  if(a.al&&a.al.icao==='RYR'&&a.phase==='ROLLOUT'){G.stats.ryr=(G.stats.ryr||0)+1;if(Math.random()<0.75)later(rnd(2.5,4.5),()=>{if(!a.dead)say('pilot',a,pick(["Er, tower, that landing was... intentional.","Sorry about that, tower, the runway arrived early.","Tower, the passengers are applauding. I think.","That one was brought to you by Ryanair, tower.","Tower, was that the runway or a trampoline?","Ryanair landing, tower. Hard, but it counts.","Down and safe, tower. Mostly down. Mostly safe."]),'');});}
  if(a.phase==='ROLLOUT'&&!a.veh&&a.tdHard!=null){const r=a.tdHard;if(r<0.07){G.stats.greasers=(G.stats.greasers||0)+1;G.score+=10;sysMsg(a.cs+': a perfect touchdown, barely felt it (+10).','ok');}else if(r>0.95){G.stats.thumps=(G.stats.thumps||0)+1;sysMsg(a.cs+': firm landing — passengers will remember that one.','warn');}}
  if(a.prio&&!a.paid){a.paid=true;
   if(a.wasGA){G.score=Math.max(0,G.score-12);sysMsg(a.cs+' ('+(a.prio==='medevac'?'medical':'VIP')+' flight) was sent around — delay (−12).','warn');}
   else{const b=Math.round(clamp(110-(a.waitSec||0)*1.5,30,110));G.score+=b;sysMsg(a.cs+' ('+(a.prio==='medevac'?'medical':'VIP')+' flight) landed without delay (+'+b+').','ok');}}
  if(a.divert&&!a.paid){a.paid=true;if(!a.wasGA){G.score+=50;sysMsg(a.cs+' (diversion from '+a.divert+') landed safely (+50).','ok');}}
 };
 const _hp=HANDLERS.holdpos;HANDLERS.holdpos=function(a,c){if(a.vis&&a.role!=='fly'&&a.y>5){return HANDLERS.transit(a,Object.assign({},c,{n:'orbit'}));}return _hp(a,c);};
})();

/* ---------- hijack / diversion ---------- */
function startHijack(a,D){
 a.emerg='hijack';a.squawk='7500';G.stats.emerg++;
 sysMsg(a.cs+' is squawking 7500 — unlawful interference (hijack). Give it priority and keep other traffic away from it.','warn');
 request(a,'HIJACK',{dist:Math.max(1,Math.round(D/NM))});
}
function startDivert(a,D){
 a.divert=pick(DESTS).n;a.fuel=rnd(13,17);
 request(a,'DIVERT',{dist:Math.max(1,Math.round(D/NM)),from:a.divert});
}
function divertWave(){
 const n=rint(2,3),from=pick(DESTS).n;
 sysMsg('Weather closure at '+from+': '+n+' diversions are inbound to us. Expect short-fuel calls.','warn');
 for(let i=0;i<n;i++)later(3+i*rnd(55,90),()=>{G.forceMishap='divert';if(!spawnArr())G.forceMishap=null;});
}
function specTick(a,dt){
 if(a.emerg==='hijack'&&a.phase==='VACATED'&&!a.secured){
  a.secured=true;a.req=null;a.nextReq=null;a.sec=G.t+170;
  say('pilot',a,'Vacated, holding position, '+csName(a)+'.','');
  sysMsg('Armed police are surrounding '+a.cs+'. It stays where it is for about 3 minutes — keep that taxiway clear.','warn');
 }
 if(a.sec&&G.t>=a.sec){a.sec=0;a.emerg=null;a.squawk='';G.score+=300;G.stats.hijack=(G.stats.hijack||0)+1;sysMsg(a.cs+': incident resolved, everyone is safe (+300).','ok');request(a,'VAC');}
}

/* ---------- visitors: helicopters and light aircraft ---------- */
function visInit(){
 const open=G.cfg.events!==false&&Math.random()<0.22;
 G.v={next:rnd(90,170),evNext:open?rnd(300,420):rnd(380,620),flyLeft:G.cfg.level==='cadet'?1:2,div:rnd(700,1100),open,msg:false,guest:false,guestT:rnd(70,140)};
}
function spawnVisitor(){
 if(G.ents.filter(e=>e.vis&&e.role!=='fly'&&!e.dead).length>=2)return null;
 const icao=(()=>{const L=[['POL',1],['HEM',1],['SKY',1.2],['FLY',2]];let t=0;L.forEach(x=>t+=x[1]);let r=Math.random()*t;for(const x of L){r-=x[1];if(r<=0)return x[0];}return'FLY';})(),al=AL_BY[icao],ty=TYPES[al.fleet[0]];
 const a=mkAc('vis',al,ty);a.vis=true;a.kind='vis';a.role=al.role;a.hidden=false;
 const heli=!!ty.heli,alt=heli?150:230,vc=heli?44:54,om=heli?0.085:0.07;
 const rt=Math.random(),R=a.role==='medevac'?(rt<0.7?'X':'N'):rt<0.38?'X':rt<0.7?'N':'S',rev=Math.random()<0.5?-1:1;
 const x0=-dirOf()*(AP.half+2.2*NM);let P,label;
 if(R==='X'){P=[{x:x0,z:-rev*6200},{x:x0,z:rev*6200}];label=(rev>0?'southbound':'northbound')+', crossing the final approach';}
 else{const z=R==='N'?-1900:1900;P=[{x:-rev*9500,z},{x:rev*9500,z}];label=(rev>0?'eastbound':'westbound')+' via the '+(R==='N'?'northern':'southern')+' route';}
 const hv={x:P[0].x+(P[0].x-P[1].x)*0.09,z:P[0].z+(P[0].z-P[1].z)*0.09};
 const ph=rnd(0,6.28),r=vc/om;
 a.x=hv.x+Math.cos(ph)*r;a.z=hv.z+Math.sin(ph)*r;a.th=ph+Math.PI/2;a.y=alt;a.v=vc;a.vc=vc;a.om=om;a.alt=alt;a.route=P;a.rlabel=label;a.rkind=R;
 a.phase='VHOLD';a.pitch=0;a.bank=0;a.fuel=99;a.cleared=false;a.sqPlan=null;a.hp=null;a.gate=null;
 a.squawk='7000';
 const what=a.role==='police'?'police helicopter':a.role==='medevac'?'air ambulance helicopter, medical priority':a.role==='tour'?'tour helicopter':'Cessna one seven two';
 const dist=Math.max(3,Math.round(Math.hypot(a.x,a.z)/NM));
 G.ents.push(a);emit('spawn',a);
 later(rnd(3,7),()=>{if(!a.dead)request(a,'ZONE',{what,dist,from:compassOf(a.x,a.z),route:label,alt:Math.round(alt*3.281/50)*50});});
 return a;
}
function visTick(a,dt){
 if(a.dead)return true;
 if(a.phase==='FLYPAST'){flyMove(a,dt);return true;}
 const th0=a.th;
 if(a.phase==='VHOLD'){a.th+=a.om*dt;if(a.role==='medevac'&&a.req&&!a.warned&&G.t-a.req.t>55){a.warned=true;G.score=Math.max(0,G.score-5);sysMsg(a.cs+' (air ambulance) is being kept waiting (−5).','warn');}}
 else{
  const w=a.wp&&a.wp[a.wi];
  if(w){const dx=w.x-a.x,dz=w.z-a.z;a.th=turnTo(a.th,Math.atan2(dz,dx),a.type.heli?0.55:0.38,dt);if(Math.hypot(dx,dz)<260){a.wi++;if(a.wi>=a.wp.length){a.wp=null;if(a.phase==='TRANSIT'){a.phase='VLEAVE';a.done=true;G.score+=15+(a.role==='medevac'?25:0);G.stats.transits=(G.stats.transits||0)+1;say('pilot',a,'Clear of the zone, '+csName(a)+', changing to my own frequency. Good day.','');}}}}
 }
 a.x+=Math.cos(a.th)*a.v*dt;a.z+=Math.sin(a.th)*a.v*dt;a.y=lerp(a.y,a.alt,Math.min(1,dt*0.5));
 const dth=angDiff(a.th,th0)/Math.max(dt,1e-3);a.bank=lerp(a.bank||0,clamp(dth*a.v/9.81,-0.5,0.5),Math.min(1,dt*2));
 if(a.phase==='VLEAVE'&&!a.wp&&(Math.abs(a.x)>16000||Math.abs(a.z)>16000))a.dead=true;
 // separation against arrivals / departures
 for(const e of G.ents){
  if(e===a||e.dead||e.veh||e.vis||!['APPROACH','GOAROUND','CLIMB'].includes(e.phase))continue;
  const h=Math.hypot(a.x-e.x,a.z-e.z),vv=Math.abs(a.y-e.y);
  if(h<650&&vv<110){const key='v'+Math.min(a.id,e.id)+'_'+Math.max(a.id,e.id);if(G.pairs[key])continue;G.pairs[key]=1;
   if(e.phase==='APPROACH'&&e.D>0&&e.D<4.2*NM)startGoAround(e,'traffic crossing the approach');
   incident('los','AIRPROX: '+a.cs+' ('+(a.type.heli?'helicopter':'light aircraft')+') and '+e.cs+' passed within '+Math.round(h)+' m',8);}
 }
 return true;
}
HANDLERS.transit=function(a,c){
 if(!a.vis||a.role==='fly'){sayAgain(a);return;}
 const rq=a.req&&a.req.kind==='ZONE'?a.req:null,m=c.n||'';
 if(/\b(orbit|hold)\b/.test(m)&&!c.deny){if(a.phase==='TRANSIT'){a.phase='VHOLD';a.wp=null;pilotReply(a,'Orbiting, '+csName(a)+'.');}else pilotReply(a,'Holding outside the zone, '+csName(a)+'.');return;}
 if(c.deny||c.neg){
  if(rq){const x=rq.x;a.req=null;pilotReply(a,fmt(PH.ZONE.rbDeny,V(a)));a.denied=(a.denied||0)+1;
   if(a.denied>=2){later(8,()=>{if(a.dead)return;a.phase='VLEAVE';a.wp=[{x:a.x*4,z:a.z*4}];a.wi=0;a.alt=a.alt+60;say('pilot',a,'Roger, we will route around the zone. Good day, '+csName(a)+'.','');});}
   else a.nextReq={kind:'ZONE',at:G.t+rnd(40,65),x};}
  else if(a.phase==='TRANSIT'){a.phase='VHOLD';a.wp=null;pilotReply(a,'Orbiting outside, '+csName(a)+'.');}
  return;}
 if(c.wait){if(rq)handleWait(a);return;}
 if(rq||(a.phase==='VHOLD'&&a.cleared)){
  const x=rq?rq.x:{};a.req=null;a.nextReq=null;a.cleared=true;readback(a,'ZONE','Accept',{alt:x.alt||Math.round(a.alt*3.281/50)*50,route:a.rlabel});
  later(rnd(2.5,4),()=>{if(a.dead)return;a.phase='TRANSIT';a.wp=a.wp&&a.wi<a.wp.length?a.wp:a.route.slice();a.wi=0;});
  return;}
 pilotReply(a,'Say again, '+csName(a)+'?');
};

/* ---------- military flypast / airport open day ---------- */
function flyAnnounce(){
 const t0=G.t+rnd(250,290),open=G.v.open;
 G.fly={t0,state:'ann',dir:dirOf(),abort:false,ok:false,v:125};
 sysMsg((open?'AIRPORT OPEN DAY: ':'NOTAM: ')+'military flypast along runway '+RWD()+' at '+clkF(t0)+'Z. The runway is closed to all movements from '+clkF(t0-45)+'Z to '+clkF(t0+40)+'Z — hold departures, keep arrivals off final.','warn');
}
function flyUpdate(dt){
 const f=G.fly;if(!f)return;
 if(f.state==='ann'&&G.t>=f.t0-75){
  f.state='run';f.ents=[];const al=AL_BY.DSP,ty=TYPES.F14,off=[[0,0],[48,-34],[48,34]];
  for(let k=0;k<3;k++){const a=mkAc('vis',al,ty);a.num=String(k+1);a.cs='DSP'+a.num;a.rt='Display '+a.num;a.heavy=false;a.vis=true;a.kind='vis';a.role='fly';a.hidden=true;a.phase='FLYPAST';a.offA=off[k][0];a.offZ=off[k][1];a.v=f.v;a.y=48;a.pitch=0;a.bank=0;a.squawk='';a.th=f.dir>0?0:Math.PI;a.x=-f.dir*9400;a.z=off[k][1];G.ents.push(a);emit('spawn',a);f.ents.push(a);}
 }
 if(f.state==='run'){
  if(!f.closed&&G.t>=f.t0-45){f.closed=true;sysMsg('Runway '+RWD()+' is now closed for the flypast.','warn');
   for(const e of G.ents)if(!e.dead&&!e.vis&&e.phase==='APPROACH'&&e.D>0&&e.D<3.4*NM)startGoAround(e,'flypast in progress');}
  if(!f.checked&&G.t>=f.t0-12){f.checked=true;
   const occ=rwyOccupied(null),fin=G.ents.find(e=>!e.dead&&!e.vis&&e.phase==='APPROACH'&&e.D>0&&e.D<2.6*NM);
   if(occ||fin){f.abort=true;f.abortT=G.t;G.safety=Math.max(0,G.safety-3);incident('flypast','FLYPAST ABORTED: '+((occ||fin).cs)+' was on the runway / final at display time',8);say('pilot',f.ents[0],'Display lead, breaking off, runway not clear.','urgent');}}
  if(!f.ok&&!f.abort&&G.t>=f.t0+25){f.ok=true;G.score+=80;sysMsg('The flypast passed over a clear runway — crowds are delighted (+80).','ok');}
  if(f.ents.every(e=>e.dead)||G.t>f.t0+140){G.fly=null;}
 }
}
function flyMove(a,dt){
 const f=G.fly;if(!f){a.dead=true;return;}
 const s=f.v*(G.t-f.t0),d=s*f.dir;
 a.x=f.dir*s-f.dir*a.offA;a.z=a.offZ;a.th=f.dir>0?0:Math.PI;a.v=f.v;
 let y=48+(a.id%3)*2;if(s>1800)y+=Math.min(750,(s-1800)*0.3);
 if(f.abort)y=Math.max(y,lerp(48,420,clamp((G.t-f.abortT)/12,0,1)));
 const vy=(y-a.y)/Math.max(dt,1e-3);a.y=lerp(a.y,y,Math.min(1,dt*3));a.pitch=lerp(a.pitch,clamp(vy/130,-0.1,0.4),Math.min(1,dt));
 if(s>13000)a.dead=true;
}

function visUpdate(dt){
 if(G.over)return;if(!G.v)visInit();const v=G.v,c=G.cfg;
 if(c.visitors!==false&&G.t>v.next){v.next=G.t+(v.open?rnd(100,180):rnd(240,460));spawnVisitor();}
 if(c.events===false)return;
 if(v.open&&!v.msg&&G.t>8){v.msg=true;sysMsg('AIRPORT OPEN DAY today: expect extra helicopters and light aircraft, a special-livery guest arrival and a military flypast.','ok');}
 if(!G.fly&&v.flyLeft>0&&G.t>v.evNext){v.flyLeft--;v.evNext=G.t+rnd(900,1300);flyAnnounce();}
 wildUpdate(dt);
 flyUpdate(dt);
 if(c.divert!==false&&G.t>v.div){v.div=G.t+rnd(840,1300);divertWave();}
 if(v.open&&!v.guest&&G.t>v.guestT){G.forceSpec='openday';const ok=spawnArr();G.forceSpec=null;if(ok)v.guest=true;else v.guestT=G.t+20;}
}

/* ---------- wildlife on the runway ---------- */
function wildUpdate(dt){
 const v=G.v;if(v.wild==null)v.wild=rnd(520,980);
 if(G.t<v.wild||G.flags.debris||G.ents.some(e=>e.veh&&e.vt==='ops'&&!e.dead))return;
 if(rwyOccupied(null)||G.ents.some(e=>!e.dead&&['ROLL','ROLLOUT','RTO'].includes(e.phase)))return;
 v.wild=G.t+rnd(900,1500);
 const an=pickW([['a fox',3],['a flock of geese',3],['a deer',1.2],['a heron',1],['a pair of swans',1]]);
 G.flags.debris=true;G.stats.wildlife=(G.stats.wildlife||0)+1;
 sysMsg('WILDLIFE: '+an+' has been spotted on runway '+RWD()+'. Operations 1 is being sent for an inspection — expect a short closure.','warn');
 spawnOps(true);
}

/* ---------- courtesies: pilots react to pleasantries ---------- */
const PLACE_ALIAS={KJFK:['jfk','j f k','kennedy','john f kennedy'],EGLL:['lhr','heathrow'],KLAX:['lax'],EGKK:['lgw','gatwick'],LFPG:['cdg','charles de gaulle'],EHAM:['schiphol','amsterdam'],EDDF:['frankfurt','fra'],OMDB:['dubai','dxb'],KATL:['atlanta','hartsfield'],KORD:['ohare',"o hare",'chicago']};
function placeMention(raw){
 const t=' '+raw.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ')+' ';const tight=t.replace(/ /g,'');
 const hit=(w)=>w.length<=3?t.includes(' '+w+' '):t.includes(' '+w+' ')||(w.includes(' ')&&t.includes(w));
 let found=null;
 const consider=(code,list)=>{if(found)return;for(const w of list){if(w&&(hit(w)||(w.length>=3&&!w.includes(' ')&&false))){found=code;return;}}if(code==='KJFK'&&/ ?j ?f ?k ?/.test(t)&&/ j f k |jfk/.test(t+tight))found=code;};
 const ap=AIRPORTS||{};for(const k in ap){const A=ap[k];consider(k,[A.short&&A.short.toLowerCase(),A.city&&A.city.toLowerCase(),A.icao.toLowerCase()].concat(PLACE_ALIAS[k]||[]));}
 if(!found)for(const d of DESTS){const n=d.n.toLowerCase();if(hit(n)||hit(d.c.toLowerCase())){found='D:'+d.n;break;}}
 if(!found)return null;
 if(found[0]==='D'&&found[1]===':')return{label:found.slice(2),here:false};
 const A=ap[found];return{label:A.short||A.city||found,here:found===AIRPORT.icao};
}
function courtesyKind(c){
 const m=c.n,raw=c.raw.toLowerCase();
 if(/\b(merry christmas|happy (new year|christmas|holidays|easter|halloween|birthday))\b/.test(raw))return'season';
 if(/\bwelcome( back)? (to|at|in)\b|\bwelcome\b/.test(m))return'welcome';
 if(/(nice|great|good|smooth|beautiful|lovely|excellent|perfect|fine) (landing|job|flying|approach|work|touchdown)|well done|nicely done|good one|impressive|greaser|butter/.test(raw))return'praise';
 if(/(have a|enjoy your|enjoy the|safe|pleasant|good|nice|great) (flight|trip|journey|day|evening|night|weekend|stay|one)|safe travels|farewell|see you|take care|bye|goodbye|good night|good day|all the best|until next time|fly safe/.test(m))return'bye';
 if(/\b(thanks|thank you|cheers|appreciate|much obliged)\b/.test(m)&&!c.intent)return'thanks';
 if(/\b(sorry|apologies|apologize)\b/.test(m))return'sorry';
 if(/how are you|how'?s it going|how is it going|how was the flight|how was your flight/.test(raw))return'how';
 if(/\bgood (morning|afternoon|evening)\b|\bhello\b|\bhi there\b|\bhey\b/.test(m)&&!c.intent&&!c.wait&&!c.deny)return'greet';
 return null;
}
function courtesyReply(a,c,kind,after){
 const arr=a.kind==='arr',tw=(UNITS[a.unit]||UNITS.TWR).n,cs=csName(a),here=AIRPORT.short;
 const pl=placeMention(c.raw);G.stats.courtesy=(G.stats.courtesy||0)+1;
 const R={
  welcome:()=>{
   if(pl&&!pl.here)return pick([`Ha, ${tw}, we're at ${here} today, not ${pl.label}, but thanks all the same, ${cs}!`,`Er, ${tw}, I think we're in ${here}, not ${pl.label}. Thanks for the welcome though, ${cs}.`,`${tw}, ${cs}, nice try, this is ${here}, but we appreciate it!`]);
   if(pl&&pl.here&&arr)return pick([`Thank you, ${tw}, great to be at ${pl.label}, ${cs}!`,`Cheers, ${tw}! Always a pleasure coming into ${pl.label}, ${cs}.`,`Much appreciated, ${tw}, it's good to be back at ${pl.label}, ${cs}.`]);
   if(arr)return pick([`Thank you, ${tw}, good to be here, ${cs}.`,`Cheers, ${tw}, glad to be on the ground, ${cs}.`,`Thanks for the welcome, ${tw}, ${cs}.`]);
   return pick([`Thanks, ${tw}, though we're just leaving, ${cs}!`,`Ha, thank you ${tw}, ${cs}. We'll be back.`]);},
  bye:()=>pick(a.kind==='dep'?[`Thank you, ${tw}, good day, ${cs}.`,`Cheers, ${tw}, see you next time, ${cs}!`,`Thanks ${tw}, you have a good one too, ${cs}.`,`Appreciate it, ${tw}, take care, ${cs}.`]:[`Thanks, ${tw}, you too, ${cs}.`,`Cheers, ${tw}, have a good shift, ${cs}.`,`Thank you, ${tw}, good day, ${cs}.`]),
  thanks:()=>pick([`You're welcome, ${tw}, ${cs}.`,`No problem, ${tw}, ${cs}.`,`Any time, ${tw}, ${cs}.`,`Our pleasure, ${cs}.`]),
  sorry:()=>pick([`No problem at all, ${tw}, ${cs}.`,`Don't worry about it, ${tw}, ${cs}.`,`All good, ${tw}, ${cs}.`,`No worries, ${cs}.`]),
  how:()=>pick([`Doing well, thanks ${tw}, ${cs}. Smooth ride today.`,`Can't complain, ${tw}, ${cs}. Coffee's still warm in the cockpit.`,`All good here, ${tw}, thanks for asking, ${cs}.`,`Very well, thank you, ${cs}. Passengers are happy.`]),
  greet:()=>pick([`Good day, ${tw}, ${cs}.`,`Hello, ${tw}, ${cs}.`,`Hi ${tw}, ${cs}, how are you?`,`Morning, ${tw}, ${cs}.`]),
  season:()=>{const t=c.raw.toLowerCase();const w=/christmas/.test(t)?'Merry Christmas':/new year/.test(t)?'Happy New Year':/halloween/.test(t)?'Happy Halloween':/easter/.test(t)?'Happy Easter':/birthday/.test(t)?'Thank you, that is kind':'Happy holidays';return `${w} to you too, ${tw}, from all of us on ${cs}!`;},
  praise:()=>{const r=a.tdHard;if(a.phase==='ROLLOUT'||a.phase==='VACATED'||a.tdT!=null){if(r!=null&&r<0.3)return pick([`Thank you, ${tw}! Hope the passengers noticed, ${cs}.`,`Ha, thanks ${tw}, that was a good one, ${cs}.`,`Cheers, ${tw}, I'll take it, ${cs}.`]);if(r!=null&&r>0.8)return pick([`Ha, you're too kind, ${tw}, that one was a bit firm, ${cs}.`,`Thanks ${tw}, we'll blame the wind, ${cs}.`]);}
   return pick([`Thanks, ${tw}, appreciate it, ${cs}.`,`Cheers, ${tw}, ${cs}.`,`Kind of you to say, ${tw}, ${cs}.`]);}
 };
 const txt=(R[kind]||R.thanks)();
 later(after?rnd(4.5,7):rnd(1.4,2.6),()=>{if(!a.dead)say('pilot',a,txt,'');});
}
