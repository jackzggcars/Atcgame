'use strict';
/* =====================================================================
   COMMS — parser for what the player says/types, handlers, readbacks, read-back errors
   ===================================================================== */
const NUMW={zero:0,oh:0,one:1,two:2,three:3,tree:3,four:4,fower:4,five:5,fife:5,six:6,seven:7,eight:8,nine:9,niner:9};
let _VOC=null;
function vocab(){
 if(_VOC)return _VOC;
 const w=('runway holding point takeoff take off cleared squawk departure ground tower approach delivery contact pushback push back push start taxi hold short position vacate inspection '+
  'continue landing land around going standby stand by negative unable immediately knots speed reduce increase maintain stop charlie bravo delta echo alpha via wait line up and '+
  'roger wilco affirm clearance radio check emergency services priority mayday pan disregard correction again approved denied cannot call wind information marlow degrees heading '+
  'zero one two three tree four fower five fife six seven eight niner nine operations ops onto inspect there stay not left right straight initial climb altitude feet the for to on at').split(' ');
 const add=t=>String(t).toLowerCase().split(/[^a-z]+/).filter(x=>x.length>2).forEach(x=>w.push(x));
 try{AIRLINES.forEach(a=>{add(a.rt);add(a.icao);});}catch(e){}
 try{DESTS.forEach(d=>{add(d.n);add(d.c);});}catch(e){}
 try{Object.values(UNITS).forEach(u=>add(u.n));}catch(e){}
 _VOC=new Set(w);return _VOC;
}
function lev(a,b,max){
 if(Math.abs(a.length-b.length)>max)return 99;
 let p=[];for(let j=0;j<=b.length;j++)p[j]=j;
 for(let i=1;i<=a.length;i++){const c=[i];let m=i;for(let j=1;j<=b.length;j++){c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));if(c[j]<m)m=c[j];}if(m>max)return 99;p=c;}
 return p[b.length];
}
/* Like a real controller/pilot: forgive near-misses ("tower"/"power", "to"/"two", "for"/"four") */
function fuzzWord(t){
 if(t.length<4||/\d/.test(t))return t;
 const V=vocab();if(V.has(t))return t;
 const max=t.length>=8?2:1;let best=null,bd=99,tie=false;
 for(const v of V){if(v.length<4)continue;const d=lev(t,v,max);if(d<bd){bd=d;best=v;tie=false;}else if(d===bd&&d<99)tie=true;}
 return(best&&bd<=max&&!tie)?best:t;
}
function normText(s){
 s=s.toLowerCase().replace(/[,.;:!?()"]/g,' ').replace(/-/g,' ').replace(/\b(uh|um|er|erm|ah|please)\b/g,' ');
 s=s.replace(/\bair france\b/g,'airfrance').replace(/\bwinds?\b/g,'wind').replace(/\bnine er\b/g,'niner').replace(/\bstand by\b/g,'standby');
 s=s.replace(/\b(won|wan)\b/g,'one').replace(/\b(free|tray)\b/g,'three').replace(/\b(ate)\b/g,'eight').replace(/\b(fore|fo)\b/g,'four').replace(/\b(sicks|sics)\b/g,'six').replace(/\b(nein|nina|niner)\b/g,'nine').replace(/\bheaven\b/g,'seven').replace(/\bweight\b/g,'wait').replace(/\b(squat|squad|squash|squark|squack|squaw|swat|squirt|scwak|scrawl|squall)\b/g,'squawk').replace(/\bclear (to|for)\b/g,'cleared $1').replace(/\bq\s*(and|n|in|an)\s*h\b/g,'qnh').replace(/\bqueue\s*(and|n)\s*h\b/g,'qnh').replace(/\bclient\b/g,'climb').replace(/\bsquawk (to|too) (?=\d)/g,'squawk ').replace(/\bsquark|squack|squach|scott\b/g,'squawk');
 s=s.replace(/\bthe\s+(point|runway)\b/g,'$1').replace(/\bwrong way\b/g,'runway');
 let t=s.split(/\s+/).filter(Boolean).map(fuzzWord);
 const numish=x=>x&&(/^\d+$/.test(x)||/^(zero|oh|one|two|three|tree|four|fower|five|fife|six|seven|eight|niner|nine)$/.test(x));
 const stop=/^(squawk|climb|descend|maintain|cleared|taxi|contact|go|via|hold|holding|reduce|increase|speed|vacate|continue|line|lineup|up|push|pushback|proceed|back|expect)$/;
 for(let i=0;i<t.length;i++){
  const prev=t[i-1],next=t[i+1];
  if(/^(to|too|tu)$/.test(t[i])&&(numish(next)||(numish(prev)&&!stop.test(prev)&&next===undefined))&&!stop.test(prev||''))t[i]='two';
  else if(/^(for|fore)$/.test(t[i])&&(numish(next)||numish(prev))&&!stop.test(prev||'')&&!/^cleared$/.test(prev||''))t[i]='four';
 }
 s=t.join(' ');
 s=s.replace(/\b(zero|oh|one|two|three|tree|four|fower|five|fife|six|seven|eight|niner|nine)\b/g,m=>NUMW[m]);
 s=s.replace(/(\d)\s+(?=\d)/g,'$1').replace(/\s+/g,' ').trim();
 return s;
}
function findCallsign(n){
 for(const al of AIRLINES){
  const nm=al.rt.toLowerCase();
  let m=n.match(new RegExp('\\b'+nm+' ?(\\d{1,4})\\b'));if(m)return{rt:al.rt,num:m[1]};
  m=n.match(new RegExp('\\b'+al.icao.toLowerCase()+' ?(\\d{1,4})\\b'));if(m)return{rt:al.rt,num:m[1]};
 }
 const mo=n.match(/\b(operations|ops) ?(\d)\b/);if(mo)return{rt:'Operations',num:mo[2]};
 return null;
}
function matchAcft(cs){
 return G.ents.find(e=>!e.dead&&(e.veh?(cs.rt==='Operations'&&e.vt==='ops'):(e.al&&e.al.rt===cs.rt&&e.num===cs.num)))
  ||G.ents.find(e=>!e.dead&&!e.veh&&e.al&&e.al.rt===cs.rt&&(e.num.endsWith(cs.num)||cs.num.endsWith(e.num)))||null;
}
function parseCmd(text,selId){
 const raw=text.trim(),n=normText(raw);
 const c={raw,n,intent:null,deny:false,wait:false,neg:false,acft:null};
 const cs=findCallsign(n);if(cs)c.acft=matchAcft(cs);
 if(!c.acft&&selId)c.acft=G.ents.find(e=>e.id===selId&&!e.dead)||null;
 const m=n.replace('line up and wait','lineup').replace('lineup and wait','lineup');
 c.neg=/\b(negative|correction|i say again|disregard)\b/.test(m);
 c.deny=/\b(unable|not approved|denied|call again|cannot)\b/.test(m);
 c.wait=/\b(standby|stand by|wait|roger standby)\b/.test(m);
 const rw=m.match(/runway (\d{1,2})\s*(left|right|centre|center|l|r|c)?\b/);if(rw){const dd=rw[1].padStart(2,'0'),ll=rw[2]?({left:'L',right:'R',centre:'C',center:'C'}[rw[2]]||rw[2].toUpperCase()):'';const full=dd+ll;c.rwy='ZZ';for(const k of ['09','27'])if(RWL[k]===full||(!ll&&RWL[k].slice(0,2)===dd))c.rwy=k;}
 let sq=m.match(/squawk (\d{4})/);if(sq)c.squawk=sq[1];
 else if(/cleared to \w+/.test(m)){const f=[...m.matchAll(/\b([0-7]{4})\b(?! ?(feet|ft))/g)].map(x=>x[1]).filter(x=>!m.includes('qnh '+x)&&!m.includes('runway '+x));if(f.length&&!/\b(qnh)\s*$/.test(m))c.squawk=f[0];}
 const hp=m.match(/holding point (bravo|charlie|delta|echo)/);if(hp)c.hp=hp[1][0].toUpperCase();
 const st=m.match(/stand (\d)/);if(st)c.stand=st[1];
 const sp=m.match(/(\d{2,3}) knots/);if(sp)c.spd=+sp[1];
 const un=m.match(/contact (departure|ground|tower|approach|delivery)/);if(un)c.unit=un[1];
 for(const d of DESTS)if(m.includes(d.n.toLowerCase())||m.includes(d.c.toLowerCase()))c.destObj=d;
 let i=null;
 if(/go around|going around/.test(m))i='goaround';
 else if(/\btransit\b|remain outside|\bzone\b|\borbit\b/.test(m))i='transit';
 else if(/cleared (for |to )?(immediate )?(take ?off|departure)|cleared take ?off/.test(m))i='takeoff';
 else if(/\blineup\b|\bline up\b/.test(m))i='lineup';
 else if(/cleared (to |for )?land|cleared for landing|land runway/.test(m))i='land';
 else if(/continue approach/.test(m))i='contapp';
 else if(/(reduce|increase|maintain).*(speed|knots)|speed.*knots/.test(m)&&!/wind/.test(m))i='speed';
 else if(un)i='handoff';
 else if(/pushback|push and start|push back/.test(m))i='pushback';
 else if(/stop immediately|stop stop|^stop\b/.test(m))i='stop';
 else if(/hold position|hold there|stay there/.test(m))i='holdpos';
 else if(/\btaxi\b/.test(m))i='taxi';
 else if(/cleared to \w+/.test(m)&&(c.destObj||/\bvia\b|squawk/.test(m)))i='clearance';
 else if(/clearance/.test(m)&&(c.deny||c.wait))i='clearance';
 else if(/hold short/.test(m))i='holdshort';
 else if(/inspection|cleared onto runway/.test(m))i='inspect';
 else if(/vacate/.test(m))i='vacate';
 else if(/\bcontinue\b/.test(m))i='continue';
 else if(/squawk/.test(m))i='squawk';
 else if(/radio check/.test(m))i='radiocheck';
 else if(/\b(roger|wilco|affirm|emergency services|priority|pan pan|mayday)\b/.test(m))i='roger';
 c.intent=i;return c;
}

function command(text,selId){
 if(G.over)return false;
 const c=parseCmd(text,selId);return exec(c);
}
function pilotReply(a,text,delay){later(delay||rnd(1.2,2.4),()=>{if(!a.dead)say('pilot',a,text,'');});}
function sayAgain(a){pilotReply(a,'Say again, '+csName(a)+'?');}

function exec(c){
 const a=c.acft;
 if(!a){sysMsg('No aircraft matched — select a strip or start with a callsign.','warn');return false;}
 say('atc',a,c.raw);
 if(a.dead)return false;
 if(a.nordo)return true;
 if(a.err&&resolveErr(a,c))return true;
 const H=HANDLERS[c.intent];
 if(H){H(a,c);return true;}
 if(c.wait&&a.req){handleWait(a);return true;}
 if((c.deny||c.neg)&&a.req){handleDeny(a);return true;}
 if(c.wait){pilotReply(a,'Standing by, '+csName(a)+'.');return true;}
 sayAgain(a);return true;
}

function readback(a,key,which,x,delay){
 const ph=PH[key];let tpl=ph['rb'+which];if(!tpl)return;
 const v=V(a,x||{});
 if(which==='Accept'&&ph.errs&&!a.nordo&&!a.veh&&Math.random()<G.cfg.err){const o=injectErr(a,key,v);if(o)tpl=o;}
 const txt=fmt(tpl,v);later(delay||rnd(1.3,2.5),()=>{if(!a.dead)say('pilot',a,txt,ph.urgent?'urgent':'');});
}
function injectErr(a,key,v){
 if(key==='CLR'){
  const real=v.sq,i=rint(0,3);let d=(+real[i]+rint(1,6))%8;const wrong=real.slice(0,i)+d+real.slice(i+1);
  v.sq=wrong;a.err={kind:'sq',real,wrong,at:G.t+15,fix:'negative, squawk '+real};return null;
 }
 if(key==='TAXI'){v.hs='';a.err={kind:'hold',at:G.t+17,fix:'negative, hold short of runway '+RWD()};return null;}
 if(key==='READY'){a.err={kind:'tko',at:G.t+14,fix:'negative, hold position, I said line up and wait'};return 'Cleared for takeoff, runway {rwy}, {cs}.';}
 return null;
}
function resolveErr(a,c){
 const e=a.err;
 const good=()=>{a.err=null;G.safety=Math.min(100,G.safety+1);G.score+=8;sysMsg('Good catch — '+a.cs+' read-back corrected.','ok');};
 if(e.kind==='sq'){
  if(c.squawk===e.real){good();a.squawk=e.real;a.sqAckT=G.t;pilotReply(a,'Squawk '+e.real+', '+csName(a)+'.');return true;}
  if(c.neg){sayAgain(a);return true;}return false;
 }
 if(e.kind==='hold'){
  if(c.intent==='holdpos'||c.intent==='holdshort'||c.neg){good();a.blowHold=false;pilotReply(a,'Hold short of runway '+RWD()+', '+csName(a)+'.');return true;}return false;
 }
 if(e.kind==='tko'){
  if(c.intent==='holdpos'||c.intent==='lineup'||c.neg){good();a.autoTO=false;pilotReply(a,'Line up and wait, runway '+RWD()+', '+csName(a)+'.');return true;}return false;
 }
 return false;
}
function handleWait(a){
 const k=a.req.kind,ph=PH[k],x=a.req.x;a.req=null;
 pilotReply(a,fmt(ph.rbWait||'Standing by, {cs}.',V(a)));
 const d=ph.urgent?rnd(10,16):rnd(18,28);
 if(a.veh)later(d+2,()=>{if(!a.dead&&a.phase==='REQ'&&!a.req)reaskVeh(a);});else a.nextReq={kind:k,at:G.t+d,x};
}
function handleDeny(a){
 const k=a.req.kind,ph=PH[k],x=a.req.x;
 if(ph.urgent){incident('deny','Emergency request refused: '+a.cs,3);pilotReply(a,fmt(ph.rbDeny,V(a)));a.req.t=G.t;return;}
 a.req=null;pilotReply(a,fmt(ph.rbDeny||'Roger, {cs}.',V(a)));
 const d=k==='CLR'?rnd(80,110):rnd(45,75);
 if(a.veh)later(d,()=>{if(!a.dead&&a.phase==='REQ'&&!a.req)reaskVeh(a);});else a.nextReq={kind:k,at:G.t+d,x};
}
function reaskVeh(v){v.req={kind:'INSP',t:G.t,n:0,x:{}};say('pilot',v,fmt(PH.INSP.pilot[0],V(null,{unit:UNITS.GND.n,rwy:RWD()})));emit('req',v);}
function bestGate(a){
 if(a.gate&&G.gates[a.gate]===a.id)return +a.gate;
 let best=null,bl=1e9;
 for(const n of gatesFree()){const r=route(a.node,'S'+n);if(r&&r.len<bl){bl=r.len;best=n;}}
 return best;
}
function planTaxi(a){
 if(a.kind==='dep'){const hp=defaultHold(a);const r=route(a.node,hp);return{hp,r,via:viaNames(r.edges,EXN[hp.slice(1)]).join(', ')||'Alpha'};}
 const g=bestGate(a);if(!g)return null;const r=route(a.node,'S'+g);return{g,r,via:viaNames(r.edges).join(', ')||'Alpha'};
}

const HANDLERS={
 clearance(a,c){
  if(a.kind!=='dep'||!['BOARDING','AT_GATE'].includes(a.phase)||a.clrOk){pilotReply(a,a.clrOk?'We already have our clearance, '+csName(a)+'.':'Say again, '+csName(a)+'?');return;}
  if(c.deny){if(a.req)handleDeny(a);else pilotReply(a,'Standing by, '+csName(a)+'.');return;}
  if(c.wait){if(a.req)handleWait(a);return;}
  if(c.destObj&&c.destObj!==a.dest){pilotReply(a,'Negative, our destination is '+a.dest.n+', '+csName(a)+'.');return;}
  if(!c.squawk||/[89]/.test(c.squawk)){pilotReply(a,'Say again squawk code, '+csName(a)+'?');return;}
  a.squawk=c.squawk;G.sqUsed[c.squawk]=1;a.clrOk=true;if(a.req&&a.req.kind==='CLR')a.req=null;
  readback(a,'CLR','Accept');
 },
 pushback(a,c){
  if(a.kind!=='dep'||!['BOARDING','AT_GATE'].includes(a.phase)){sayAgain(a);return;}
  if(a.phase==='BOARDING'){pilotReply(a,'Negative, we are still boarding, '+csName(a)+'.');return;}
  if(c.deny){if(a.req)handleDeny(a);return;}
  if(c.wait){if(a.req)handleWait(a);return;}
  if(!a.clrOk){pilotReply(a,'Negative, we have not received our IFR clearance yet, '+csName(a)+'.');return;}
  a.req=null;a.pushAsked=true;a.nextReq=null;
  readback(a,'PUSH','Accept',{facing:facingFor(a)});
  later(3.8,()=>{if(a.dead)return;a.phase='PUSHBACK';a.path=buildPath([{x:a.x,z:a.z},{x:a.x,z:-300}],10);a.s=0;a.back=true;a.paused=false;});
 },
 taxi(a,c){
  if(c.deny){if(a.req)handleDeny(a);return;}
  if(c.wait){if(a.req)handleWait(a);return;}
  if(a.kind==='dep'){
   if(a.phase!=='STOPPED'||!a.node){pilotReply(a,['BOARDING','AT_GATE'].includes(a.phase)?'Negative, we are still on stand, '+csName(a)+'.':'Say again, '+csName(a)+'?');return;}
   if(c.rwy&&c.rwy!==G.rwy){pilotReply(a,'Negative, runway '+RWD()+' is in use, '+csName(a)+'.');return;}
   const hp=c.hp?'H'+c.hp:defaultHold(a);
   if(availRoll(hp)<toffReq(a)){pilotReply(a,'Unable, we need more runway than is available from holding point '+HPN[hp]+', request '+(a.heavy?'the full length':'a longer roll')+', '+csName(a)+'.');return;}
   const r=route(a.node,hp);if(!r){sayAgain(a);return;}
   a.req=null;a.nextReq=null;a.hp=hp;a.destNode=hp;a.path=pathFromNodes(r.ids,{x:a.x,z:a.z},40);a.s=0;a.paused=false;a.back=false;a.phase='TAXI';a.node=null;
   const via=viaNames(r.edges,EXN[hp.slice(1)]).join(', ')||'Alpha';
   readback(a,'TAXI','Accept',{via,hp:HPN[hp],hs:', hold short of runway '+RWD()});
   return;
  }
  // arrival
  if(a.phase!=='VACATED'||!a.node){sayAgain(a);return;}
  let g=null;if(c.stand&&!G.gates[c.stand])g=+c.stand;else if(c.stand&&G.gates[c.stand]&&G.gates[c.stand]!==a.id){pilotReply(a,'Negative, stand '+c.stand+' is occupied, '+csName(a)+'.');return;}else g=bestGate(a);
  if(!g){pilotReply(a,'Holding position, no stand available, '+csName(a)+'.');if(a.req)a.req=null;a.nextReq={kind:'GNDTAXI',at:G.t+25,x:{}};return;}
  const r=route(a.node,'S'+g);if(!r){sayAgain(a);return;}
  a.req=null;a.nextReq=null;if(a.gate&&G.gates[a.gate]===a.id)delete G.gates[a.gate];a.gate=String(g);G.gates[g]=a.id;
  a.path=pathFromNodes(r.ids,{x:a.x,z:a.z},40);a.s=0;a.paused=false;a.phase='TAXI';a.node=null;
  readback(a,'GNDTAXI','Accept',{gate:String(g),via:viaNames(r.edges).join(', ')||'Alpha'});
 },
 holdpos(a,c){
  if(a.req&&['RTO','BURST','DISABLED','EVAC'].includes(a.req.kind)){const k=a.req.kind;a.req=null;a.ack=true;readback(a,k,'Accept');sendFire(a.x);return;}
  if(a.phase==='ROLL'||a.phase==='RTO'){return HANDLERS.stop(a,c);}
  if(a.req&&['CLR','PUSH','TAXI','READY','TKOF','GNDTAXI','INSP','AIRB','GAREQ'].includes(a.req.kind)&&!['AIRB','GAREQ'].includes(a.req.kind)){handleDeny(a);return;}
  if(['TAXI','PUSHBACK','LINEUP'].includes(a.phase))a.paused=true;
  pilotReply(a,'Holding position, '+csName(a)+'.');
 },
 stop(a,c){
  if(a.phase==='RTO'){pilotReply(a,'Stopping, '+csName(a)+'.');return;}
  if(a.phase==='ROLL'){
   if(a.v<82*KT){a.phase='RTO';a.mishap=null;say('pilot',a,'Stopping, '+csName(a)+'!','urgent');}
   else pilotReply(a,'Unable, we are past rejection speed, continuing, '+csName(a)+'.',0.8);
   return;
  }
  if(['TAXI','PUSHBACK','LINEUP'].includes(a.phase))a.paused=true;
  pilotReply(a,'Stopping, '+csName(a)+'.');
 },
 holdshort(a,c){
  if(a.phase==='TAXI'||a.phase==='HOLDING'||a.phase==='STOPPED'){a.blowHold=false;pilotReply(a,'Holding short of runway '+RWD()+', '+csName(a)+'.');return;}
  sayAgain(a);
 },
 continue(a,c){
  if(a.paused){a.paused=false;pilotReply(a,'Continuing taxi, '+csName(a)+'.');return;}
  if(a.phase==='APPROACH'){HANDLERS.contapp(a,c);return;}
  sayAgain(a);
 },
 lineup(a,c){
  if(a.phase!=='HOLDING'||!a.destNode){pilotReply(a,a.phase==='ON_RWY'?'We are already lined up, '+csName(a)+'.':'Say again, '+csName(a)+'?');return;}
  if(c.deny){if(a.req)handleDeny(a);return;}
  if(c.rwy&&c.rwy!==G.rwy){pilotReply(a,'Negative, runway '+RWD()+' is the active runway, '+csName(a)+'.');return;}
  if(availRoll(a.destNode)<toffReq(a)){pilotReply(a,'Unable, not enough runway from here, '+csName(a)+'.');return;}
  const occ=rwyOccupied(a);if(occ){pilotReply(a,'Unable, the runway is occupied by '+occ.rt+', '+csName(a)+'.');return;}
  a.node=a.destNode;a.req=null;a.nextReq=null;startLineup(a,false);
  readback(a,'READY','Accept');
 },
 takeoff(a,c){
  if(c.rwy&&c.rwy!==G.rwy){pilotReply(a,'Negative, runway '+RWD()+' is active, '+csName(a)+'.');return;}
  if(a.phase==='HOLDING'&&a.destNode){
   const occ=rwyOccupied(a);if(occ){pilotReply(a,'Unable, the runway is occupied by '+occ.rt+', '+csName(a)+'.');return;}
   if(availRoll(a.destNode)<toffReq(a)){pilotReply(a,'Unable, not enough runway from here, '+csName(a)+'.');return;}
   a.node=a.destNode;a.req=null;a.nextReq=null;a.rollNext=true;startLineup(a,false);readback(a,'TKOF','Accept');return;
  }
  if(a.phase==='LINEUP'){a.rollNext=true;a.req=null;readback(a,'TKOF','Accept');return;}
  if(a.phase!=='ON_RWY'){sayAgain(a);return;}
  { const occ=rwyOccupied(a);if(occ&&occ.phase!=='ON_RWY'&&occ!==a&&occ.phase!=='LINEUP'){pilotReply(a,'Unable, '+occ.rt+' is on the runway, '+csName(a)+'.');return;} }
  if(a.req)a.req=null;a.nextReq=null;a.autoTO=false;
  readback(a,'TKOF','Accept');
  later(rnd(2.6,3.8),()=>{if(!a.dead&&a.phase==='ON_RWY')startRoll(a);});
 },
 land(a,c){
  if(a.phase==='RETURN'&&a.emerg){a.preCleared=true;a.req=null;a.nextReq=null;a.priority=true;readback(a,EMKEY[a.emerg]||'MAYDAY','Accept');a.bonus=(a.bonus||0)+150;return;}
  if(!['APPROACH','GOAROUND'].includes(a.phase)){sayAgain(a);return;}
  if(c.rwy&&c.rwy!==G.rwy){pilotReply(a,'Negative, we are lined up for runway '+RWD()+', '+csName(a)+'.');return;}
  if(a.phase==='GOAROUND'){pilotReply(a,'We are going around, '+csName(a)+'.');return;}
  a.cleared=true;a.priority=!!a.emerg;
  const key=EMKEY[a.emerg]||'LANDREQ';
  if(a.req)a.req=null;a.nextReq=null;
  readback(a,key,'Accept');
  if(a.emerg==='panpan')a.bonus=(a.bonus||0)+200;
  if(a.emerg&&a.emerg!=='panpan')a.bonus=(a.bonus||0)+150;
  if(a.emerg&&a.emerg!=='fuel'&&a.emerg!=='panpan')sendFire(0);
 },
 contapp(a,c){
  if(a.phase!=='APPROACH'){sayAgain(a);return;}
  const k=a.req?a.req.kind:null;
  if(k)a.req=null;a.nextReq=null;
  if(k&&PH[k].urgent){pilotReply(a,fmt(PH[k].rbWait,V(a)));return;}
  readback(a,'CHECKIN','Accept');
 },
 goaround(a,c){
  if(a.phase==='APPROACH'){a.req=null;a.nextReq=null;startGoAround(a,'');return;}
  if(a.phase==='GOAROUND'){pilotReply(a,'We are already going around, '+csName(a)+'.');return;}
  pilotReply(a,'Unable, we are not on final, '+csName(a)+'.');
 },
 speed(a,c){
  if(a.phase!=='APPROACH'){sayAgain(a);return;}
  const s=clamp(c.spd||160,a.type.vref+5,200);a.spdCmd=s;
  pilotReply(a,(s<a.v/KT?'Reducing speed ':'Speed ')+s+' knots, '+csName(a)+'.');
 },
 handoff(a,c){
  const u=c.unit;
  if(a.kind==='dep'&&['CLIMB'].includes(a.phase)&&(u==='departure'||u==='approach')){
   const k=a.req&&a.req.kind==='BIRD'?'BIRD':'AIRB';a.req=null;a.handed=true;a.nextReq=null;
   readback(a,k,'Accept',{freq:UNITS.DEP.f});a.bonus=(a.bonus||0)+(k==='BIRD'?40:0);return;
  }
  if(a.kind==='arr'&&a.phase==='VACATED'&&u==='ground'){
   a.req=null;a.handed=true;readback(a,'VAC','Accept',{freq:UNITS.GND.f});
   later(rnd(5,8),()=>{if(!a.dead&&a.phase==='VACATED')request(a,'GNDTAXI');});return;
  }
  if(a.kind==='arr'&&a.phase==='VACATED'&&u!=='ground'){pilotReply(a,'Say again, we are on the ground, '+csName(a)+'.');return;}
  pilotReply(a,'Negative, '+csName(a)+', say again?');
 },
 vacate(a,c){
  if(a.veh){
   if(a.phase==='INSP'&&Math.abs(a.z)<58){const k=nearestConn(a.x),X=NODES['R'+k].x,r=route('H'+k,'DP');const P=[{x:a.x,z:0},{x:X,z:0}];r.ids.forEach(id=>P.push({x:NODES[id].x,z:NODES[id].z}));a.path=buildPath(P,28);a.s=0;a.phase='BACK';a.fast=true;a.paused=false;a.reported=true;say('pilot',a,'Vacating the runway, Operations 1.');}
   else pilotReply(a,'Roger, Operations 1.');
   return;}
  if(a.phase==='ROLLOUT'){pilotReply(a,'Vacating, '+csName(a)+'.');return;}
  if(a.phase==='RWY_STOP'){pilotReply(a,'Unable, we are not able to move, '+csName(a)+'.');return;}
  sayAgain(a);
 },
 squawk(a,c){
  if(!c.squawk||/[89]/.test(c.squawk)){sayAgain(a);return;}
  if(a.squawk===c.squawk&&a.sqAckT&&G.t-a.sqAckT<90){ // already confirmed: don't parrot it again
   if(!a.sqNote){a.sqNote=true;sysMsg(a.cs+' already confirmed squawk '+c.squawk+' — nothing more to do here.','ok');}
   pilotReply(a,'Roger, '+csName(a)+'.');return;}
  a.squawk=c.squawk;a.sqAckT=G.t;a.sqNote=false;pilotReply(a,'Squawk '+c.squawk+', '+csName(a)+'.');
 },
 radiocheck(a,c){pilotReply(a,'Loud and clear, '+csName(a)+'.');},
 inspect(a,c){
  if(!a.veh||a.phase!=='REQ'){sayAgain(a);return;}
  if(c.deny){if(a.req)handleDeny(a);return;}
  if(c.wait){if(a.req)handleWait(a);return;}
  a.req=null;readback(a,'INSP','Accept',{rwy:RWD(),unit:''});
  later(3,()=>{if(a.dead)return;
   const k=G.rwy==='09'?'C':'D',rx=NODES['R'+k];const out=route('DP','H'+k);
   const p=opsInspectPath();a.path=p;a.s=0;a.phase='INSP';
   a.sIn=out.len;
   a.sOut=a.sIn+Math.abs(rx.x-(-AP.half+40))+(2*AP.half-80)+Math.abs((AP.half-40)-rx.x);
   a.wasOn=false;a.reported=false;});
 },
 roger(a,c){
  if(c.wait&&a.req){handleWait(a);return;}
  const k=a.req?a.req.kind:null;
  if(k==='RTO'||k==='BURST'||k==='DISABLED'||k==='EVAC'){a.req=null;a.ack=true;readback(a,k,'Accept');sendFire(a.x);return;}
  if(k==='GAREQ'){a.req=null;readback(a,'GAREQ','Accept');return;}
  if(k==='BIRD'){a.req=null;a.handed=true;readback(a,'BIRD','Accept',{freq:UNITS.DEP.f});return;}
  if(k&&PH[k].urgent){handleWait(a);return;}
  pilotReply(a,'Roger, '+csName(a)+'.');
 }
};

/* ---------------- UI-facing helpers ---------------- */
function buildReplies(a){
 const q=a.req;if(!q||a.dead)return null;
 const k=q.kind,ph=PH[k];const x=Object.assign({unit:UNITS[ph.unit].n},q.x||{});
 if(k==='CLR'){a.sqPlan=a.sqPlan||newSquawk();x.sq=a.sqPlan;}
 if(k==='PUSH')x.facing=facingFor(a);
 if(k==='TAXI'&&a.node){const p=planTaxi(a);x.hp=HPN[p.hp];x.via=p.via;}
 let acceptOverride=null;
 if(k==='GNDTAXI'&&a.node){const p=planTaxi(a);if(p){x.gate=String(p.g);x.via=p.via;}else acceptOverride='{cs}, hold position, no stand available yet.';}
 if(k==='AIRB'||k==='BIRD')x.freq=UNITS.DEP.f;
 if(k==='VAC')x.freq=UNITS.GND.f;
 if(k==='INSP'){x.rwy=G.rwy;}
 const v=V(a,x);
 const rbOf=w=>ph['rb'+w]?fmt(ph['rb'+w],v):'';
 return{kind:k,title:ph.title,note:ph.note||'',accept:fmt(acceptOverride||ph.accept,v),deny:fmt(ph.deny,v),wait:fmt(ph.wait,v),rbAccept:acceptOverride?'':rbOf('Accept'),rbDeny:rbOf('Deny'),rbWait:rbOf('Wait'),urgent:!!ph.urgent,
  labels:(k==='CHECKIN'?{accept:'CONTINUE APPROACH',deny:'GO AROUND',wait:'REDUCE SPEED'}:k==='LANDREQ'?{accept:'CLEARED TO LAND',deny:'GO AROUND',wait:'CONTINUE APPROACH'}:null)};
}
function quickCmds(a){
 const cs=csName(a),L=[];const rw=G.rwy;
 const add=(label,text)=>L.push({label,text:cs+', '+text});
 if(a.err)L.push({label:'NEGATIVE — I SAY AGAIN',text:cs+', '+a.err.fix+'.',hot:true});
 if(a.veh){if(a.phase==='INSP')add('VACATE RUNWAY NOW','vacate the runway immediately.');add('Hold position','hold position.');return L;}
 if(a.phase==='APPROACH'){add('Continue approach','continue approach.');add('Cleared to land','wind '+V(a).wdir+' degrees '+V(a).wspd+' knots, runway '+rw+', cleared to land.');add('Reduce speed 160','reduce speed to 160 knots.');add('Go around','go around, I say again, go around.');}
 if(a.phase==='HOLDING'){add('Line up and wait','runway '+rw+', line up and wait.');add('Cleared for takeoff','wind '+V(a).wdir+' degrees '+V(a).wspd+' knots, runway '+rw+', cleared for takeoff.');add('Hold position','hold position.');}
 if(a.phase==='ON_RWY'){add('Cleared for takeoff','wind '+V(a).wdir+' degrees '+V(a).wspd+' knots, runway '+rw+', cleared for takeoff.');add('Hold position','hold position.');}
 if(a.phase==='ROLL')add('STOP IMMEDIATELY','stop immediately, stop immediately.');
 if(a.phase==='CLIMB')add('Contact Departure','contact Departure '+UNITS.DEP.f+'.');
 if(a.phase==='VACATED')add('Contact Ground','contact Ground '+UNITS.GND.f+'.');
 if(['TAXI','PUSHBACK','LINEUP'].includes(a.phase)){add('Hold position','hold position.');if(a.paused)add('Continue taxi','continue taxi.');add('Hold short','hold short of runway '+rw+'.');}
 if(a.phase==='STOPPED'&&a.paused===false&&a.kind==='dep'&&a.node&&!a.req){const p=planTaxi(a);add('Taxi to holding point '+HPN[p.hp],'runway '+rw+', taxi to holding point '+HPN[p.hp]+' via '+p.via+', hold short of runway '+rw+'.');}
 if(a.phase==='VACATED'&&a.handed&&!a.req){const p=planTaxi(a);if(p)add('Taxi to stand '+p.g,'taxi to stand '+p.g+' via '+p.via+'.');}
 if(a.paused)add('Continue taxi','continue taxi.');
 add('Radio check','radio check.');
 return L;
}
function setLight(id,color){
 const a=G.ents.find(e=>e.id===id);if(!a||a.dead)return;
 a.lightG=color;sysMsg('Light gun: '+({green:'steady GREEN',red:'steady RED',white:'flashing WHITE'}[color])+' → '+a.cs,'');
 emit('light',{a,color});
 if(a.nordo&&color==='red'&&a.phase==='APPROACH')startGoAround(a,'red light signal');
 if(a.nordo&&color==='white'&&a.phase==='ON_RWY'){a.nordo=false;a.squawk=a.sqPlan||newSquawk();}
}
function changeRunway(){
 const busy=G.ents.find(e=>!e.dead&&!e.veh&&(['ROLL','ON_RWY','LINEUP','ROLLOUT','RTO','RWY_STOP','BLOCKED_ROLL','GOAROUND'].includes(e.phase)||(e.phase==='APPROACH'&&e.D<5.5*NM)||(e.phase==='CLIMB'&&e.y<150)));
 if(busy)return{ok:false,msg:'Not now — '+busy.cs+' is on or near the runway.'};
 const bv=G.ents.find(e=>e.veh&&e.vt==='ops'&&e.phase==='INSP');if(bv)return{ok:false,msg:'Inspection vehicle is on the runway.'};
 G.rwy=G.rwy==='09'?'27':'09';G.atis=(G.atis+1)%26;
 G.ents.forEach(e=>{if(!e.dead&&e.phase==='APPROACH'){e.cleared=false;placeApproach(e);}});
 sysMsg('Runway '+RWD()+' now in use. New ATIS '+ATIS_L[G.atis]+'. Check your taxi routes.','warn');emit('atis',G);
 return{ok:true};
}
function snapshotATIS(){const w=G.wind;let wd=Math.round(WDM(w)/10)*10%360;if(wd===0)wd=360;return 'ATIS '+ATIS_L[G.atis]+' · RWY '+RWD()+' · '+pad(wd,3)+'/'+Math.round(w.spd)+'kt · QNH '+G.qnh+(G.fog?' · LOW VIS':'');}
