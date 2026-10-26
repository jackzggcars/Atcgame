const T=require('./test.js');const {G}=T;
function run(level,mode,secs,seed){
 T.newGame({level,mode,shift:200,mishap:level==='veteran'?0.6:0.3,err:0.3});
 const counts={};T.on('say',e=>{counts[e.who]=(counts[e.who]||0)+1;});
 const incs=[];T.on('incident',i=>incs.push(i.kind));
 let over=null;T.on('over',o=>over=o);
 const phases={};
 for(let t=0;t<secs&&!G.over;t+=0.2){
  T.step(0.2);require('./botfn.js')(T,t);
  // bot: every 1.5 s answer
  if(false){
   for(const a of G.ents){
    if(a.dead||a.nordo)continue;
    if(a.err&&G.t>a.err.at-9&&Math.random()<0.7){T.command(T.csName(a)+', '+a.err.fix+'.',a.id);continue;}
    if(a.req){
     const r=T.buildReplies(a);if(!r)continue;
     const roll=Math.random();let txt=r.accept;
     if(a.req.kind==='READY'||a.req.kind==='TKOF'){ // be careful about runway
       const arrNear=G.ents.some(e=>e.phase==='APPROACH'&&e.D<4.5*1852);
       const occ=G.ents.some(e=>e!==a&&!e.dead&&e.y<20&&Math.abs(e.z)<58&&Math.abs(e.x)<1520&&['ROLL','ON_RWY','LINEUP','ROLLOUT','RWY_STOP','RTO'].includes(e.phase));
       if(arrNear||occ)txt=r.wait;
     }
     if(a.req.kind==='LANDREQ'||a.req.kind==='CHECKIN'){
       const occ=G.ents.some(e=>e!==a&&!e.dead&&e.y<20&&Math.abs(e.z)<58&&Math.abs(e.x)<1520&&['ROLL','ON_RWY','LINEUP','ROLLOUT','RWY_STOP','RTO'].includes(e.phase));
       if(a.req.kind==='LANDREQ')txt=occ?r.deny:r.accept; else txt=r.accept;
     }
     T.command(txt,a.id);
    }
   }
  }
 }
 return {t:G.t.toFixed(0),score:G.score,safety:G.safety,stats:G.stats,counts,incs,over,ents:G.ents.length};
}
const lv=process.argv[2]||'controller';
const r=run(lv,process.argv[3]||'training',+process.argv[4]||1200);
console.log(JSON.stringify(r,null,1));
