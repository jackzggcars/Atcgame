'use strict';
/* =====================================================================
   FIRST-RUN TUTORIAL — spotlight walkthrough that pauses the sim
   ===================================================================== */
const Tut={
 i:0,active:false,force:false,prevSpeed:1,
 steps:[
  {t:'Welcome to '+AIRPORT.short+' Tower',b:'<p>You are the controller on duty at <b>'+AIRPORT.name+' ('+AIRPORT.icao+')</b>. You work <b>Delivery, Ground and Tower</b> from one seat: clearances, pushback, taxi, runway, handoffs.</p><p>This 1-minute tour covers the screen. The game is paused while you read.</p>'},
  {el:'#v3d',t:'The 3D tower view',b:'<ul><li><b>Drag</b> to look around, <b>scroll</b> to zoom.</li><li>Use the camera buttons: <b>Apron</b>, <b>Final '+AIRPORT.rwy.a+' / '+AIRPORT.rwy.b+'</b>, <b>Midfield</b>, or <b>Follow</b> the selected aircraft.</li><li><b>Click a plane or its label</b> to select it.</li></ul><p>Switch Day / Dusk / Night on the start screen.</p>',side:'right'},
  {el:'#vmap',t:'The radar map',b:'<p>The same traffic as a plan view. Each data block shows <b>callsign, squawk, type, destination</b> and what the aircraft is doing. Arrivals on final show distance in miles.</p><p>Zoom with <b>＋ / －</b>, or hit <b>Radar 10 nm</b> to watch arrivals join the approach. Click any block to select it.</p>',side:'right'},
  {el:'#p-strips',t:'Flight strips',b:'<p>One strip per aircraft. <b>Amber, flashing strips are waiting for you</b>; a red timer bar means they have waited too long and your delay score is dropping.</p><p>Press <b>Tab</b> to jump to the next aircraft that needs an answer.</p>',side:'left'},
  {el:'#p-sel',t:'Answer the request',b:'<p>The pilot\'s request appears here in real radio phrasing. Reply with:</p><ul><li><b>1 · Accept</b> the standard approval phrase</li><li><b>2 · Deny</b> &ldquo;unable&hellip;&rdquo;</li><li><b>3 · Wait</b> &ldquo;standby&rdquo;</li></ul><p>Hover a button to see exactly what you will transmit. The pilot then <b>reads it back</b>: listen for wrong digits or a missing &ldquo;hold short&rdquo;.</p>',side:'left'},
  {el:'#cmdbar',t:'Say it your own way',b:'<p>Type, or <b>hold Space to talk</b>, using real phraseology, for example:</p><p><b>&ldquo;Speedbird 452, runway '+AIRPORT.rwy.a+', line up and wait.&rdquo;</b></p><p>The callsign must be in the message (or select the aircraft first). The <b>Manual</b> button, or key <b>M</b>, has every phrase with a search bar.</p>',side:'top'},
  {t:'How a flight goes',b:'<ul><li><b>Departure:</b> IFR clearance (squawk!) &rarr; pushback &rarr; taxi to holding point &rarr; line up &rarr; cleared for takeoff &rarr; contact departure.</li><li><b>Arrival:</b> check-in on final &rarr; cleared to land &rarr; vacate runway &rarr; taxi to stand.</li><li><b>Emergencies</b> (PAN-PAN, MAYDAY, lost radio, bird strikes) come with no warning. They always take priority.</li></ul>'},
  {t:'Stay safe',b:'<ul><li><b>One aircraft on the runway at a time.</b> Line-up and landing clearances need a clear runway.</li><li>Heavy aircraft need extra spacing behind them (wake turbulence).</li><li>Wrong read-back? Correct it: <b>&ldquo;Negative, squawk 4521&rdquo;</b>.</li><li>When the wind changes, use <b>RWY</b> in the top bar to switch runway once it is clear.</li></ul><p>A collision ends a Career shift. Your <b>Safety</b> bar is your licence.</p>'},
  {el:'#man-btn',t:'Voices and manual',b:'<p>Add a <b>Gemini API key</b> in <b>Settings</b> for realistic pilot voices with airline accents (use the downloaded file in Chrome or Edge). Without a key you get browser voices.</p><p>First aircraft are about to call. Press <b>Tab</b> to answer them. Good luck, Tower.</p>',side:'bottom'}
 ],
 seen(){try{return localStorage.getItem('marlow.tut')==='1';}catch(e){return false;}},
 mark(){try{localStorage.setItem('marlow.tut','1');}catch(e){}},
 run(){
  if(this.active)return;this.active=true;this.i=0;this.force=false;this.prevSpeed=UI.speed||1;
  if(UI.running)UI.setSpeed(0);document.getElementById('tut').hidden=false;this.show();
 },
 end(){
  if(!this.active)return;this.active=false;this.mark();document.getElementById('tut').hidden=true;
  if(UI.running)UI.setSpeed(this.prevSpeed||1);
 },
 go(d){const n=this.i+d;if(n<0)return;if(n>=this.steps.length){this.end();return;}this.i=n;this.show();},
 show(){
  const s=this.steps[this.i],card=document.getElementById('tut-card'),hl=document.getElementById('tut-hl');
  const last=this.i===this.steps.length-1;
  card.innerHTML='<div class="stp">Step '+(this.i+1)+' of '+this.steps.length+'</div><h3>'+s.t+'</h3>'+s.b+
   '<div class="tut-nav"><div class="tut-dots">'+this.steps.map((_,k)=>'<i class="'+(k===this.i?'on':k<this.i?'done':'')+'"></i>').join('')+'</div>'+
   (this.i>0?'<button data-a="back">Back</button>':'<button class="tut-skip" data-a="skip">Skip</button>')+
   '<button class="nx" data-a="next">'+(last?'Start shift':'Next')+'</button></div>';
  card.querySelector('[data-a=next]').focus({preventScroll:true});
  this.place();
 },
 place(){
  const s=this.steps[this.i],card=document.getElementById('tut-card'),hl=document.getElementById('tut-hl');
  const vw=window.innerWidth,vh=window.innerHeight;let el=s.el?document.querySelector(s.el):null;
  if(el&&el.offsetParent===null)el=null;
  if(el){try{el.scrollIntoView({block:'nearest',inline:'nearest'});}catch(e){}}
  const cw=card.offsetWidth,ch=card.offsetHeight;
  if(!el){hl.style.cssText='left:'+(vw/2)+'px;top:'+(vh/2)+'px;width:0;height:0;border-color:transparent;box-shadow:0 0 0 9999px rgba(4,7,11,.8)';
   card.style.left=Math.max(16,(vw-cw)/2)+'px';card.style.top=Math.max(16,(vh-ch)/2)+'px';return;}
  const r=el.getBoundingClientRect(),pad=5;
  hl.style.cssText='left:'+(r.left-pad)+'px;top:'+(r.top-pad)+'px;width:'+(r.width+pad*2)+'px;height:'+(r.height+pad*2)+'px';
  let x,y;const m=14;
  const opts={right:()=>[r.right+m,r.top+10],left:()=>[r.left-cw-m,r.top+10],bottom:()=>[r.left+8,r.bottom+m],top:()=>[r.left+8,r.top-ch-m]};
  const order=[s.side||'right','right','left','bottom','top'];
  const fits=([a,b])=>a>=8&&b>=8&&a+cw<=vw-8&&b+ch<=vh-8;
  let pos=null;for(const o of order){const p=opts[o]();if(fits(p)){pos=p;break;}}
  if(!pos){pos=[Math.min(vw-cw-16,Math.max(16,r.left+16)),Math.min(vh-ch-16,Math.max(16,r.top+16))];if(r.height>vh*0.5)pos=[(vw-cw)/2,vh-ch-16];}
  card.style.left=Math.max(8,Math.min(vw-cw-8,pos[0]))+'px';card.style.top=Math.max(8,Math.min(vh-ch-8,pos[1]))+'px';
 },
 init(){
  document.getElementById('tut-card').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const a=b.dataset.a;if(a==='next')this.go(1);else if(a==='back')this.go(-1);else if(a==='skip')this.end();});
  document.addEventListener('keydown',e=>{if(!this.active)return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();this.end();}else if(e.key==='ArrowRight'||e.key==='Enter'){e.preventDefault();e.stopPropagation();this.go(1);}else if(e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();this.go(-1);}else if(e.key!=='F12'){e.stopPropagation();}},true);
  window.addEventListener('resize',()=>{if(this.active)this.place();});
  const sb=document.getElementById('start-tut');if(sb)sb.addEventListener('click',()=>{this.force=true;UI.start();});
  const tb=document.getElementById('tut-btn');if(tb)tb.addEventListener('click',()=>{if(UI.running)this.run();else{this.force=true;UI.toast&&UI.toast('Tutorial starts with your next shift.','ok');}});
 }
};
(function(){
 const _s=UI.start;UI.start=function(){_s.call(this);if(Tut.force||!Tut.seen())setTimeout(()=>Tut.run(),350);};
 window.addEventListener('load',()=>{try{Tut.init();}catch(e){console.error(e);}});
})();
