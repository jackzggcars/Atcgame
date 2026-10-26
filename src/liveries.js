'use strict';
/* =====================================================================
   SPECIAL LIVERIES — one-off paint jobs, heritage schemes and the airport open-day jet.
   All artwork is original.  A scheme returns overrides for the airline object plus optional painters:
   deco(x,W,H,ppm,X,Y,L)   — fuselage canvas, drawn under the title / windows
   finBase / finTop(x,W,hf,y0,s) — fin canvas halves (u runs up the fin), before / after the airline logo
   ===================================================================== */
function _rng(seed){let s=seed>>>0||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
const SPECIALS=[
 {id:'galaxy',title:'Starlight special — galaxy scheme',w:3,
  mut:al=>({body:'#0b1233',tail:0x0b1233,acc:0x0b1233,tailInk:'#ffffff'}),
  deco(x,W,H,ppm,X,Y){
   const R=_rng(77);
   [['rgba(120,60,190,0.55)',0.27],['rgba(30,160,190,0.45)',0.73],['rgba(190,60,140,0.40)',0.5]].forEach(([c,u])=>{for(let k=0;k<5;k++){const cx=X(u+(R()-0.5)*0.22),cy=Y(0.15+R()*0.78),r=ppm*(1.6+R()*2.6);const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,c);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(cx-r,cy-r,r*2,r*2);}});
   for(let i=0;i<620;i++){const u=R(),t=0.04+R()*0.9,big=R()<0.1;x.fillStyle='rgba(255,255,255,'+(0.7+R()*0.3)+')';const r=big?2.2+R()*2:1.2+R()*1.4;x.beginPath();x.arc(X(u),Y(t),r,0,6.283);x.fill();
    if(big){x.strokeStyle='rgba(255,255,255,0.7)';x.lineWidth=0.8;x.beginPath();x.moveTo(X(u)-r*3,Y(t));x.lineTo(X(u)+r*3,Y(t));x.moveTo(X(u),Y(t)-r*3);x.lineTo(X(u),Y(t)+r*3);x.stroke();}}
   for(const[u,t,r,hue]of[[0.27,0.88,1.15,'#d9a35a'],[0.73,0.88,1.15,'#d9a35a'],[0.27,0.13,0.55,'#c7ced6'],[0.73,0.13,0.55,'#c7ced6']]){
    const cx=X(u),cy=Y(t),rr=ppm*r;const g=x.createRadialGradient(cx-rr*0.3,cy-rr*0.3,rr*0.1,cx,cy,rr);g.addColorStop(0,'#fff1c8');g.addColorStop(1,hue);x.fillStyle=g;x.beginPath();x.arc(cx,cy,rr,0,6.283);x.fill();
    if(r>1){x.strokeStyle='rgba(235,205,150,0.85)';x.lineWidth=rr*0.16;x.beginPath();x.ellipse(cx,cy,rr*1.7,rr*0.45,-0.45,0,6.283);x.stroke();}}
  },
  finBase(x,W,hf,y0,s){const R=_rng(5+s);x.fillStyle='#0b1233';x.fillRect(0,y0,W,hf);for(let i=0;i<120;i++){x.fillStyle='rgba(255,255,255,'+(0.4+R()*0.6)+')';x.beginPath();x.arc(R()*W,y0+R()*hf,0.7+R()*1.6,0,6.283);x.fill();}
   const g=x.createRadialGradient(W*0.6,y0+hf*0.4,0,W*0.6,y0+hf*0.4,hf*0.6);g.addColorStop(0,'rgba(150,80,210,0.55)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,y0,W,hf);},
  finTop(x,W,hf,y0,s){x.save();x.beginPath();x.rect(0,y0,W,hf);x.clip();x.fillStyle='#f5e7b0';x.beginPath();x.arc(W*0.72,y0+hf*0.30,hf*0.14,0,6.283);x.fill();x.fillStyle='#0b1233';x.beginPath();x.arc(W*0.76,y0+hf*0.27,hf*0.12,0,6.283);x.fill();x.restore();}},
 {id:'retro70',title:'Heritage 1970s scheme',w:3,
  mut:al=>({body:'#f2eee3',tail:0xd9622b,acc:0x7a3b1e,tailInk:'#7a3b1e'}),
  deco(x,W,H,ppm,X,Y){
   const g=x.createLinearGradient(X(0.36),0,X(0.64),0);g.addColorStop(0,'rgba(190,196,202,0)');g.addColorStop(0.5,'rgba(190,196,202,1)');g.addColorStop(1,'rgba(190,196,202,0)');x.fillStyle=g;x.fillRect(X(0.36),Y(0.93),X(0.28),Y(0.06)-Y(0.93));
   const cols=['#d9622b','#7a3b1e','#e0a526'];
   for(const side of[0,1])cols.forEach((c,k)=>{const u=side?1-(0.205+k*0.019):0.205+k*0.019;x.fillStyle=c;x.beginPath();x.moveTo(X(u)-ppm*0.16,Y(0.09));x.lineTo(X(u)+ppm*0.16,Y(0.09));x.lineTo(X(u)+ppm*0.1,Y(0.955));x.lineTo(X(u)-ppm*0.1,Y(0.955));x.closePath();x.fill();});
  },
  finBase(x,W,hf,y0,s){x.fillStyle='#d9622b';x.fillRect(0,y0,W,hf);['#7a3b1e','#e0a526'].forEach((c,k)=>{x.fillStyle=c;x.fillRect(0,y0+hf*(0.14+k*0.12),W,hf*0.06);});},
  finTop(x,W,hf,y0,s){x.fillStyle='#f2eee3';x.beginPath();x.arc(W*0.5,y0+hf*0.58,hf*0.06,0,6.283);x.fill();}},
 {id:'rainbow',title:'Rainbow scheme',w:2.4,
  mut:al=>({body:'#f3f4f4',tail:0x2b2f36,acc:0xffffff,tailInk:'#1b1b1b'}),
  deco(x,W,H,ppm,X,Y){
   const C=['#e40303','#ff8c00','#ffed00','#008026','#004dff','#750787'];
   for(const side of[0,1])C.forEach((c,k)=>{const u=side?1-(0.115+k*0.0235):0.115+k*0.0235;x.fillStyle=c;x.fillRect(X(u)-ppm*0.15,Y(0.95),ppm*0.3,Y(0.06)-Y(0.95));});
  },
  finBase(x,W,hf,y0,s){['#e40303','#ff8c00','#ffed00','#008026','#004dff','#750787'].forEach((c,k)=>{x.fillStyle=c;x.fillRect(0,y0+hf*k/6,W,hf/6+1);});},
  finTop(x,W,hf,y0,s){}},
 {id:'sunrise',title:'Sunrise special',w:2.4,
  mut:al=>({body:'#f4f1ea',tail:0x7a1f6b,acc:0x7a1f6b,tailInk:'#ffffff'}),
  deco(x,W,H,ppm,X,Y){
   const g=x.createLinearGradient(0,Y(0.96),0,Y(0.04));g.addColorStop(0,'rgba(255,225,120,0.92)');g.addColorStop(0.35,'rgba(255,150,70,0.92)');g.addColorStop(0.7,'rgba(222,70,110,0.92)');g.addColorStop(1,'rgba(110,40,150,0.95)');
   x.fillStyle=g;x.fillRect(0,Y(0.96),X(0.355),Y(0.04)-Y(0.96));x.fillRect(X(0.645),Y(0.96),X(0.355),Y(0.04)-Y(0.96));
   for(const u of[0.255,0.745]){x.fillStyle='rgba(255,246,200,0.95)';x.beginPath();x.arc(X(u),Y(0.2),ppm*0.9,Math.PI,0);x.fill();}
  },
  finBase(x,W,hf,y0,s){const g=x.createLinearGradient(0,y0,W,y0);g.addColorStop(0,'#ffd36a');g.addColorStop(0.5,'#e8506e');g.addColorStop(1,'#5a1c7e');x.fillStyle=g;x.fillRect(0,y0,W,hf);},
  finTop(x,W,hf,y0,s){x.fillStyle='rgba(255,246,200,0.95)';x.beginPath();x.arc(W*0.28,y0+hf*0.56,hf*0.17,0,Math.PI,true);x.fill();}},
 {id:'gold',title:'Golden jubilee — 50 years',w:1.6,
  mut:al=>({body:'#cfae52',tail:0x3b2a0f,acc:0x3b2a0f,tailInk:'#3b2a0f'}),
  deco(x,W,H,ppm,X,Y){
   const g=x.createLinearGradient(0,0,W,0);for(let i=0;i<=8;i++)g.addColorStop(i/8,i%2?'rgba(255,240,170,0.28)':'rgba(120,85,20,0.18)');x.fillStyle=g;x.fillRect(0,Y(0.96),W,Y(0.04)-Y(0.96));
   x.font='700 '+Math.max(10,ppm*0.62)+'px Georgia,serif';x.fillStyle='#3b2a0f';x.textAlign='center';x.textBaseline='middle';
   for(const[u,rot]of[[0.30,-Math.PI/2],[0.70,Math.PI/2]]){x.save();x.translate(X(u),Y(0.82));x.rotate(rot);x.scale(1,-1);x.fillText('GOLDEN JUBILEE',0,0);x.restore();}
  },
  finBase(x,W,hf,y0,s){x.fillStyle='#3b2a0f';x.fillRect(0,y0,W,hf);},
  finTop(x,W,hf,y0,s){x.save();x.beginPath();x.rect(0,y0,W,hf);x.clip();x.translate(W*0.46,y0+hf*0.52);x.rotate(s===0?-Math.PI/2:Math.PI/2);x.fillStyle='#e9c75a';x.font='800 '+hf*0.5+'px Georgia,serif';x.textAlign='center';x.textBaseline='middle';x.fillText('50',0,-hf*0.04);x.font='700 '+hf*0.085+'px Georgia,serif';x.fillText('YEARS',0,hf*0.26);x.restore();}},
 {id:'chequer',title:'Chequered flag special',w:2,
  mut:al=>({body:'#f3f4f4',tail:0x15171a,acc:0xc8102e,tailInk:'#ffffff'}),
  deco(x,W,H,ppm,X,Y){
   const q=ppm*0.42;for(const side of[0,1])for(let r=0;r<3;r++){const u0=side?1-0.235-q*1.5/W+r*q/W:0.235-q*1.5/W+r*q/W;
    for(let c=0;c<(Y(0.06)-Y(0.95))/q;c++){x.fillStyle=(r+c)%2?'#15171a':'#f3f4f4';x.fillRect(X(u0),Y(0.95)+c*q,q,q);}}
  },
  finBase(x,W,hf,y0,s){const q=hf/10;for(let r=0;r<10;r++)for(let c=0;c<Math.ceil(W/q);c++){x.fillStyle=(r+c)%2?'#15171a':'#f3f4f4';x.fillRect(c*q,y0+r*q,q,q);}},
  finTop(x,W,hf,y0,s){}},
 {id:'openday',title:'Airport Open Day special',w:0,event:true,
  mut:al=>({body:'#f3f4f4',tail:0x1c3f94,acc:0xe9c500,tailInk:'#ffffff'}),
  deco(x,W,H,ppm,X,Y){
   const C=['#e63946','#f4a300','#2a9d8f','#1d6fd6','#8e44ad'];
   for(const u of[0.115,0.885]){x.strokeStyle='#555';x.lineWidth=1.2;x.beginPath();for(let i=0;i<=40;i++){const t=0.1+i/40*0.85;i?x.lineTo(X(u),Y(t)):x.moveTo(X(u),Y(t));}x.stroke();
    for(let i=0;i<22;i++){const t=0.12+i*0.038;x.fillStyle=C[i%5];x.beginPath();x.moveTo(X(u)-ppm*0.18,Y(t));x.lineTo(X(u)+ppm*0.18,Y(t));x.lineTo(X(u),Y(t)+ppm*0.6);x.closePath();x.fill();}}
   x.font='800 '+Math.max(12,ppm*0.95)+'px Helvetica,Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';
   for(const[u,rot]of[[0.205,-Math.PI/2],[0.795,Math.PI/2]]){x.save();x.translate(X(u),Y(0.30));x.rotate(rot);x.scale(1,-1);x.fillStyle='#e63946';x.fillText('OPEN DAY',0,0);x.restore();}
  },
  finBase(x,W,hf,y0,s){x.fillStyle='#1c3f94';x.fillRect(0,y0,W,hf);const C=['#e63946','#f4a300','#2a9d8f','#8e44ad'];for(let i=0;i<9;i++){x.fillStyle=C[i%4];x.beginPath();x.arc(W*(0.08+i*0.1),y0+hf*(0.25+0.3*Math.sin(i*1.7)*0.5+0.15),hf*0.06,0,6.283);x.fill();}},
  finTop(x,W,hf,y0,s){}}
];
const SPEC_BY=Object.fromEntries(SPECIALS.map(s=>[s.id,s]));
/* make a one-off variant of an airline carrying a special scheme */
function specialAirline(al,sp){
 const v=Object.assign({},al,sp.mut(al),{skey:sp.id,special:sp.title,deco:sp.deco,finBase:sp.finBase,finTop:sp.finTop});
 return v;
}
function specialEligible(al,ty){return!al.sq&&!al.liv&&!al.vis&&!al.prio&&!al.skey&&al.icao!=='AAL'&&al.icao!=='VIR'&&!(ty.vis||ty.biz||['CONC','F14','B2'].includes(ty.n));}
