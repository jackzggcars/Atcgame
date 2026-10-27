'use strict';
/* =====================================================================
   UI — wiring, strips, selected-aircraft panel, comms log, manual, settings
   ===================================================================== */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const UI={
 sel:0,speed:1,layout:'split',running:false,last:0,tAcc:0,uiAcc:0,logN:0,
 cfgKey:'marlow.cfg',
 clockStr(sec){sec=Math.floor(sec);return pad(Math.floor(sec/3600)%24,2)+':'+pad(Math.floor(sec/60)%60,2)+':'+pad(sec%60,2);},
 brand(){
  const A=AIRPORT,set=(q,t)=>{const e=document.querySelector(q);if(e)e.textContent=t;};
  document.title=A.short+' Tower';['DEL','GND','TWR','DEP'].forEach(k=>{const e=document.querySelector('#rp-'+k+' span');if(e)e.textContent=UNITS[k].f;});set('.brand h1',A.short+' Tower');const cm=document.getElementById('cmd');if(cm)cm.placeholder='Type or hold Space to talk, e.g. “Speedbird 452, runway '+A.rwy.a+', line up and wait”';set('#conn','OFFLINE · '+A.icao+'_TWR · RWY '+A.rwy.a+'/'+A.rwy.b);set('#p-log h2 span',A.icao+'_TWR · 4 channels');
  set('#start h2',A.short+' Tower');set('#start .sub','CALLSIGN '+A.icao+'_TWR · '+A.name.toUpperCase()+' · DELIVERY / GROUND / TOWER · RATING S3');
  const sel=document.getElementById('s-apt');if(sel){sel.innerHTML=ALLOWED.map(k=>'<option value="'+k+'"'+(k===A.icao?' selected':'')+'>'+AIRPORTS[k].name+' — '+AIRPORTS[k].icao+(AIRPORTS[k].fict?' (fictional)':'')+'</option>').join('');
   sel.addEventListener('change',()=>{try{localStorage.setItem('marlow.airport',sel.value);}catch(e){}location.reload();});}
  document.querySelectorAll('.rwa').forEach(e=>e.textContent=A.rwy.a);
  const b9=document.querySelector('#camtools [data-cam="rwy09"]'),b27=document.querySelector('#camtools [data-cam="rwy27"]');if(b9)b9.textContent='Final '+A.rwy.a;if(b27)b27.textContent='Final '+A.rwy.b;
 },
 init(){
  Voice.load();this.loadCfg();
  this.glOK=R3.init($('gl'),$('labels3d'));
  if(!this.glOK){$('v3d').classList.add('nogl');}
  this.brand();
  MAPV.init($('mapc'));MAPV.fit();
  R3.onPick=e=>{if(e)this.select(e.id);};MAPV.onPick=e=>{if(e)this.select(e.id);};
  this.bind();this.buildManual();this.syncSettings();this.voiceStatus();this.buildPresets();let _ui='classic';try{_ui=localStorage.getItem('marlow.ui')||'classic';}catch(e){}this.applyLayout(_ui,false);
  window.addEventListener('resize',()=>this.resize());this.resize();
  Mic.onText=t=>{$('cmd').value=t;};Mic.onDone=t=>{if((t||'').trim()){$('cmd').value=t.trim();this.submit();}};
  Mic.onState=(on,err)=>{$('mic').classList.toggle('on',on);Voice.hold(on);if(on){this.toast('Listening… speak your transmission','ok');return;}
   const M={'not-allowed':'Microphone blocked. Click the lock / camera icon in the address bar, allow the microphone, then try again.','service-not-allowed':'Speech recognition is blocked in this browser or page. Use Chrome or Edge on the downloaded or deployed (https) page.','no-microphone':'No microphone found.','audio-capture':'No microphone found.','network':'Speech recognition needs an internet connection.','insecure-context':'The microphone needs a secure (https) page.','unsupported':'This page cannot access the microphone (it may be embedded; open it in its own tab).','no-speech':"Didn't hear anything. Hold Space and speak."};
   if(err&&err!=='end'&&err!=='aborted')this.toast(M[err]||('Microphone: '+err),'warn');};
  on('say',e=>this.onSay(e));on('incident',i=>this.banner(i.text,'bad'));on('over',o=>this.onOver(o));
  on('accident',e=>{R3.boom(e.x,e.y,e.z,G.cfg.mode==='training'?25:0);this.alarm();try{FX.crash(e.list);}catch(er){console.warn('crash fx',er);}});
  on('score',s=>{this.sysLine('✓ '+s.a.cs+(s.a.kind==='dep'?' departed':' parked')+' · +'+Math.max(10,s.pts));});
  on('light',l=>R3.beam(l.a,{green:0x30ff60,red:0xff3030,white:0xffffff}[l.color],l.color!=='green'));
  on('atis',()=>this.syncTop());
  on('goaround',()=>{});
  this.showStart();
  requestAnimationFrame(t=>this.loop(t));
 },
 loadCfg(){try{const c=JSON.parse(localStorage.getItem(this.cfgKey)||'{}');this.saved=c;}catch(e){this.saved={};}},
 saveCfg(){try{localStorage.setItem(this.cfgKey,JSON.stringify(this.saved));}catch(e){}},
 resize(){R3.resize();MAPV.resize();},
 /* ---------- start / stop ---------- */
 showStart(){
  const s=this.saved||{};
  $('s-level').value=s.level||'cadet';$('s-mode').value=s.mode||'career';$('s-tod').value=s.tod||'day';$('s-wx').value=s.wx||'clear';$('s-fog').checked=!!s.fog;$('s-cells').checked=s.cells!==false;$('s-vis').checked=s.vis!==false;$('s-amb').checked=(typeof Amb==='undefined')?true:Amb.on;$('s-shift').value=s.shift||30;
  $('s-key').value=Voice.key||'';$('s-gem').checked=Voice.gemini;$('s-voice').checked=Voice.on;
  $('start').hidden=false;$('over').hidden=true;
 },
 start(){
  Voice.ensureCtx();
  const cfg={level:$('s-level').value,mode:$('s-mode').value,tod:$('s-tod').value,wx:$('s-wx').value,fog:$('s-fog').checked,cells:$('s-cells').checked,vis:$('s-vis').checked,visitors:$('s-vis').checked,events:$('s-vis').checked,divert:$('s-vis').checked,spec:$('s-vis').checked?undefined:false,shift:+$('s-shift').value||30};
  try{Amb.on=$('s-amb').checked;localStorage.setItem('marlow.amb',Amb.on?'1':'0');}catch(e){}
  Voice.key=$('s-key').value.trim();Voice.gemini=$('s-gem').checked;Voice.on=$('s-voice').checked;Voice.save();
  this.saved=cfg;this.saveCfg();
  R3.clear();MAPV.trails.clear();$('log').innerHTML='';this.logN=0;this.sel=0;R3.sel=0;MAPV.sel=0;
  newGame(cfg);R3.applyTOD(cfg.tod);R3.setFog(G.fog);WX.apply(G.wx);R3.setMode('tower');this.setCamBtn('tower');
  $('start').hidden=true;$('over').hidden=true;this.running=true;this.speed=1;this.setSpeed(1);this.syncSettings();this.voiceStatus();
  MAPV.fit();this.resize();$('cmd').focus();
 },
 onOver(o){
  setTimeout(()=>{
   const s=G.stats;$('o-title').textContent=o.kind==='accident'?'ACCIDENT':o.kind==='licence'?'LICENCE SUSPENDED':'SHIFT COMPLETE';
   $('over').classList.toggle('bad',o.kind!=='shift');$('o-reason').textContent=o.reason;
   $('o-stats').innerHTML=[['Score',Math.round(G.score)],['Safety rating',G.safety],['Departures',s.dep],['Arrivals',s.arr],['Go-arounds',s.goArounds],['Runway incursions',s.incursion||0],['Separation losses',s.los||0],['Emergencies handled',s.emerg||0],['Read-back errors missed',s.readback||0],['Shift length',this.clockStr(G.t)]].map(r=>'<div><span>'+r[0]+'</span><b>'+r[1]+'</b></div>').join('')+(()=>{const A=[],n=(s.arr||0)+(s.dep||0);if((s.greasers||0)>=2)A.push(['Silk Touch',s.greasers+' perfect landings']);if(!s.goArounds&&(s.arr||0)>=4)A.push(['Clean Sheet','no go-arounds']);if(!s.los&&!s.incursion&&n>=8)A.push(['Spotless Separation','no conflicts']);if((s.emerg||0)>=3)A.push(['Crisis Manager',s.emerg+' emergencies']);if(s.hijack)A.push(['Cool Head','hijack resolved']);if(s.wildlife)A.push(['Wildlife Warden',s.wildlife+' runway sweeps']);if(n>=25)A.push(['Busy Bee',n+' movements']);if((s.ryr||0)>=2)A.push(['Ryanair Survivor',s.ryr+' bouncy landings']);if((s.courtesy||0)>=4)A.push(['Friendly Voice',s.courtesy+' pleasantries']);if(G.safety>=95&&n>=10)A.push(['Safe Hands','safety '+G.safety]);return A.length?'<div class="awd"><span>Awards</span>'+A.map(x=>'<i title="'+x[1]+'">★ '+x[0]+'</i>').join('')+'</div>':'';})();
   const gr=o.kind==='shift'?(G.safety>=85&&G.score>1200?'S':G.safety>=70?'A':G.safety>=50?'B':'C'):'—';$('o-grade').textContent=gr;
   $('over').hidden=false;
  },o.kind==='accident'?7500:600);
 },
 /* ---------- events ---------- */
 onSay(e){
  this.appendLog(e);
  if(e.who==='pilot'&&e.ent){const len=Math.min(9,1.2+e.text.length*0.055);this.talk={id:e.ent.id,until:Math.max((G.radioFree||0),G.t+len)};}
  if(e.who==='pilot'&&Voice.on&&this.speed>0&&!(this.speed>=4&&!e.urgent)){if(e.ent&&e.ent.req&&!e.ent.veh)e.ent.req.hold=G.t||0.001;Voice.speak(e);}
  if(e.who==='pilot'&&e.ent&&e.ent.req&&!this.sel&&e.ent.id){this.select(e.ent.id,true);}
 },
 sysLine(t,sev){this.appendLog({who:'sys',text:t,sev:sev||'ok',clock:G.clock,cs:''});},
 appendLog(e){
  const box=$('log');const d=document.createElement('div');d.className='ll '+e.who+(e.sev?' '+e.sev:'');
  const un=e.ent?this.unitOf(e.ent):'TWR';
  const who=e.who==='pilot'?(e.ent?'<a data-id="'+e.ent.id+'">'+esc(e.ent.cs)+'</a>':'PILOT'):e.who==='atc'?AIRPORT.icao+'_'+un:'***';
  d.innerHTML='<time>['+this.clockStr(e.clock||G.clock)+']</time><b>'+who+(e.who==='sys'?'':':')+'</b><span>'+(e.who==='atc'&&e.ent?'<i style="font-style:normal;opacity:.7">→'+esc(e.ent.cs)+'</i> ':'')+esc(e.text)+'</span>';
  const stick=box.scrollTop+box.clientHeight>=box.scrollHeight-40;box.appendChild(d);if(++this.logN>260){box.removeChild(box.firstChild);}if(stick)box.scrollTop=box.scrollHeight;
 },
 banner(t,k){const b=$('banner');b.textContent=t;b.className='banner '+(k||'')+' show';clearTimeout(this._bt);this._bt=setTimeout(()=>b.classList.remove('show'),6500);if(k==='bad')this.alarm(true);},
 toast(t,k){const b=$('toast');b.textContent=t;b.className='toast show '+(k||'');clearTimeout(this._tt);this._tt=setTimeout(()=>b.classList.remove('show'),3600);},
 alarm(soft){
  const c=Voice.ensureCtx();if(!c||Voice.vol<=0)return;
  const o=c.createOscillator(),g=c.createGain();o.type='square';o.frequency.value=soft?520:300;g.gain.value=soft?0.05:0.09;o.connect(g);g.connect(c.destination);
  const t=c.currentTime;g.gain.setValueAtTime(g.gain.value,t);g.gain.exponentialRampToValueAtTime(0.0001,t+(soft?0.35:0.9));o.start(t);o.stop(t+(soft?0.4:1));
 },
 /* ---------- selection / commands ---------- */
 select(id,quiet){
  this.sel=id;R3.sel=id;MAPV.sel=id;this.renderSel();this.renderStrips(true);
  const a=G.ents.find(e=>e.id===id);$('cmd-for').textContent=a?(a.veh?a.rt:csName(a)):'no aircraft';
  const el=document.querySelector('.strip[data-id="'+id+'"]');if(el&&!quiet)el.scrollIntoView({block:'nearest'});
  if(R3.cam.mode==='follow'){}
 },
 selAc(){return G.ents.find(e=>e.id===this.sel&&!e.dead)||null;},
 answer(kind){
  const a=this.selAc();if(!a)return;const r=buildReplies(a);if(!r){this.toast('No pending request — use the quick commands.','');return;}
  command(r[kind],a.id);this.renderSel();
 },
 submit(){
  const inp=$('cmd');const t=inp.value.trim();if(!t)return;
  const br=/\[[^\]]+\]/.exec(t);if(br){inp.focus();inp.setSelectionRange(br.index,br.index+br[0].length);this.toast('Replace '+br[0]+' with the real detail before sending.','warn');return;}
  Voice.ensureCtx();this.txUntil=performance.now()+Math.min(5000,900+t.length*55);
  const ok=command(t,this.sel);inp.value='';this.renderSel();
  if(ok===false&&!this.selAc())this.toast('Select an aircraft first (or start with its callsign).','warn');
 },
 sendText(text){command(text,this.sel);this.renderSel();},
 /* ---------- loop ---------- */
 loop(ts){
  const dt=Math.min(0.1,(ts-(this.last||ts))/1000);this.last=ts;const t=ts/1000;
  if(this.running){
   if(this.speed>0&&!G.over){let rem=dt*this.speed;while(rem>0){const s=Math.min(0.1,rem);step(s);rem-=s;}}
   this.uiAcc+=dt;if(this.uiAcc>0.25){this.uiAcc=0;this.syncTop();this.renderStrips();this.renderSel(true);}
   this.markTalking();this.radioLights();
   if(this.glOK&&$('v3d').offsetParent!==null)R3.sync(dt,t);
   if($('vmap').offsetParent!==null)MAPV.draw(t);
  }else{
   if(this.glOK&&G.ents&&$('v3d').offsetParent!==null)R3.sync(dt,t);
   if(G.ents&&$('vmap').offsetParent!==null)MAPV.draw(t);
  }
  requestAnimationFrame(x=>this.loop(x));
 },
 setSpeed(n){this.speed=n;document.querySelectorAll('#speed button').forEach(b=>b.classList.toggle('on',+b.dataset.s===n));},
 syncTop(){
  if(!G.cfg)return;
  $('t-clock').textContent=this.clockStr(G.clock);$('t-atis').textContent='ATIS '+ATIS_L[G.atis].toUpperCase();
  $('t-score').textContent=Math.round(G.score);const sf=$('t-safe');sf.style.width=G.safety+'%';sf.parentElement.classList.toggle('low',G.safety<45);$('t-safen').textContent=G.safety;
  const left=Math.max(0,G.cfg.shift*60-G.t);$('t-left').textContent=this.clockStr(left).slice(3);
  const rb=$('rwybtn');rb.textContent='RWY '+RWD()+(G.rwyBetter?'  ▸ '+rwLabel(G.rwyBetter)+' advised':'');rb.classList.toggle('adv',!!G.rwyBetter);
  {const w=G.wind;let wd=Math.round(WDM(w)/10)*10%360;if(wd===0)wd=360;const ws=pad(wd,3)+'/'+Math.round(w.spd);$('t-wx').textContent=ws+'kt  QNH '+G.qnh;$('cab-wind').textContent=ws;$('cab-qnh').textContent=G.qnh;$('cab-rwy').textContent=RWD();$('cab-vis').textContent=G.fog?'800 M':'10 KM';$('cab-time').textContent=this.clockStr(G.clock).slice(0,5);$('conn').textContent='CONNECTED · '+AIRPORT.icao+'_TWR · RWY '+RWD();$('conn-led').classList.add('on');if(!$('atis-pop').hidden)$('atis-pop').innerHTML=this.atisText();}
  const q=G.ents.filter(e=>e.req&&!e.dead).length;$('t-req').textContent=q;$('t-req').parentElement.classList.toggle('hot',q>0);
 },
 /* ---------- strips ---------- */
 statusText(a){
  if(a.veh)return MAPV.phaseText(a);
  const q=a.req?PH[a.req.kind].title:'';
  return a.req?q:MAPV.phaseText(a);
 },
 unitOf(a){
  if(!a)return'TWR';if(a.veh)return'GND';if(a.vis)return'TWR';
  if(a.req&&a.req.kind&&PH[a.req.kind]&&PH[a.req.kind].unit&&UNITS[PH[a.req.kind].unit])return PH[a.req.kind].unit;
  if(a.unit&&UNITS[a.unit]&&a.unit!=='OPS')return a.unit;
  const p=a.phase;
  if(p==='BOARDING'||p==='AT_GATE')return'DEL';
  if(['PUSHBACK','PUSH_TURN','TAXI','HOLDING','STOPPED','VACATED','PARKING','STAND_IN'].includes(p))return'GND';
  if(a.kind==='dep'&&a.y>300&&a.handed)return'DEP';
  return'TWR';
 },
 radioLights(){
  const tk=this.talkingId(),ta=tk?G.ents.find(e=>e.id===tk):null,ru=ta?this.unitOf(ta):'';
  const tx=(typeof Mic!=='undefined'&&(Mic.active||Mic.starting))||(this.txUntil&&performance.now()<this.txUntil);
  const su=this.sel?this.unitOf(this.selAc()):'';
  ['DEL','GND','TWR','DEP'].forEach(k=>{const el=$('rp-'+k);if(!el)return;el.classList.toggle('rx-on',ru===k);el.classList.toggle('tx-on',!!tx&&su===k);el.classList.toggle('act',su===k);});
  const cf=$('cmd-freq');if(cf){const a=this.selAc();const un=a?this.unitOf(a):'';cf.textContent=a?('TX '+un+' '+UNITS[un].f):'TX —';}
 },
 atisText(){
  const w=G.wind;let wd=Math.round(WDM(w)/10)*10%360;if(wd===0)wd=360;
  return '<b>'+AIRPORT.icao+' INFORMATION '+ATIS_L[G.atis].toUpperCase()+'</b>  '+this.clockStr(G.clock).slice(0,5).replace(':','')+'Z\n'+((G.wx&&G.wx!=='clear')?'WEATHER '+WX_NAMES[G.wx]+'\n':'')+(G.fog?'LOW VISIBILITY PROCEDURES IN OPERATION\n':'')+(G.fly?'FLYPAST RWY '+RWD()+' AT '+clkF(G.fly.t0)+'Z — RUNWAY CLOSED '+clkF(G.fly.t0-45)+'Z–'+clkF(G.fly.t0+40)+'Z\n':'')+(G.v&&G.v.open?'AIRPORT OPEN DAY: EXTRA HELICOPTER / LIGHT AIRCRAFT TRAFFIC\n':'')+(G.cell&&G.cell.near?'CB OVERHEAD OR NEAR FIELD, LIGHTNING WITHIN 5 MILES, RAMP CLOSED\n':G.cell?'CB APPROACHING FROM THE '+compassOf(-G.cell.vx,-G.cell.vz).toUpperCase()+'\n':'')+'RUNWAY IN USE '+RWD()+'\nWIND '+pad(wd,3)+' DEGREES '+Math.round(w.spd)+' KNOTS\nVISIBILITY '+(G.fog?'800 METRES, FOG':'10 KILOMETRES OR MORE')+'\nQNH '+G.qnh+'\nTRANSITION LEVEL 60\n<b>ACKNOWLEDGE INFORMATION '+ATIS_L[G.atis].toUpperCase()+' ON FIRST CONTACT.</b>';
 },
 talkingId(){
  if(typeof Voice!=='undefined'&&Voice.on&&Voice.now&&Voice.now.ent&&Voice.now.who==='pilot')return Voice.now.ent.id;
  if(typeof Voice!=='undefined'&&Voice.on&&(Voice.busy||Voice.queue.length))return 0;
  return(this.talk&&G.t<this.talk.until)?this.talk.id:0;
 },
 markTalking(){
  const id=this.talkingId();if(id===this._tk)return;this._tk=id;
  document.querySelectorAll('#strips .strip').forEach(el=>el.classList.toggle('talking',+el.dataset.id===id));
  const ps=$('p-strips');if(ps)ps.classList.toggle('tk',!!id);const t=$('talk-ind');if(t){const e=id&&G.ents.find(x=>x.id===id);t.hidden=!e;if(e)t.textContent='● '+(e.veh?e.rt:csName(e))+' transmitting';}
 },
 bayOf(e){const k=e.veh?'GND':this.unitOf(e);return k;},
 renderStrips(force){
  const L=G.ents.filter(e=>!e.dead&&e.phase!=='REMOVED'&&!e.hidden);
  const rank=e=>(e.req?(PH[e.req.kind].urgent?0:1):e.err?2:e.emerg?2:e.nordo?2:3)+(e.veh?1:0);
  const BO={TWR:0,DEP:1,GND:2,DEL:3},BN={TWR:'Tower · runway / final',DEP:'Departure',GND:'Ground · apron / taxi',DEL:'Delivery · clearances'};
  L.sort((a,b)=>BO[this.bayOf(a)]-BO[this.bayOf(b)]||rank(a)-rank(b)||(a.req&&b.req?a.req.t-b.req.t:0)||a.id-b.id);
  const sig=L.map(e=>e.id+':'+(e.req?e.req.kind:'')+e.phase+this.bayOf(e)+(e.id===this.sel?'*':'')+(e.nordo?'n':'')+(e.emerg||'')+(e.err&&G.cfg.assist?'e':'')).join('|');
  const box=$('strips');
  if(!force&&sig===this._sig){ // update timers only
   box.querySelectorAll('.strip').forEach(el=>{const e=G.ents.find(x=>x.id===+el.dataset.id);if(!e)return;const w=el.querySelector('.wait');if(w)w.style.width=e.req?Math.min(100,(G.t-e.req.t)/50*100)+'%':'0';const sp=el.querySelector('.st');if(sp)sp.textContent=this.statusText(e);});
   return;
  }
  this._sig=sig;box.innerHTML='';
  if(!L.length){box.innerHTML='<div class="empty">No strips on the board. Aircraft call you as they become ready.</div>';return;}
  let lastBay='';
  for(const e of L){
   const bay=this.bayOf(e);
   if(bay!==lastBay){lastBay=bay;const n=L.filter(x=>this.bayOf(x)===bay).length;const h=document.createElement('div');h.className='bay';h.innerHTML='<span>'+BN[bay]+'</span><em>'+UNITS[bay].f+' · '+n+'</em>';box.appendChild(h);}
   const d=document.createElement('div');
   d.className='strip '+(e.veh?'veh':e.kind)+(e.id===this.sel?' sel':'')+(e.req?' req':'')+(e.req&&PH[e.req.kind].urgent||e.emerg||e.nordo?' emg':'');
   d.dataset.id=e.id;
   const dest=e.veh?'Airfield ops':e.kind==='dep'?(e.dest?e.dest.n:''):('ILS '+RWD()+(e.gate?' · stand '+e.gate:''));
   d.innerHTML='<i class="bar"></i><div class="c1"><b>'+esc(e.veh?e.rt:e.cs)+(e.heavy?'<em>H</em>':'')+'</b><span>'+esc(e.veh?'':e.type.n)+'</span></div><div class="c2"><span class="st">'+esc(this.statusText(e))+'</span><span class="dst">'+esc(dest)+'</span></div><div class="c3"><span class="sq'+(e.sqBad?' bad':'')+'">'+(e.squawk||'')+'</span>'+(e.err&&G.cfg.assist?'<span class="warn" title="Read-back differs from your instruction">⚠ RB</span>':'')+(e.nordo?'<span class="warn">NORDO</span>':'')+'</div><u class="wait" style="width:'+(e.req?Math.min(100,(G.t-e.req.t)/50*100):0)+'%"></u>';
   d.addEventListener('click',()=>this.select(e.id));box.appendChild(d);
  }
  this._tk=-1;this.markTalking();
 },
 /* ---------- selected panel ---------- */
 fpProg(a){
  if(a.veh)return 0;
  if(a.kind==='dep')return a.y>10?Math.min(1,0.12+a.y/1800*0.88):(a.phase==='ROLL'||a.phase==='ON_RWY'||a.phase==='LINEUP'?0.08:0.02);
  return a.D>0?Math.max(0.05,1-Math.min(1,a.D/(9*NM))):1;
 },
 fpCard(a){
  if(a.veh)return '<div class="fp"><div class="fp-top"><b>'+esc(a.rt)+'</b><small>AIRFIELD VEHICLE</small><span class="ph2 gnd">'+esc(MAPV.phaseText(a))+'</span></div></div>';
  if(!a.from)a.from=DESTS[a.id%DESTS.length].c;
  const org=a.kind==='dep'?AIRPORT.icao:a.from,dst=a.kind==='dep'?(a.dest?a.dest.c:'----'):AIRPORT.icao;
  const cls=(a.emerg||a.nordo)?'emg':a.req?'req':(a.y>10?'':'gnd');
  const gs=Math.round(a.v/KT),alt=a.y>10?Math.round(a.y*FT/10)*10:0;
  return '<div class="fp"><div class="fp-top"><b>'+esc(csName(a))+'</b><small>'+esc(a.type.n+' · '+(a.heavy?'H':'M')+' · '+a.al.icao)+'</small><span class="ph2 '+cls+'" id="fp-ph">'+esc(a.emerg?String(a.emerg).toUpperCase():a.req?'CALLING':a.y>10?(a.kind==='dep'?'DEPARTING':'ARRIVING'):'ON GROUND')+'</span></div>'+
   '<div class="fp-route"><span>'+org+'</span><i><u id="fp-prog" style="width:'+Math.round(this.fpProg(a)*100)+'%"></u></i><span>'+dst+'</span></div>'+
   '<div class="fp-stats"><div><small>Speed</small><b id="fp-spd">'+gs+' kt</b></div><div><small>Altitude</small><b id="fp-alt">'+(alt?alt.toLocaleString('en-GB')+' ft':'GND')+'</b></div><div><small>'+(a.kind==='arr'&&a.D>0?'To go':'Squawk')+'</small><b id="fp-x">'+(a.kind==='arr'&&a.D>0?(a.D/NM).toFixed(1)+' nm':(a.squawk||'—'))+'</b></div></div>'+(a.slot&&!a.slotDone?'<div class="fp-slot" style="margin:6px 2px 0;padding:5px 8px;border:1px solid #8a6d1f;border-radius:5px;color:#f0c050;font:600 11px JetBrains Mono,monospace;letter-spacing:.04em">'+slotText(a)+'</div>':'')+'</div>';
 },
 fpLive(a){
  const s=$('fp-spd');if(!s||a.veh)return;s.textContent=Math.round(a.v/KT)+' kt';const al=a.y>10?Math.round(a.y*FT/10)*10:0;$('fp-alt').textContent=al?al.toLocaleString('en-GB')+' ft':'GND';
  $('fp-x').textContent=a.kind==='arr'&&a.D>0?(a.D/NM).toFixed(1)+' nm':(a.squawk||'—');const pg=$('fp-prog');if(pg)pg.style.width=Math.round(this.fpProg(a)*100)+'%';
 },
 renderSel(soft){
  const a=this.selAc(),box=$('sel');
  if(!a){box.innerHTML='<div class="empty">Select a strip, a map label or a plane.<br><span>Keys: <kbd>Tab</kbd> next request · <kbd>1</kbd> accept · <kbd>2</kbd> deny · <kbd>3</kbd> wait · <kbd>M</kbd> manual · hold <kbd>Space</kbd> to talk</span></div>';this._selSig='';return;}
  const r=buildReplies(a);const ql=quickCmds(a);
  const sig=a.id+'|'+(a.req?a.req.kind+a.req.t:'')+'|'+a.phase+'|'+(a.err?1:0)+'|'+(a.paused?1:0)+'|'+(a.nordo?1:0)+ql.length;
  if(soft&&sig===this._selSig){const f=$('sel-fuel');if(f&&a.kind==='arr')f.textContent=Math.max(0,a.fuel).toFixed(0)+' min';const h=$('sel-live');if(h)h.textContent=this.liveText(a);this.fpLive(a);return;}
  this._selSig=sig;
  let h=this.fpCard(a);
  if(!a.veh){h+='<dl class="s-info"><div><dt>Squawk</dt><dd class="'+(a.sqBad?'bad':'')+'">'+(a.squawk||'—')+'</dd></div><div><dt>'+(a.kind==='dep'?'Destination':'Approach')+'</dt><dd>'+(a.kind==='dep'?esc(a.dest.n+' · '+a.dest.sid):'ILS RWY '+RWD())+'</dd></div><div><dt>Stand</dt><dd>'+(a.gate||'—')+'</dd></div><div><dt>Now</dt><dd id="sel-live">'+esc(this.liveText(a))+'</dd></div>'+(a.kind==='arr'?'<div><dt>Fuel</dt><dd id="sel-fuel">'+Math.max(0,a.fuel).toFixed(0)+' min</dd></div>':'')+'</dl>';}
  if(a.req){
   h+='<div class="s-req'+(r&&r.urgent?' urgent':'')+'"><small>'+esc(PH[a.req.kind].title)+(r&&r.urgent?' · URGENT':'')+'</small>';
   const lastP=[...G.log].reverse().find(l=>l.who==='pilot'&&l.ent===a);if(lastP)h+='<p>“'+esc(lastP.text)+'”</p>';
   h+='<div class="trio"><button class="b-acc" data-ans="accept"><kbd>1</kbd> '+((r&&r.labels&&r.labels.accept)||'ACCEPT')+'</button><button class="b-den" data-ans="deny"><kbd>2</kbd> '+((r&&r.labels&&r.labels.deny)||'DENY')+'</button><button class="b-wait" data-ans="wait"><kbd>3</kbd> '+((r&&r.labels&&r.labels.wait)||'WAIT')+'</button></div><div class="prev" id="prev">Hover a button to see the exact phrase you will transmit.</div></div>';
  }else h+='<div class="s-req none"><small>No pending request from this aircraft</small></div>';
  if(a.nordo)h+='<div class="s-light"><small>No radio — use the light gun</small><button data-light="green" class="lg g">STEADY GREEN</button><button data-light="red" class="lg r">STEADY RED</button><button data-light="white" class="lg w">FLASHING WHITE</button></div>';
  h+='<div class="s-quick">'+ql.map((q,i)=>'<button data-q="'+i+'"'+(q.hot?' class="hot"':'')+'>'+esc(q.label)+'</button>').join('')+'</div>';
  box.innerHTML=h;
  box.querySelectorAll('[data-ans]').forEach(b=>{b.addEventListener('click',()=>this.answer(b.dataset.ans));
   const show=()=>{const rr=buildReplies(a);if(rr)$('prev').innerHTML='<b>'+b.dataset.ans.toUpperCase()+'</b> '+esc(rr[b.dataset.ans]);};b.addEventListener('mouseenter',show);b.addEventListener('focus',show);});
  box.querySelectorAll('[data-q]').forEach(b=>b.addEventListener('click',()=>{this.sendText(ql[+b.dataset.q].text);}));
  box.querySelectorAll('[data-light]').forEach(b=>b.addEventListener('click',()=>{setLight(a.id,b.dataset.light);}));
 },
 liveText(a){
  if(a.veh)return MAPV.phaseText(a);
  const alt=a.y>10?Math.round(a.y*FT/10)*10+' ft':'';return MAPV.phaseText(a)+(alt?' · '+alt:'')+(a.v>0.5?' · '+Math.round(a.v/KT)+' kt':'');
 },
 nextReq(){
  const L=G.ents.filter(e=>!e.dead&&e.req).sort((a,b)=>(PH[b.req.kind].urgent?1:0)-(PH[a.req.kind].urgent?1:0)||a.req.t-b.req.t);
  if(!L.length){this.toast('No pending requests.','');return;}
  const i=L.findIndex(e=>e.id===this.sel);this.select(L[(i+1)%L.length].id);
 },
 /* ---------- camera + layout ---------- */
 setCamBtn(m){$('v3d').classList.toggle('cab-on',m==='tower');document.querySelectorAll('#camtools button').forEach(b=>b.classList.toggle('on',b.dataset.cam===m));},
 setLayout(l){this.layout=l;$('views').className='lay-'+l;document.querySelectorAll('#layout button').forEach(b=>b.classList.toggle('on',b.dataset.l===l));setTimeout(()=>this.resize(),30);},
 /* ---------- settings ---------- */
 /* ---- UI layout presets ---- */
 PRESETS:[
  {id:'classic',name:'Classic',d:'Views left, strips / flight plan / messages in a column on the right.',b:[['v3d',0,0,60,56],['map',0,56,60,44],['str',62,0,38,34],['fp',62,35,38,30],['msg',62,66,38,34]]},
  {id:'left',name:'Left column',d:'Same panels, but the column is on the left (good if your right hand is on the mouse).',b:[['str',0,0,38,34],['fp',0,35,38,30],['msg',0,66,38,34],['v3d',40,0,60,56],['map',40,56,60,44]]},
  {id:'dock',name:'Bottom dock',d:'Big views on top, the three panels side by side along the bottom.',b:[['v3d',0,0,50,66],['map',51,0,49,66],['str',0,68,33,32],['fp',34,68,32,32],['msg',67,68,33,32]]},
  {id:'top',name:'Strip bar on top',d:'Panels along the top like a strip rack, views below.',b:[['str',0,0,33,30],['fp',34,0,32,30],['msg',67,0,33,30],['v3d',0,32,50,68],['map',51,32,49,68]]},
  {id:'wide',name:'Wide comms',d:'Wider right column for long strips and the radio log.',b:[['v3d',0,0,48,56],['map',0,56,48,44],['str',50,0,50,34],['fp',50,35,50,30],['msg',50,66,50,34]]},
  {id:'slim',name:'Big picture',d:'Slim right column, as much screen as possible for the 3D view and radar.',b:[['v3d',0,0,74,56],['map',0,56,74,44],['str',76,0,24,34],['fp',76,35,24,30],['msg',76,66,24,34]]},
  {id:'sbs',name:'Side-by-side',d:'3D view and radar next to each other, panels on the right.',b:[['v3d',0,0,30,100],['map',31,0,30,100],['str',62,0,38,34],['fp',62,35,38,30],['msg',62,66,38,34]]}
 ],
 presetSvg(b){const col={v3d:['#3b6ea5','3D'],map:['#050505','RADAR'],str:['#e6dcc0','STRIPS'],fp:['#eeeeee','PLAN'],msg:['#101010','MSGS']};
  return '<svg viewBox="0 0 100 62" width="100%" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="62" fill="#2a2a2a"/>'+b.map(([k,x,y,w,h])=>{const X=1+x*0.98,Y=1+y*0.56,W=w*0.98-1,H=h*0.56-1,c=col[k];
   return '<rect x="'+X.toFixed(1)+'" y="'+Y.toFixed(1)+'" width="'+W.toFixed(1)+'" height="'+H.toFixed(1)+'" fill="'+c[0]+'" stroke="#c0c0c0" stroke-width=".7"/>'+(k==='map'?'<circle cx="'+(X+W/2).toFixed(1)+'" cy="'+(Y+H/2).toFixed(1)+'" r="'+Math.min(W,H)*0.28+'" fill="none" stroke="#00b8d4" stroke-width=".5"/><circle cx="'+(X+W*0.6).toFixed(1)+'" cy="'+(Y+H*0.4).toFixed(1)+'" r="1.1" fill="#3be83b"/>':'')+'<text x="'+(X+W/2).toFixed(1)+'" y="'+(Y+H/2+2).toFixed(1)+'" font-size="'+Math.min(6,W/3.2).toFixed(1)+'" text-anchor="middle" font-family="Tahoma,Arial" fill="'+(k==='str'||k==='fp'?'#222':'#e8e8e8')+'">'+c[1]+'</text>';}).join('')+'<rect x="1" y="59" width="98" height="2" fill="#c0c0c0"/></svg>';},
 buildPresets(){const el=$('ui-presets');if(!el)return;
  el.innerHTML=this.PRESETS.map(p=>'<button type="button" class="pre" data-ui="'+p.id+'" title="'+p.d+'">'+this.presetSvg(p.b)+'<b>'+p.name+'</b><small>'+p.d+'</small></button>').join('');
  el.addEventListener('click',e=>{const b=e.target.closest('.pre');if(b)this.applyLayout(b.dataset.ui,true);});},
 applyLayout(id,save){if(!this.PRESETS.some(p=>p.id===id))id='classic';document.body.dataset.ui=id;
  document.querySelectorAll('#ui-presets .pre').forEach(b=>b.classList.toggle('on',b.dataset.ui===id));
  if(save){try{localStorage.setItem('marlow.ui',id);}catch(e){}}
  setTimeout(()=>{try{this.resize();}catch(e){}},30);setTimeout(()=>{try{this.resize();}catch(e){}},300);},
 syncSettings(){
  $('k-key').value=Voice.key||'';$('k-model').value=Voice.model;$('k-gem').checked=Voice.gemini;$('k-voice').checked=Voice.on;$('k-fb').checked=Voice.fallback;$('k-fx').checked=Voice.fx;$('k-style').checked=Voice.styleOn;$('k-vol').value=Voice.vol;$('k-mic').checked=Voice.micOn;
  if(G.cfg){$('k-assist').checked=!!G.cfg.assist;}
 },
 saveSettings(){
  Voice.key=$('k-key').value.trim();Voice.model=$('k-model').value.trim()||'gemini-3.8-flash-tts';Voice.gemini=$('k-gem').checked;Voice.on=$('k-voice').checked;Voice.fallback=$('k-fb').checked;Voice.fx=$('k-fx').checked;Voice.styleOn=$('k-style').checked;Voice.vol=+$('k-vol').value;Voice.micOn=$('k-mic').checked;Voice.fails=0;Voice.save();
  if(G.cfg)G.cfg.assist=$('k-assist').checked;this.voiceStatus();
 },
 voiceStatus(){
  const s=$('v-stat');if(!s)return;
  let t='Browser voices',c='';
  if(!Voice.on){t='Voice off';c='off';}
  else if(Voice.gemini&&Voice.key){if(Voice.status==='error'){t='Gemini error → browser voices';c='warn';}else if(Voice.status==='gemini'){t='Gemini voices · '+Voice.nGemini+' lines';c='ok';}else{t='Gemini ready';c='ok';}}
  s.textContent=t;s.className='vstat '+c;
 },
 /* ---------- manual ---------- */
 buildManual(){
  const body=$('m-body');const frag=document.createDocumentFragment();
  const TIP={'CALLSIGN':'The aircraft you are talking to, exactly as on its strip, e.g. "Speedbird 452".','STAND':'Parking stand.','STAND NUMBER':'Parking stand 1 to 6 on the apron (numbered squares on the map). Shown in the selected-aircraft panel.','DESTINATION':'The city the flight is going to (selected-aircraft panel), e.g. Frankfurt.','SID NAME':'Name of the departure route the aircraft will fly after takeoff, e.g. "Rosel Two Alpha". Hover the Accept button for the exact name.','SQUAWK':'4-digit transponder code you give the pilot. Any digits 0 to 7 not already used (never 7500/7600/7700).','ALTITUDE':'Initial climb altitude in feet. Use 5000.','QNH':'Local pressure setting, from the ATIS chip in the top bar, e.g. 1013.','ATIS LETTER':'Letter of the current weather broadcast (top bar), e.g. Bravo.','RUNWAY':'Runway in use: 09 or 27 (RWY button, top bar).','HOLDING POINT':'Where the aircraft stops short of the runway: Bravo, Charlie, Delta or Echo (map, HP markers).','TAXIWAY ROUTE':'The taxiway names to follow, in order, e.g. "Golf, Alpha". Hover Accept to see the exact route for this aircraft.','WIND DIR':'Wind direction in degrees, from the ATIS chip, e.g. 080.','WIND SPEED':'Wind speed in knots, from the ATIS chip.','MILES':'Distance from the runway in nautical miles (map data block).','DIRECTION':'Compass direction the aircraft should face after pushback: east or west.','FREQUENCY':'Radio frequency, e.g. Departure 119.500.','NUMBER':'Landing sequence number, e.g. 2.','EXIT':'Taxiway the aircraft vacates onto, e.g. Delta.','SPEED':'Airspeed in knots.','INSTRUCTION':'The instruction to read out, e.g. line up and wait.','MORNING/AFTERNOON/EVENING':'Time of day greeting.'};
  const hl=s=>esc(s).replace(/\[([^\]]+)\]/g,(m,k)=>'<span class="ph" title="'+esc(TIP[k]||'Fill in the real value.')+'">'+m+'</span>');
  const unitName=k=>(UNITS[k]&&UNITS[k].n)||AIRPORT.short+' Tower';
  const S=SAMPLE;const f=t=>fmt(t,S);
  const phCard=(k,ph)=>{const f=t=>fmt(t,Object.assign({},SAMPLE,{unit:unitName(ph.unit)}));
   const d=document.createElement('article');d.className='mc';d.dataset.cat=ph.cat;d.dataset.k=k;
   const rows=[['accept','ACCEPT','b-acc'],['deny','DENY','b-den'],['wait','WAIT','b-wait']];
   d.innerHTML='<header><span class="chip">'+esc(ph.cat)+'</span>'+(ph.urgent?'<span class="chip red">Emergency</span>':'')+'<h3>'+esc(ph.title)+'</h3></header><p class="when">'+esc(ph.when)+'</p>'+
    '<div class="say"><b>PILOT SAYS</b>'+ph.pilot.map(p=>'<q>'+hl(f(p))+'</q>').join('')+'</div>'+
    '<div class="trio3">'+rows.map(([w,l,c])=>'<div class="'+c+'"><b>'+l+'</b><q>'+hl(f(ph[w]))+'</q><small>Pilot: '+hl(f(ph['rb'+w[0].toUpperCase()+w.slice(1)]||''))+'</small><button class="use" data-t="'+esc(ph[w])+'">Insert</button></div>').join('')+'</div>'+
    '<p class="note">'+esc(ph.note)+'</p>';
   d.dataset.text=(ph.cat+' '+ph.title+' '+ph.when+' '+ph.pilot.join(' ')+' '+ph.accept+' '+ph.deny+' '+ph.wait+' '+(ph.rbAccept||'')+' '+ph.note+' '+k).toLowerCase();return d;
  };
  Object.keys(PH).forEach(k=>frag.appendChild(phCard(k,PH[k])));
  if(!$('m-live')){const lv=document.createElement('section');lv.id='m-live';body.parentNode.insertBefore(lv,body);}
  INSTR.forEach(i=>{const d=document.createElement('article');d.className='mc';d.dataset.cat=i.cat;
   d.innerHTML='<header><span class="chip">Instructions</span><h3>'+esc(i.title)+'</h3></header><div class="trio3 one"><div class="b-acc"><b>YOU SAY</b><q>'+hl(fmt(i.atc,Object.assign({},SAMPLE,{instr:'line up and wait',sq:'4521'})))+'</q><small>Pilot: '+hl(fmt(i.rb,SAMPLE))+'</small><button class="use" data-t="'+esc(i.atc)+'">Insert</button></div></div><p class="note">'+esc(i.note)+'</p>';
   d.dataset.text=('instructions '+i.title+' '+i.atc+' '+i.rb+' '+i.note).toLowerCase();frag.appendChild(d);});
  MAN_EXTRA.forEach(x=>{const d=document.createElement('article');d.className='mc ref';d.dataset.cat=x.cat;d.innerHTML='<header><span class="chip">Reference</span><h3>'+esc(x.title)+'</h3></header><div class="refbody">'+x.html+'</div>';d.dataset.text=(x.cat+' '+x.title+' '+x.tags+' '+x.html.replace(/<[^>]+>/g,' ')).toLowerCase();frag.appendChild(d);});
  body.appendChild(frag);
  body.addEventListener('click',e=>{const b=e.target.closest('.use');if(!b)return;const a=this.selAc();
   let vals=Object.assign({},SAMPLE);
   try{const un=a&&a.unit&&UNITS[a.unit]?UNITS[a.unit].n:null;const v=V(a&&!a.veh?a:null,un?{unit:un}:{});for(const k in v){if(v[k]!==''&&v[k]!==undefined&&v[k]!==null)vals[k]=String(v[k]);}}catch(err){}
   vals.cs=a?(a.veh?a.rt:csName(a)):SAMPLE.cs;if(G.rwy)vals.rwy=RWD();
   if(vals.hs&&vals.hs.indexOf('[')<0)vals.hs=', hold short of runway '+vals.rwy;
   let t=b.dataset.t.replace(/\{cs\}/g,vals.cs);t=fmt(t,vals);$('cmd').value=t;if(!this.docked())this.closeManual();$('cmd').focus();
   const m=/\[[^\]]+\]/.exec(t);if(m){$('cmd').setSelectionRange(m.index,m.index+m[0].length);this.toast('Replace the [BRACKETS] with the real details before sending.','warn');}});
  $('m-live').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const t=b.dataset.t;$('cmd').value=t;if(b.classList.contains('send2')){this.submit();}else{$('cmd').focus();}if(!this.docked())this.closeManual();});
  const cats=['All','Delivery','Ground','Tower','Emergency','Instructions','Reference'];
  $('m-cats').innerHTML=cats.map((c,i)=>'<button data-c="'+c+'"'+(i?'':' class="on"')+'>'+c+'</button>').join('');
  $('m-cats').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;this.mcat=b.dataset.c;$('m-cats').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));this.filterManual();});
  $('m-q').addEventListener('input',()=>this.filterManual());this.mcat='All';
 },

 renderLive(){
  const box=$('m-live');if(!box||$('manual').hidden)return;
  const a=this.selAc();let h='';
  if(!a){h='<div class="lv-h">FOR YOUR AIRCRAFT</div><p class="lv-none">Select an aircraft (click a strip or press <kbd>Tab</kbd>) and this box shows <b>exactly what to say</b>, already filled in with its real callsign, runway, route and squawk.</p>';}
  else{
   const name=a.veh?a.rt:csName(a);let R=null;try{R=a.req?buildReplies(a):null;}catch(e){}
   let said='';for(let i=G.log.length-1;i>=0;i--){const l=G.log[i];if(l.who==='pilot'&&l.ent===a){said=l.text;break;}}
   const btn=t=>'<span class="lvb"><button class="use2" data-t="'+esc(t)+'">Insert</button><button class="send2" data-t="'+esc(t)+'">Send now</button></span>';
   h='<div class="lv-h">FOR '+esc(name.toUpperCase())+(R?' · '+esc(R.title.toUpperCase()):'')+'</div>';
   if(R){
    h+=(said?'<p class="lv-said"><b>PILOT SAID</b> '+esc(said)+'</p>':'');
    const L=R.labels||{};
    const row=(cls,lab,t,rb)=>'<div class="'+cls+'"><b>'+esc(lab)+'</b><q>'+esc(t)+'</q>'+(rb?'<small>Pilot reads back: '+esc(rb)+'</small>':'')+btn(t)+'</div>';
    h+='<div class="trio3">'+row('b-acc',L.accept||'ACCEPT',R.accept,R.rbAccept)+row('b-den',L.deny||'DENY',R.deny,R.rbDeny)+row('b-wait',L.wait||'WAIT',R.wait,R.rbWait)+'</div>';
    if(R.note)h+='<p class="note">'+esc(R.note)+'</p>';
   }else h+='<p class="lv-none">No open request from this aircraft right now.</p>';
   let Q=[];try{Q=quickCmds(a).filter(q=>!/^Radio check/i.test(q.label));}catch(e){}
   if(Q.length){h+='<div class="lv-q"><b>OTHER THINGS YOU CAN SAY NOW</b>'+Q.map(q=>'<div class="lq"><span><i>'+esc(q.label)+'</i><q>'+esc(q.text)+'</q></span>'+btn(q.text)+'</div>').join('')+'</div>';}
  }
  if(h!==this._lv){this._lv=h;box.innerHTML=h;}
 },
 filterManual(){
  const q=$('m-q').value.toLowerCase().trim().split(/\s+/).filter(Boolean);let n=0;
  $('m-body').querySelectorAll('.mc').forEach(c=>{const okc=this.mcat==='All'||c.dataset.cat===this.mcat;const okq=q.every(w=>c.dataset.text.includes(w));const show=okc&&okq;c.hidden=!show;if(show)n++;});
  if($('m-live'))$('m-live').hidden=q.length>0||this.mcat!=='All';$('m-count').textContent=n+' entr'+(n===1?'y':'ies');$('m-none').hidden=n>0;
 },
 docked(){return $('manual').classList.contains('docked');},
 applyDock(){
  const on=!!this.manDock&&$('start').hidden&&!$('manual').hidden;
  $('manual').classList.toggle('docked',on);document.body.classList.toggle('man-docked',on);
  $('man-dock').textContent=on?'Undock ✕':'Dock ▸';
  try{localStorage.setItem('marlow.dock',this.manDock?'1':'0');}catch(e){}
  setTimeout(()=>{this.resize();},60);
 },
 openManual(){$('manual').hidden=false;this.applyDock();this.filterManual();this.manSig='';this.manualFocus();if(!$('manual').classList.contains('docked')||!this.running){$('m-q').focus();$('m-q').select();}},
 closeManual(){$('manual').hidden=true;this.applyDock();},
 toggleDock(){this.manDock=!this.manDock;this.applyDock();if(this.manDock&&$('start').hidden)$('cmd').focus();},
 manualFocus(){
  this.renderLive();
  if(!$('manual').classList.contains('docked'))return;
  const a=this.selAc();const k=a&&a.req?a.req.kind:'';const sig=(a?a.id:0)+'|'+k;if(sig===this.manSig)return;this.manSig=sig;
  const cards=$('m-body').querySelectorAll('.mc');let hit=null;cards.forEach(c=>{const on=!!k&&c.dataset.k===k;c.classList.toggle('cur',on);if(on)hit=c;});
  if(hit){if(hit.hidden){$('m-q').value='';this.mcat='All';$('m-cats').querySelectorAll('button').forEach((x,i)=>x.classList.toggle('on',i===0));this.filterManual();}
   $('m-body').scrollTo({top:hit.offsetTop-$('m-body').offsetTop-6,behavior:'smooth'});}
 },
 /* ---------- event binding ---------- */
 bind(){
  $('t-atis').addEventListener('click',e=>{e.stopPropagation();const pp=$('atis-pop');if(!G.cfg)return;pp.hidden=!pp.hidden;if(!pp.hidden){pp.innerHTML=this.atisText();pp.style.left=Math.max(8,$('t-atis').offsetLeft)+'px';}});
  document.addEventListener('click',e=>{const pp=$('atis-pop');if(!pp.hidden&&!pp.contains(e.target))pp.hidden=true;});
  setInterval(()=>{try{this.renderLive();}catch(e){}},600);
  $('start-btn').addEventListener('click',()=>this.start());
  $('again').addEventListener('click',()=>{this.running=false;this.showStart();});
  $('review').addEventListener('click',()=>{$('over').hidden=true;});
  document.querySelectorAll('#speed button').forEach(b=>b.addEventListener('click',()=>this.setSpeed(+b.dataset.s)));
  document.querySelectorAll('#camtools button').forEach(b=>b.addEventListener('click',()=>{R3.setMode(b.dataset.cam);this.setCamBtn(b.dataset.cam);}));
  document.querySelectorAll('#layout button').forEach(b=>b.addEventListener('click',()=>this.setLayout(b.dataset.l)));
  $('mz-fit').addEventListener('click',()=>MAPV.fit());$('mz-wide').addEventListener('click',()=>MAPV.wide());$('mz-in').addEventListener('click',()=>MAPV.sc=Math.min(3,MAPV.sc*1.5));$('mz-out').addEventListener('click',()=>MAPV.sc=Math.max(0.0035,MAPV.sc/1.5));
  $('rwybtn').addEventListener('click',()=>{const r=changeRunway();this.toast(r.ok?'Runway changed to '+RWD():r.msg,r.ok?'ok':'warn');this.syncTop();});
  $('man-btn').addEventListener('click',()=>this.openManual());$('man-close').addEventListener('click',()=>this.closeManual());$('man-dock').addEventListener('click',()=>this.toggleDock());try{this.manDock=localStorage.getItem('marlow.dock')==='1';}catch(e){this.manDock=false;}
  $('set-btn').addEventListener('click',()=>{this.syncSettings();$('settings').hidden=false;});
  $('set-close').addEventListener('click',()=>{this.saveSettings();$('settings').hidden=true;});
  $('start-set').addEventListener('click',()=>{this.syncSettings();$('settings').hidden=false;});
  $('start-man').addEventListener('click',()=>this.openManual());
  $('k-test').addEventListener('click',async()=>{this.saveSettings();$('k-res').textContent='Testing…';$('k-res').textContent=await Voice.test();this.voiceStatus();});
  ['k-key','k-model','k-gem','k-voice','k-fb','k-fx','k-style','k-vol','k-mic','k-assist'].forEach(i=>$(i).addEventListener('change',()=>this.saveSettings()));
  $('send').addEventListener('click',()=>this.submit());
  $('cmd').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.submit();}if(e.code==='Space'&&!$('cmd').value.trim()&&Voice.micOn&&Mic.supported&&!e.repeat){e.preventDefault();e.stopPropagation();Mic.start('hold');return;}if(e.code==='Space'&&Mic.mode==='hold'&&(Mic.active||Mic.starting)){e.preventDefault();e.stopPropagation();return;}e.stopPropagation();if(e.key==='Escape')$('cmd').blur();});
  $('mic').addEventListener('click',()=>{if(!Mic.supported){this.toast('Speech recognition is not available in this browser — type your transmission.','warn');return;}if(Mic.active)Mic.stop(0);else Mic.start('toggle');});
  $('log').addEventListener('click',e=>{const a=e.target.closest('a[data-id]');if(a)this.select(+a.dataset.id);});
  $('hdr-nextreq').addEventListener('click',()=>this.nextReq());
  document.addEventListener('keydown',e=>{
   const tag=(e.target.tagName||'').toLowerCase();const typing=tag==='input'||tag==='textarea'||tag==='select';
   if(e.key==='Escape'){this.closeManual();$('settings').hidden=true;return;}
   if((!$('manual').hidden&&!$('manual').classList.contains('docked'))||!$('settings').hidden||!$('start').hidden||typing)return;
   if(e.key==='m'||e.key==='M'||e.key==='?'||e.key==='F1'){e.preventDefault();if(!$('manual').hidden)this.closeManual();else this.openManual();}
   else if(e.key==='1')this.answer('accept');else if(e.key==='2')this.answer('deny');else if(e.key==='3')this.answer('wait');
   else if(e.key==='Tab'){e.preventDefault();this.nextReq();}
   else if(e.key==='/'){e.preventDefault();$('cmd').focus();}
   else if(e.key==='p'||e.key==='P')this.setSpeed(this.speed===0?1:0);
   else if(e.code==='Space'&&Voice.micOn&&Mic.supported&&!e.repeat){e.preventDefault();Mic.start('hold');}
  });
  document.addEventListener('keyup',e=>{if(e.code==='Space'&&(Mic.active||Mic.starting)&&Mic.mode==='hold')Mic.stop(450);});
  $('manual').addEventListener('click',e=>{if(e.target.id==='manual'&&!$('manual').classList.contains('docked'))this.closeManual();});
 }
};
window.UI=UI;
window.addEventListener('load',()=>{try{UI.init();}catch(e){console.error(e);const d=document.createElement('pre');d.style.cssText='position:fixed;inset:0;background:#200;color:#fcc;padding:20px;z-index:99;white-space:pre-wrap';d.textContent='Startup error: '+(e.stack||e);document.body.appendChild(d);}});

(function(){const rs=UI.renderSel;UI.renderSel=function(){const r=rs.apply(this,arguments);try{this.manualFocus();}catch(e){}return r;};})();
