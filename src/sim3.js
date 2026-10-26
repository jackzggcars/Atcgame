'use strict';
/* =====================================================================
   EMERGENCIES — engine fire / separation, gear-up and hydraulic landings, cabin smoke,
   fuel leaks, brake fires + evacuation, fuel exhaustion (dead-stick glide), runway overruns.
   Pure simulation: aircraft carry a damage record (a.dmg), a fire level (a.fire 0..1) and flags
   the 3D layer turns into flames, smoke, sparks, missing parts, slides and wreckage.
   ===================================================================== */
const EMKIND={engfire:'ENGFIRE',gear:'GEARUP',hyd:'HYDFAIL',smoke:'CABSMOKE',leak:'FUELLEAK'};
const EMKEY={panpan:'PANPAN',fuel:'LOWFUEL',mayday:'MAYDAY',engfire:'ENGFIRE',gear:'GEARUP',hyd:'HYDFAIL',smoke:'CABSMOKE',leak:'FUELLEAK'};
const wetRwy=()=>G.wx==='rain'||G.wx==='storm';

function startArrEmerg(a,D){
 const k=a.mishap;a.slideKind=k;a.emerg=k;a.squawk='7700';G.stats.emerg++;a.dmg=a.dmg||{};
 if(k==='engfire'){a.engOut=true;a.engSide=pick([-1,1]);a.dmg[a.engSide<0?'engL':'engR']='fire';a.fire=0.5;a.fireWhere='engine';}
 if(k==='gear'){a.dmg.gear='up';}
 if(k==='hyd'){a.hyd=true;a.dmg.hyd=true;}
 if(k==='smoke'){a.dmg.smoke=true;a.smokeT=G.t;}
 if(k==='leak'){a.dmg.leak=true;a.leakSide=pick([-1,1]);}
 request(a,EMKIND[k],{dist:Math.max(1,Math.round(D/NM)),side:a.leakSide<0?'left':'right'});
 if(k!=='leak')sendFire(0);
}
function climbEngFail(a){
 const m=a.mishap;a.mishap=null;a.emerg=(m==='engfire_dep'||m==='engsep')?'engfire':'mayday';a.slideKind=a.emerg==='engfire'?'engfire':null;
 a.squawk='7700';G.stats.emerg++;a.engOut=true;a.engSide=pick([-1,1]);a.dmg={};
 const key=a.engSide<0?'engL':'engR';
 a.dmg[key]=m==='engfire_dep'?'fire':m==='engsep'?'gone':'out';
 if(m==='engfire_dep'){a.fire=0.55;a.fireWhere='engine';}
 if(m==='engsep'){a.fire=0.45;a.fireWhere='engine';a.partsLost=['engine'];a.dmg.pylonDamage=true;}
 if(m==='birdeng'){a.dmg.smoke=false;a.dmg.engSmoke=true;}
 request(a,a.emerg==='engfire'?'ENGFIRE':'MAYDAY');
 a.rwyAuth=false;a.phase='RETURN';a.retT=G.t;a.handed=true;a.kind='arr';a.fuel=30;sendFire(0);
}
function igniteAc(a,level,where){a.fire=Math.max(a.fire||0,level);a.fireWhere=where||a.fireWhere;a.fireT=a.fireT||0;a.dmg=a.dmg||{};}
function startEvac(a){
 if(a.evac)return;a.evac=true;a.evacT=G.t;
 say('pilot',a,'Evacuating, evacuating, evacuating! '+csName(a)+'.','urgent');
 sysMsg(a.cs+' is evacuating on the runway — get the fire services to it.','warn');
}
function startSlide(a){
 const k=a.slideKind;if(!k)return false;
 if(k==='leak'){if(Math.random()>0.3)return false;igniteAc(a,0.35,'wing');a.dmg.leak=false;}
 a.phase='SLIDE';a.rwyAuth=true;a.z=0;a.y=0;a.pitch=0;a.sliding=true;a.slideKind=k;a.noExit=true;a.cleared=false;
 const wet=wetRwy()?0.72:1;
 a.mu=(k==='gear'?2.3:k==='hyd'?1.58*wet:k==='smoke'?3.0:k==='engfire'?2.7:2.2)*(k==='gear'?(wetRwy()?0.9:1):1);
 if(k==='gear'){a.belly=true;a.dmg.belly=true;a.dmg.gear='up';if(Math.random()<0.45)igniteAc(a,0.3,'belly');}
 if(k==='smoke'){a.dmg.smoke=true;}
 say('pilot',a,k==='gear'?'Touchdown, gear up, sliding!':k==='hyd'?'Touchdown, we have no brakes, no steering!':'Touchdown!','urgent');
 emit('slide',a);return true;
}
function slideUpdate(a,dt){
 const d=dirOf();
 a.v=Math.max(0,a.v-a.mu*dt);a.x+=d*a.v*dt;a.z=0;a.th=d>0?0:Math.PI;
 const tgtY=a.belly?-a.type.rf*0.8:0;a.y=lerp(a.y,tgtY,Math.min(1,dt*2));a.pitch=lerp(a.pitch,a.belly?-0.035:0,dt);a.vs=0;
 if(Math.abs(a.x)>AP.half+55&&a.v>14){crash([a],'RUNWAY OVERRUN: '+a.cs+' could not stop on the runway ('+(a.slideKind==='hyd'?'hydraulic failure':a.slideKind==='gear'?'gear-up landing':'emergency landing')+').');return;}
 if(a.v<=0.1){
  a.v=0;a.phase='RWY_STOP';a.stopT=G.t;
  const k=a.slideKind;
  if(k==='smoke'){igniteAc(a,0.45,'cabin');request(a,'EVAC',{why:'smoke and fire in the cabin'});startEvac(a);}
  else if(k==='engfire')request(a,'DISABLED',{why:'engine fire'});
  else if(k==='gear')request(a,'DISABLED',{why:'we landed gear up'});
  else if(k==='hyd')request(a,'DISABLED',{why:Math.abs(a.x)>AP.half?'hydraulic failure, we went off the end':'hydraulic failure, no brakes or steering'});
  else request(a,'DISABLED',{why:'fuel leak'+(a.fire?' and a fire':'')});
  sendFire(a.x);
 }
}
function deadStickCrash(a){crash([a],'FUEL EXHAUSTION: '+a.cs+' ran out of fuel and glided into the ground short of the runway.');}

/* per-aircraft emergency bookkeeping (fire growth / suppression, evacuation, in-flight fire timer) */
function emergTick(a,dt){
 if(a.veh||a.dead)return;
 if(a.dmg&&a.dmg.smoke&&a.y>5&&a.smokeT&&G.t-a.smokeT>360&&!G.over){crash([a],'IN-FLIGHT FIRE: '+a.cs+' lost control after an uncontrolled cabin fire. Expedite smoke emergencies.');return;}
 if(a.dead_stick&&a.phase==='GOAROUND'){a.vs=-5.2;a.y+=a.vs*dt;if(a.y<=0&&!G.over){a.y=0;deadStickCrash(a);return;}}
 if((a.fire||0)>0){
  const grounded=a.y<=2&&a.v<8&&['RWY_STOP','SLIDE','VACATED','TAXI','STOPPED','HOLDING'].includes(a.phase);
  if(grounded){
   let tr=null,bd=1e9;for(const e of G.ents)if(e.veh&&e.vt==='fire'&&!e.dead&&(e.phase==='ONSCENE'||e.phase==='GO')){const dd=Math.hypot(e.x-a.x,e.z-a.z);if(dd<bd){bd=dd;tr=e;}}
   if(tr&&bd<(tr.phase==='ONSCENE'?120:80)){a.fire=Math.max(0,a.fire-dt/15);a.sprayBy=tr.id;tr.spray=a.id;}
   else{a.fire=Math.min(1,a.fire+dt/(a.dmg&&a.dmg.belly?90:130));a.fireT=(a.fireT||0)+dt;a.sprayBy=0;}
   if(a.fire<=0.001){a.fire=0;a.fireOut=true;a.dmg.fire=false;sysMsg(a.cs+': fire is out.','ok');G.score+=140;emit('fireout',a);}
   else if(a.fire>0.8&&!a.evac&&a.phase!=='SLIDE')startEvac(a);
   if(a.fireT>170&&!a.burned){a.burned=true;incident('fire','AIRCRAFT LOST TO FIRE: '+a.cs+' — emergency services were too slow',12);}
  }
 }
 if(a.evac&&G.t-a.evacT>95&&!a.evacDone){a.evacDone=true;}
}
