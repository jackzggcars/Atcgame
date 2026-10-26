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
 init(){
  Voice.load();this.loadCfg();
  this.glOK=R3.init($('gl'),$('labels3d'));
  if(!this.glOK){$('v3d').classList.add('nogl');}
  MAPV.init($('mapc'));MAPV.fit();
  R3.onPick=e=>{if(e)this.select(e.id);};MAPV.onPick=e=>{if(e)this.select(e.id);};
  this.bind();this.buildManual();this.syncSettings();this.voiceStatus();
  window.addEventListener('resize',()=>this.resize());this.resize();
  Mic.onText=t=>{$('cmd').value=t;};Mic.onDone=t=>{if((t||'').trim()){$('cmd').value=t.trim();this.submit();}};
  Mic.onState=(on,err)=>{$('mic').classList.toggle('on',on);Voice.hold(on);if(on){this.toast('Listening… speak your transmission','ok');return;}
   const M={'not-allowed':'Microphone blocked. Click the lock / camera icon in the address bar, allow the microphone, then try again.','service-not-allowed':'Speech recognition is blocked in this browser or page. Use Chrome or Edge on the downloaded or deployed (https) page.','no-microphone':'No microphone found.','audio-capture':'No microphone found.','network':'Speech recognition needs an internet connection.','insecure-context':'The microphone needs a secure (https) page.','unsupported':'This page cannot access the microphone (it may be embedded; open it in its own tab).','no-speech':"Didn't hear anything. Hold Space and speak."};
   if(err&&err!=='end'&&err!=='aborted')this.toast(M[err]||('Microphone: '+err),'warn');};
  on('say',e=>this.onSay(e));on('incident',i=>this.banner(i.text,'bad'));on('over',o=>this.onOver(o));
  on('accident',e=>{R3.boom(e.x,e.y,e.z,G.cfg.mode==='training'?25:0);this.alarm();});
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
  $('s-level').value=s.level||'controller';$('s-mode').value=s.mode||'career';$('s-tod').value=s.tod||'day';$('s-fog').checked=!!s.fog;$('s-shift').value=s.shift||30;
  $('s-key').value=Voice.key||'';$('s-gem').checked=Voice.gemini;$('s-voice').checked=Voice.on;
  $('start').hidden=false;$('over').hidden=true;
 },
 start(){
  Voice.ensureCtx();
  const cfg={level:$('s-level').value,mode:$('s-mode').value,tod:$('s-tod').value,fog:$('s-fog').checked,shift:+$('s-shift').value||30};
  Voice.key=$('s-key').value.trim();Voice.gemini=$('s-gem').checked;Voice.on=$('s-voice').checked;Voice.save();
  this.saved=cfg;this.saveCfg();
  R3.clear();MAPV.trails.clear();$('log').innerHTML='';this.logN=0;this.sel=0;R3.sel=0;MAPV.sel=0;
  newGame(cfg);R3.applyTOD(cfg.tod);R3.setFog(G.fog);R3.setMode('tower');this.setCamBtn('tower');
  $('start').hidden=true;$('over').hidden=true;this.running=true;this.speed=1;this.setSpeed(1);this.syncSettings();this.voiceStatus();
  MAPV.fit();this.resize();$('cmd').focus();
 },
 onOver(o){
  setTimeout(()=>{
   const s=G.stats;$('o-title').textContent=o.kind==='accident'?'ACCIDENT':o.kind==='licence'?'LICENCE SUSPENDED':'SHIFT COMPLETE';
   $('over').classList.toggle('bad',o.kind!=='shift');$('o-reason').textContent=o.reason;
   $('o-stats').innerHTML=[['Score',Math.round(G.score)],['Safety rating',G.safety],['Departures',s.dep],['Arrivals',s.arr],['Go-arounds',s.goArounds],['Runway incursions',s.incursion||0],['Separation losses',s.los||0],['Emergencies handled',s.emerg||0],['Read-back errors missed',s.readback||0],['Shift length',this.clockStr(G.t)]].map(r=>'<div><span>'+r[0]+'</span><b>'+r[1]+'</b></div>').join('');
   const gr=o.kind==='shift'?(G.safety>=85&&G.score>1200?'S':G.safety>=70?'A':G.safety>=50?'B':'C'):'—';$('o-grade').textContent=gr;
   $('over').hidden=false;
  },o.kind==='accident'?2800:600);
 },
 /* ---------- events ---------- */
 onSay(e){
  this.appendLog(e);
  if(e.who==='pilot'&&Voice.on&&this.speed>0&&!(this.speed>=4&&!e.urgent)){if(e.ent&&e.ent.req&&!e.ent.veh)e.ent.req.hold=G.t||0.001;Voice.speak(e);}
  if(e.who==='pilot'&&e.ent&&e.ent.req&&!this.sel&&e.ent.id){this.select(e.ent.id,true);}
 },
 sysLine(t,sev){this.appendLog({who:'sys',text:t,sev:sev||'ok',clock:G.clock,cs:''});},
 appendLog(e){
  const box=$('log');const d=document.createElement('div');d.className='ll '+e.who+(e.sev?' '+e.sev:'');
  const who=e.who==='pilot'?'PILOT':e.who==='atc'?'YOU':'SYS';
  d.innerHTML='<time>'+this.clockStr(e.clock||G.clock).slice(3)+'</time><b>'+who+'</b><span>'+(e.ent&&e.who!=='sys'?'<a data-id="'+e.ent.id+'">'+esc(e.ent.cs)+'</a> ':'')+esc(e.text)+'</span>';
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
  Voice.ensureCtx();
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
  $('t-clock').textContent=this.clockStr(G.clock);$('t-atis').textContent=snapshotATIS();
  $('t-score').textContent=Math.round(G.score);const sf=$('t-safe');sf.style.width=G.safety+'%';sf.parentElement.classList.toggle('low',G.safety<45);$('t-safen').textContent=G.safety;
  const left=Math.max(0,G.cfg.shift*60-G.t);$('t-left').textContent=this.clockStr(left).slice(3);
  const rb=$('rwybtn');rb.textContent='RWY '+G.rwy+(G.rwyBetter?'  ▸ '+G.rwyBetter+' advised':'');rb.classList.toggle('adv',!!G.rwyBetter);
  const q=G.ents.filter(e=>e.req&&!e.dead).length;$('t-req').textContent=q;$('t-req').parentElement.classList.toggle('hot',q>0);
 },
 /* ---------- strips ---------- */
 statusText(a){
  if(a.veh)return MAPV.phaseText(a);
  const q=a.req?PH[a.req.kind].title:'';
  return a.req?q:MAPV.phaseText(a);
 },
 renderStrips(force){
  const L=G.ents.filter(e=>!e.dead&&e.phase!=='REMOVED');
  const rank=e=>(e.req?(PH[e.req.kind].urgent?0:1):e.err?2:e.emerg?2:e.nordo?2:3)+(e.veh?1:0);
  L.sort((a,b)=>rank(a)-rank(b)||(a.req&&b.req?a.req.t-b.req.t:0)||a.id-b.id);
  const sig=L.map(e=>e.id+':'+(e.req?e.req.kind:'')+e.phase+(e.id===this.sel?'*':'')+(e.nordo?'n':'')+(e.emerg||'')+(e.err&&G.cfg.assist?'e':'')).join('|');
  const box=$('strips');
  if(!force&&sig===this._sig){ // update timers only
   box.querySelectorAll('.strip').forEach(el=>{const e=G.ents.find(x=>x.id===+el.dataset.id);if(!e)return;const w=el.querySelector('.wait');if(w)w.style.width=e.req?Math.min(100,(G.t-e.req.t)/50*100)+'%':'0';const sp=el.querySelector('.st');if(sp)sp.textContent=this.statusText(e);});
   return;
  }
  this._sig=sig;box.innerHTML='';
  if(!L.length){box.innerHTML='<div class="empty">No traffic yet. Aircraft call you as they become ready.</div>';return;}
  for(const e of L){
   const d=document.createElement('div');
   d.className='strip '+(e.veh?'veh':e.kind)+(e.id===this.sel?' sel':'')+(e.req?' req':'')+(e.req&&PH[e.req.kind].urgent||e.emerg||e.nordo?' emg':'');
   d.dataset.id=e.id;
   const dest=e.veh?'Airfield ops':e.kind==='dep'?(e.dest?e.dest.n:''):('ILS '+G.rwy+(e.gate?' · stand '+e.gate:''));
   d.innerHTML='<i class="bar"></i><div class="c1"><b>'+esc(e.veh?e.rt:e.cs)+(e.heavy?'<em>H</em>':'')+'</b><span>'+esc(e.veh?'':e.type.n)+'</span></div><div class="c2"><span class="st">'+esc(this.statusText(e))+'</span><span class="dst">'+esc(dest)+'</span></div><div class="c3"><span class="sq'+(e.sqBad?' bad':'')+'">'+(e.squawk||'')+'</span>'+(e.err&&G.cfg.assist?'<span class="warn" title="Read-back differs from your instruction">⚠ RB</span>':'')+(e.nordo?'<span class="warn">NORDO</span>':'')+'</div><u class="wait" style="width:'+(e.req?Math.min(100,(G.t-e.req.t)/50*100):0)+'%"></u>';
   d.addEventListener('click',()=>this.select(e.id));box.appendChild(d);
  }
 },
 /* ---------- selected panel ---------- */
 renderSel(soft){
  const a=this.selAc(),box=$('sel');
  if(!a){box.innerHTML='<div class="empty">Select a strip, a map label or a plane.<br><span>Keys: <kbd>Tab</kbd> next request · <kbd>1</kbd> accept · <kbd>2</kbd> deny · <kbd>3</kbd> wait · <kbd>M</kbd> manual · hold <kbd>Space</kbd> to talk</span></div>';this._selSig='';return;}
  const r=buildReplies(a);const ql=quickCmds(a);
  const sig=a.id+'|'+(a.req?a.req.kind+a.req.t:'')+'|'+a.phase+'|'+(a.err?1:0)+'|'+(a.paused?1:0)+'|'+(a.nordo?1:0)+ql.length;
  if(soft&&sig===this._selSig){const f=$('sel-fuel');if(f&&a.kind==='arr')f.textContent=Math.max(0,a.fuel).toFixed(0)+' min';const h=$('sel-live');if(h)h.textContent=this.liveText(a);return;}
  this._selSig=sig;
  let h='<div class="s-head"><b>'+esc(a.veh?a.rt:csName(a))+'</b><span>'+esc(a.veh?'Airfield vehicle':a.type.n+' · '+(a.heavy?'HEAVY':'MEDIUM')+' · '+a.al.icao)+'</span></div>';
  if(!a.veh){h+='<dl class="s-info"><div><dt>Squawk</dt><dd class="'+(a.sqBad?'bad':'')+'">'+(a.squawk||'—')+'</dd></div><div><dt>'+(a.kind==='dep'?'Destination':'Approach')+'</dt><dd>'+(a.kind==='dep'?esc(a.dest.n+' · '+a.dest.sid):'ILS RWY '+G.rwy)+'</dd></div><div><dt>Stand</dt><dd>'+(a.gate||'—')+'</dd></div><div><dt>Now</dt><dd id="sel-live">'+esc(this.liveText(a))+'</dd></div>'+(a.kind==='arr'?'<div><dt>Fuel</dt><dd id="sel-fuel">'+Math.max(0,a.fuel).toFixed(0)+' min</dd></div>':'')+'</dl>';}
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
 setCamBtn(m){document.querySelectorAll('#camtools button').forEach(b=>b.classList.toggle('on',b.dataset.cam===m));},
 setLayout(l){this.layout=l;$('views').className='lay-'+l;document.querySelectorAll('#layout button').forEach(b=>b.classList.toggle('on',b.dataset.l===l));setTimeout(()=>this.resize(),30);},
 /* ---------- settings ---------- */
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
  const S=SAMPLE;const f=t=>fmt(t,S);
  const phCard=(k,ph)=>{
   const d=document.createElement('article');d.className='mc';d.dataset.cat=ph.cat;d.dataset.k=k;
   const rows=[['accept','ACCEPT','b-acc'],['deny','DENY','b-den'],['wait','WAIT','b-wait']];
   d.innerHTML='<header><span class="chip">'+esc(ph.cat)+'</span>'+(ph.urgent?'<span class="chip red">Emergency</span>':'')+'<h3>'+esc(ph.title)+'</h3></header><p class="when">'+esc(ph.when)+'</p>'+
    '<div class="say"><b>PILOT SAYS</b>'+ph.pilot.map(p=>'<q>'+esc(f(p))+'</q>').join('')+'</div>'+
    '<div class="trio3">'+rows.map(([w,l,c])=>'<div class="'+c+'"><b>'+l+'</b><q>'+esc(f(ph[w]))+'</q><small>Pilot: '+esc(f(ph['rb'+w[0].toUpperCase()+w.slice(1)]||''))+'</small><button class="use" data-t="'+esc(ph[w])+'">Insert</button></div>').join('')+'</div>'+
    '<p class="note">'+esc(ph.note)+'</p>';
   d.dataset.text=(ph.cat+' '+ph.title+' '+ph.when+' '+ph.pilot.join(' ')+' '+ph.accept+' '+ph.deny+' '+ph.wait+' '+(ph.rbAccept||'')+' '+ph.note+' '+k).toLowerCase();return d;
  };
  Object.keys(PH).forEach(k=>frag.appendChild(phCard(k,PH[k])));
  INSTR.forEach(i=>{const d=document.createElement('article');d.className='mc';d.dataset.cat=i.cat;
   d.innerHTML='<header><span class="chip">Instructions</span><h3>'+esc(i.title)+'</h3></header><div class="trio3 one"><div class="b-acc"><b>YOU SAY</b><q>'+esc(fmt(i.atc,Object.assign({},SAMPLE,{instr:'line up and wait',sq:'4521'})))+'</q><small>Pilot: '+esc(fmt(i.rb,SAMPLE))+'</small><button class="use" data-t="'+esc(i.atc)+'">Insert</button></div></div><p class="note">'+esc(i.note)+'</p>';
   d.dataset.text=('instructions '+i.title+' '+i.atc+' '+i.rb+' '+i.note).toLowerCase();frag.appendChild(d);});
  MAN_EXTRA.forEach(x=>{const d=document.createElement('article');d.className='mc ref';d.dataset.cat=x.cat;d.innerHTML='<header><span class="chip">Reference</span><h3>'+esc(x.title)+'</h3></header><div class="refbody">'+x.html+'</div>';d.dataset.text=(x.cat+' '+x.title+' '+x.tags+' '+x.html.replace(/<[^>]+>/g,' ')).toLowerCase();frag.appendChild(d);});
  body.appendChild(frag);
  body.addEventListener('click',e=>{const b=e.target.closest('.use');if(!b)return;const a=this.selAc();const cs=a?(a.veh?a.rt:csName(a)):'Speedbird 452';let t=b.dataset.t;t=t.replace(/\{cs\}/g,cs);t=fmt(t,Object.assign({},SAMPLE,{cs,rwy:G.rwy||'09',wdir:G.wind?V(null).wdir:'080',wspd:G.wind?V(null).wspd:'10'}));$('cmd').value=t;if(!this.docked())this.closeManual();$('cmd').focus();});
  const cats=['All','Delivery','Ground','Tower','Emergency','Instructions','Reference'];
  $('m-cats').innerHTML=cats.map((c,i)=>'<button data-c="'+c+'"'+(i?'':' class="on"')+'>'+c+'</button>').join('');
  $('m-cats').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;this.mcat=b.dataset.c;$('m-cats').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));this.filterManual();});
  $('m-q').addEventListener('input',()=>this.filterManual());this.mcat='All';
 },
 filterManual(){
  const q=$('m-q').value.toLowerCase().trim().split(/\s+/).filter(Boolean);let n=0;
  $('m-body').querySelectorAll('.mc').forEach(c=>{const okc=this.mcat==='All'||c.dataset.cat===this.mcat;const okq=q.every(w=>c.dataset.text.includes(w));const show=okc&&okq;c.hidden=!show;if(show)n++;});
  $('m-count').textContent=n+' entr'+(n===1?'y':'ies');$('m-none').hidden=n>0;
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
  if(!$('manual').classList.contains('docked'))return;
  const a=this.selAc();const k=a&&a.req?a.req.kind:'';const sig=(a?a.id:0)+'|'+k;if(sig===this.manSig)return;this.manSig=sig;
  const cards=$('m-body').querySelectorAll('.mc');let hit=null;cards.forEach(c=>{const on=!!k&&c.dataset.k===k;c.classList.toggle('cur',on);if(on)hit=c;});
  if(hit){if(hit.hidden){$('m-q').value='';this.mcat='All';$('m-cats').querySelectorAll('button').forEach((x,i)=>x.classList.toggle('on',i===0));this.filterManual();}
   $('m-body').scrollTo({top:hit.offsetTop-$('m-body').offsetTop-6,behavior:'smooth'});}
 },
 /* ---------- event binding ---------- */
 bind(){
  $('start-btn').addEventListener('click',()=>this.start());
  $('again').addEventListener('click',()=>{this.running=false;this.showStart();});
  $('review').addEventListener('click',()=>{$('over').hidden=true;});
  document.querySelectorAll('#speed button').forEach(b=>b.addEventListener('click',()=>this.setSpeed(+b.dataset.s)));
  document.querySelectorAll('#camtools button').forEach(b=>b.addEventListener('click',()=>{R3.setMode(b.dataset.cam);this.setCamBtn(b.dataset.cam);}));
  document.querySelectorAll('#layout button').forEach(b=>b.addEventListener('click',()=>this.setLayout(b.dataset.l)));
  $('mz-fit').addEventListener('click',()=>MAPV.fit());$('mz-wide').addEventListener('click',()=>MAPV.wide());$('mz-in').addEventListener('click',()=>MAPV.sc=Math.min(3,MAPV.sc*1.5));$('mz-out').addEventListener('click',()=>MAPV.sc=Math.max(0.0035,MAPV.sc/1.5));
  $('rwybtn').addEventListener('click',()=>{const r=changeRunway();this.toast(r.ok?'Runway changed to '+G.rwy:r.msg,r.ok?'ok':'warn');this.syncTop();});
  $('man-btn').addEventListener('click',()=>this.openManual());$('man-close').addEventListener('click',()=>this.closeManual());$('man-dock').addEventListener('click',()=>this.toggleDock());try{this.manDock=localStorage.getItem('marlow.dock')==='1';}catch(e){this.manDock=false;}
  $('set-btn').addEventListener('click',()=>{this.syncSettings();$('settings').hidden=false;});
  $('set-close').addEventListener('click',()=>{this.saveSettings();$('settings').hidden=true;});
  $('start-set').addEventListener('click',()=>{this.syncSettings();$('settings').hidden=false;});
  $('start-man').addEventListener('click',()=>this.openManual());
  $('k-test').addEventListener('click',async()=>{this.saveSettings();$('k-res').textContent='Testing…';$('k-res').textContent=await Voice.test();this.voiceStatus();});
  ['k-key','k-model','k-gem','k-voice','k-fb','k-fx','k-style','k-vol','k-mic','k-assist'].forEach(i=>$(i).addEventListener('change',()=>this.saveSettings()));
  $('send').addEventListener('click',()=>this.submit());
  $('cmd').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();this.submit();}e.stopPropagation();if(e.key==='Escape')$('cmd').blur();});
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
