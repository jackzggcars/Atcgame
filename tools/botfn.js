module.exports=function(T,t){const G=T.G;
 if(Math.round(t*5)%8!==0)return;
 for(const a of G.ents){
  if(a.dead||a.nordo)continue;
  if(a.err&&G.t>a.err.at-9){T.command(T.csName(a)+', '+a.err.fix+'.',a.id);continue;}
  if(a.req){const r=T.buildReplies(a);if(!r)continue;let txt=r.accept;
   const occ=G.ents.some(e=>e!==a&&!e.dead&&e.y<20&&Math.abs(e.z)<58&&Math.abs(e.x)<1520&&['ROLL','ON_RWY','LINEUP','ROLLOUT','RWY_STOP','RTO'].includes(e.phase));
   const arrNear=G.ents.some(e=>e.phase==='APPROACH'&&e.D<(a.req&&a.req.kind==='TKOF'?2.2:3.2)*1852);
   if(a.req.kind==='READY'||a.req.kind==='TKOF'||a.req.kind==='INSP'){if(arrNear||occ)txt=r.deny;}
   if(a.req.kind==='LANDREQ'&&occ)txt=r.deny;
   T.command(txt,a.id);}
 }
};
