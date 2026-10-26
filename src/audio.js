'use strict';
/* =====================================================================
   VOICE — Gemini TTS for pilots (with radio filter), browser-voice fallback, mic input
   ===================================================================== */
const Voice={
 key:'',model:'gemini-3.8-flash-tts',on:true,gemini:true,fallback:true,fx:true,vol:0.9,micOn:true,styleOn:true,
 ctx:null,queue:[],busy:false,cache:new Map(),fails:0,status:'idle',lastErr:'',nGemini:0,
 models:['gemini-3.8-flash-tts','gemini-3.8-flash-lite-tts','gemini-2.5-flash-preview-tts'],
 load(){
  try{const s=JSON.parse(localStorage.getItem('marlow.voice')||'{}');Object.assign(this,s);}catch(e){}
 },
 save(){
  try{localStorage.setItem('marlow.voice',JSON.stringify({key:this.key,model:this.model,on:this.on,gemini:this.gemini,fallback:this.fallback,fx:this.fx,vol:this.vol,micOn:this.micOn,styleOn:this.styleOn}));}catch(e){}
 },
 ensureCtx(){
  if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){this.ctx=null;}}
  if(this.ctx&&this.ctx.state==='suspended'&&!this.held)this.ctx.resume();
  return this.ctx;
 },
 styleFor(e){
  if(!this.styleOn)return '';
  const acc=e.accent&&e.accent!=='international'?e.accent+' accent, ':'';
  return (e.urgent?'tense and urgent, clipped and fast, ':'calm and professional, clipped, ')+'airline pilot on a VHF radio, '+acc.replace(/, $/,'');
 },
 held:false,
 async idle(){
  const mic=()=>typeof Mic!=='undefined'&&(Mic.active||Mic.starting);
  for(let i=0;this.held||mic();i++){if(this.held&&!mic()&&i>8)this.hold(false);await new Promise(r=>setTimeout(r,120));}
 },
 hold(on){   // pause pilot audio while the controller is transmitting
  this.held=!!on;
  try{if(this.ctx){if(on)this.ctx.suspend();else this.ctx.resume();}}catch(e){}
  try{if('speechSynthesis' in window){if(on)speechSynthesis.pause();else speechSynthesis.resume();}}catch(e){}
 },
 release(e){const r=e&&e.ent&&e.ent.req;if(r&&r.hold){r.hold=0;r.t=G.t;}},
 speak(e){
  if(!this.on||G.over&&false){this.release(e);return;}
  if(this.queue.length>3){const i=this.queue.findIndex(q=>!q.urgent);if(i>=0){this.release(this.queue[i]);this.queue.splice(i,1);}else{this.release(e);return;}}
  if(e.urgent)this.queue.unshift(e);else this.queue.push(e);
  this.pump();
 },
 async pump(){
  if(this.busy)return;this.busy=true;
  while(this.queue.length&&this.on){
   while(typeof Mic!=='undefined'&&(Mic.active||Mic.starting))await new Promise(r=>setTimeout(r,150));
   const e=this.queue.shift();const spoken=toSpeech(e.text);this.now=null;
   try{
    let done=false;
    if(this.gemini&&this.key&&this.fails<4){
     try{const buf=await this.geminiBuffer(spoken,e.voice||'Charon',this.styleFor(e));if(buf){this.now=e;await this.playBuffer(buf);done=true;this.fails=0;this.status='gemini';this.nGemini++;}}
     catch(err){this.fails++;this.lastErr=String(err&&err.message||err);this.status='error';if(window.UI&&UI.voiceStatus)UI.voiceStatus();}
    }
    if(!done&&this.fallback){await this.idle();this.now=e;await this._speak(spoken,e);}
   }catch(err){}
   this.now=null;this.release(e);
  }
  this.now=null;while(this.queue.length)this.release(this.queue.shift());
  this.busy=false;
 },
 async geminiBuffer(text,voice,style){
  const ck=voice+'|'+style+'|'+text;if(this.cache.has(ck))return this.cache.get(ck);
  const ctx=this.ensureCtx();if(!ctx)return null;
  const base='https://generativelanguage.googleapis.com/v1beta/';
  const list=[this.model].concat(this.models.filter(m=>m!==this.model));
  let lastErr=null;
  const post=async(url,body)=>{
   const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),20000);
   try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':this.key},body:JSON.stringify(body),signal:ctl.signal});
    if(!r.ok){let t='';try{t=(await r.text()).slice(0,240);}catch(_){}throw new Error('HTTP '+r.status+' '+t);}
    return await r.json();}finally{clearTimeout(to);}
  };
  for(const m of list){
   try{
    let j;
    if(/^gemini-3/.test(m)){
     // Gemini 3.x TTS: the spoken text and the style instructions are SEPARATE fields (style goes in speech_metadata, never in the text)
     const part={type:'text',text};if(style)part.annotations=[{type:'speech_metadata',style}];
     j=await post(base+'interactions',{model:m,input:[{type:'user_input',content:[part]}],response_format:{type:'audio'},generation_config:{speech_config:[{voice}]}});
    }else{
     // 2.5 models have a single text field, so send only the words (no style prefix that could be read aloud)
     j=await post(base+'models/'+m+':generateContent',{contents:[{parts:[{text}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}});
    }
    const au=this.findAudio(j);if(au){const b=await this.decode(au);this.cache.set(ck,b);if(m!==this.model&&list.indexOf(m)===1&&/^gemini-3/.test(m)){this.model=m;this.save();}return b;}
    lastErr=new Error('no audio in response');
   }catch(err){lastErr=err;if(/API key|403|401|PERMISSION|API_KEY/i.test(String(err.message)))break;if(/Failed to fetch|abort|NetworkError/i.test(String(err.message)))break;}
  }
  throw lastErr||new Error('Gemini TTS failed');
 },
 findAudio(o,depth){
  depth=depth||0;if(!o||typeof o!=='object'||depth>8)return null;
  if(typeof o.data==='string'&&o.data.length>1500)return{data:o.data,mime:o.mimeType||o.mime_type||''};
  for(const k in o){const r=this.findAudio(o[k],depth+1);if(r)return r;}return null;
 },
 async decode(a){
  const bin=atob(a.data);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
  const ctx=this.ctx;
  if(bin.slice(0,4)==='RIFF'){return await ctx.decodeAudioData(u8.buffer.slice(0));}
  const m=/rate=(\d+)/.exec(a.mime||'');const rate=m?+m[1]:24000;
  const n=Math.floor(u8.length/2);const buf=ctx.createBuffer(1,n,rate);const ch=buf.getChannelData(0);
  const dv=new DataView(u8.buffer);for(let i=0;i<n;i++)ch[i]=dv.getInt16(i*2,true)/32768;
  return buf;
 },
 noiseBuf(len){
  const ctx=this.ctx;const b=ctx.createBuffer(1,Math.floor(ctx.sampleRate*len),ctx.sampleRate);const d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*0.5;return b;
 },
 /* Channel vocoder: emulates the warbly, band-limited digital (AMBE-style) voice of a digital radio link.
    8 kHz, 10 analysis bands, 20 ms frames, 4-bit envelopes, buzz / noise excitation, frame freezes and drop-outs that grow with distance. */
 _bq(x,f0,Q,sr){const w=2*Math.PI*f0/sr,al=Math.sin(w)/(2*Q),a0=1+al,b0=al/a0,b2=-al/a0,a1=-2*Math.cos(w)/a0,a2=(1-al)/a0;const y=new Float32Array(x.length);let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){const v=x[i],o=b0*v+b2*x2-a1*y1-a2*y2;y[i]=o;x2=x1;x1=v;y2=y1;y1=o;}return y;},
 vocode(buf,q){
  const sr=8000,src=buf.getChannelData(0),r=buf.sampleRate/sr,n=Math.floor(src.length/r),x=new Float32Array(n);
  for(let i=0;i<n;i++){let a=0,c=0;for(let j=Math.floor(i*r);j<Math.floor((i+1)*r)&&j<src.length;j++){a+=src[j];c++;}x[i]=c?a/c:0;}
  const FR=160,nf=Math.floor(n/FR),B=[[260,380],[380,520],[520,690],[690,890],[890,1130],[1130,1420],[1420,1770],[1770,2200],[2200,2700],[2700,3300]];
  // excitation: glottal-ish buzz for voiced frames, noise for unvoiced (decided by zero-crossing rate)
  const buzz=new Float32Array(n),noise=new Float32Array(n);let ph=0;
  for(let i=0;i<n;i++){const f=118+14*Math.sin(i/sr*5.1)+((i/FR|0)%3)*4;ph+=f/sr;if(ph>=1)ph-=1;buzz[i]=(ph<0.07?1:0)-0.07+0.25*Math.sin(2*Math.PI*ph);noise[i]=Math.random()*2-1;}
  const voiced=new Uint8Array(nf);for(let f=0;f<nf;f++){let z=0;for(let i=f*FR+1;i<(f+1)*FR;i++)if((x[i]>0)!==(x[i-1]>0))z++;voiced[f]=z<46?1:0;}
  const exc=new Float32Array(n);for(let i=0;i<n;i++){const f=Math.min(nf-1,i/FR|0);exc[i]=voiced[f]?buzz[i]*0.9+noise[i]*0.12:noise[i]*0.55;}
  const out=new Float32Array(n);const fe=new Float32Array(B.length);let held=null;
  for(let b=0;b<B.length;b++){
   const f0=Math.sqrt(B[b][0]*B[b][1]),Q=f0/(B[b][1]-B[b][0]),a=this._bq(x,f0,Q,sr),c=this._bq(exc,f0,Q,sr);
   const env=new Float32Array(nf);for(let f=0;f<nf;f++){let e=0;for(let i=f*FR;i<(f+1)*FR;i++)e+=a[i]*a[i];env[f]=Math.sqrt(e/FR);}
   // 4-bit log quantisation of the envelope, then stochastic freezes / drop-outs
   let last=0;for(let f=0;f<nf;f++){let e=env[f];const db=20*Math.log10(e+1e-5);let lv=Math.round((Math.max(-60,Math.min(0,db))+60)/1.5);e=lv===0?0:Math.pow(10,(lv*1.5-60)/20);
    const seed=Math.sin(f*12.9898+7.13)*43758.5453,rr=seed-Math.floor(seed);
    if(rr<q*0.006)e=last;else if(rr>1-q*0.002)e=0;last=e;env[f]=e;}
   for(let i=0;i<n;i++){const f=Math.min(nf-1,i/FR|0),g0=env[f],g1=env[Math.min(nf-1,f+1)],t=(i%FR)/FR;out[i]+=c[i]*(g0+(g1-g0)*t)*2.1;}
  }
  // dry path: band-limited + coarse 7-bit quantisation, blended under the vocoded voice
  const dry=this._bq(this._bq(x,200,0.5,sr),3500,0.5,sr);let pk=0;
  for(let i=0;i<n;i++){const d=Math.round(dry[i]*480)/480;out[i]=out[i]*0.10+d*1.0;if(Math.abs(out[i])>pk)pk=Math.abs(out[i]);}
  const k=pk>0?0.85/pk:1,ob=this.ctx.createBuffer(1,n,sr),od=ob.getChannelData(0);for(let i=0;i<n;i++)od[i]=out[i]*k;return ob;
 },
 _q(){const e=this.now;if(!e||e.x===undefined)return 0.25;const d=Math.hypot(e.x,e.z)+Math.max(0,e.y||0)*0.5;return Math.max(0,Math.min(1,d/30000));},
 /* background injection for voices that can't be routed through Web Audio (browser TTS): hiss, carrier whine, squelch */
 bed(dur,q){const ctx=this.ensureCtx();if(!ctx)return;const t0=ctx.currentTime+0.02,out=ctx.createGain();out.gain.value=this.vol;out.connect(ctx.destination);
  const ns=ctx.createBufferSource();ns.buffer=this.noiseBuf(dur+0.4);const nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=1700;nf.Q.value=0.5;const ng=ctx.createGain();ng.gain.value=0.005+0.018*q;ns.connect(nf);nf.connect(ng);ng.connect(out);ns.start(t0);
  const sq=ctx.createBufferSource();sq.buffer=this.noiseBuf(0.07);const sg=ctx.createGain();sg.gain.value=0.16;sq.connect(sg);sg.connect(out);sq.start(t0);
  const sq2=ctx.createBufferSource();sq2.buffer=this.noiseBuf(0.06);const sg2=ctx.createGain();sg2.gain.value=0.12;sq2.connect(sg2);sg2.connect(out);sq2.start(t0+dur+0.1);},
 async playBuffer(buf){await this.idle();return this._play(buf);},
 _play(buf){
  return new Promise(res=>{
   const ctx=this.ensureCtx();if(!ctx)return res();
   const t0=ctx.currentTime+0.02;const out=ctx.createGain();out.gain.value=this.vol;out.connect(ctx.destination);
   const src=ctx.createBufferSource();const Q=this._q();let pb=buf;if(this.fx){try{pb=this.vocode(buf,Q);}catch(er){console.warn('vocode',er);}}src.buffer=pb;
   if(this.fx){
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=380;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3100;
    const sh=ctx.createWaveShaper();const c=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;c[i]=Math.tanh(x*2.2);}sh.curve=c;
    const g=ctx.createGain();g.gain.value=0.9;
    src.connect(hp);hp.connect(lp);lp.connect(sh);sh.connect(g);g.connect(out);
    const ns=ctx.createBufferSource();ns.buffer=this.noiseBuf(buf.duration+0.4);const nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=1800;nf.Q.value=0.6;const ng=ctx.createGain();ng.gain.value=0.005+0.02*Q;
    ns.connect(nf);nf.connect(ng);ng.connect(out);ns.start(t0);{const wo=ctx.createOscillator();wo.frequency.value=1020+Q*60;const wg=ctx.createGain();wg.gain.value=0.0006+0.002*Q;wo.connect(wg);wg.connect(out);wo.start(t0);wo.stop(t0+buf.duration+0.4);}
    const sq=ctx.createBufferSource();sq.buffer=this.noiseBuf(0.07);const sg=ctx.createGain();sg.gain.value=0.18;sq.connect(sg);sg.connect(out);sq.start(t0);
    const sq2=ctx.createBufferSource();sq2.buffer=this.noiseBuf(0.06);const sg2=ctx.createGain();sg2.gain.value=0.14;sq2.connect(sg2);sg2.connect(out);sq2.start(t0+0.12+buf.duration);
    src.start(t0+0.1);
   }else{src.connect(out);src.start(t0);}
   src.onended=()=>setTimeout(res,this.fx?220:80);
  });
 },
 voices:null,
 pickVoices(){
  if(this.voices)return this.voices;if(!('speechSynthesis' in window))return[];
  const v=speechSynthesis.getVoices().filter(x=>/^en/i.test(x.lang));this.voices=v.length?v:speechSynthesis.getVoices();return this.voices;
 },
 async browserSpeak(text,e){await this.idle();return this._speak(text,e);},
 _speak(text,e){
  if(this.fx&&window.meSpeak&&!this._esFail)return this._es(text,e).catch(er=>{this._esFail=1;console.warn('espeak',er);return this._speakNative(text,e);});
  return this._speakNative(text,e);
 },
 async _es(text,e){
  const ctx=this.ensureCtx();if(!ctx)throw new Error('no audio');
  let h=0;for(const ch of (e.cs||'x'))h=(h*31+ch.charCodeAt(0))>>>0;
  const raw=meSpeak.speak(text,{rawdata:'default',pitch:34+h%38,speed:140+((h>>4)%14)+(e.urgent?12:0),amplitude:100,wordgap:0});
  if(!raw||!raw.byteLength)throw new Error('empty');
  const buf=await ctx.decodeAudioData(raw.slice(0));return this._play(buf);
 },
 _speakNative(text,e){
  return new Promise(res=>{
   if(!('speechSynthesis' in window)){res();return;}
   const ss=speechSynthesis;
   if(this.fx)try{this.bed(Math.min(14,text.length*0.075),this._q());}catch(_){}
   const vs=this.pickVoices();
   let h=0;for(const ch of (e.cs||'x'))h=(h*31+ch.charCodeAt(0))>>>0;
   let fin=false,started=false,tries=0;
   const done=()=>{if(!fin){fin=true;clearTimeout(t1);clearTimeout(t2);res();}};
   const t2=setTimeout(done,Math.min(30000,4000+text.length*110));
   let t1=null;
   const go=()=>{
    tries++;
    try{if(!this.held){ss.resume();}}catch(_){}
    try{if(ss.speaking&&!started&&tries>1)ss.cancel();}catch(_){}
    const u=new SpeechSynthesisUtterance(text);
    if(vs.length)u.voice=vs[h%vs.length];u.rate=e.urgent?1.2:1.08;u.pitch=0.75+((h>>3)%9)/12;u.volume=this.vol;
    u.onstart=()=>{started=true;};u.onend=done;u.onerror=ev=>{if(ev&&(ev.error==='interrupted'||ev.error==='canceled')&&!started&&tries<3){setTimeout(go,150);return;}done();};
    this._u=u;   // keep a reference so it is not garbage-collected mid-speech (Chrome bug)
    try{ss.speak(u);}catch(err){done();return;}
    clearTimeout(t1);t1=setTimeout(()=>{if(!started&&!fin&&!this.held){if(tries<3){try{ss.cancel();}catch(_){}go();}else done();}},2500);
   };
   go();
  });
 },
 async test(){
  this.ensureCtx();this.fails=0;this.lastErr='';
  const e={text:AIRPORT.short+' Tower, Speedbird 452, holding point '+AIRPORT.tx.conn[0]+', runway '+AIRPORT.rwy.a+', ready for departure.',voice:'Charon',accent:'British',cs:'BAW452',urgent:false};
  if(!this.key){this.status='nokey';this.speak(e);return 'No key set — playing a browser voice instead.';}
  try{const b=await this.geminiBuffer(toSpeech(e.text),e.voice,this.styleFor(e));await this.playBuffer(b);this.status='gemini';return 'Gemini voice OK ('+this.model+').';}
  catch(err){this.status='error';this.lastErr=String(err.message||err);if(this.fallback)this.speak(e);
   return (/Failed to fetch|NetworkError|abort/i.test(this.lastErr)?'Network blocked: this page cannot reach Google (open the downloaded HTML file locally). ':'Gemini error: ')+this.lastErr.slice(0,160)+(this.fallback?' — played a browser voice instead.':'');}
 }
};

/* ---------- microphone (Web Speech API) ---------- */
const Mic={
 rec:null,active:false,starting:false,wantStop:false,granted:false,supported:!!(window.SpeechRecognition||window.webkitSpeechRecognition),onText:null,onDone:null,onState:null,
 mode:'hold',acc:'',cur:'',silT:null,
 text(){return (this.acc+' '+this.cur).replace(/\s+/g,' ').trim();},
 async start(mode){
  if(!this.supported||this.active||this.starting)return false;
  this.mode=mode||'hold';this.starting=true;this.wantStop=false;this.acc='';this.cur='';
  if(!this.granted){
   if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){this.starting=false;if(this.onState)this.onState(false,window.isSecureContext===false?'insecure-context':'unsupported');return false;}
   try{const s=await navigator.mediaDevices.getUserMedia({audio:true});s.getTracks().forEach(t=>t.stop());this.granted=true;}
   catch(e){this.starting=false;if(this.onState)this.onState(false,(e&&e.name==='NotFoundError')?'no-microphone':'not-allowed');return false;}
  }
  this.starting=false;if(this.wantStop)return false;
  return this.begin(true);
 },
 begin(first){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const r=new SR();r.lang='en-GB';r.interimResults=true;r.continuous=true;r.maxAlternatives=1;this.cur='';
  r.onresult=ev=>{let fin='',interim='';for(let i=0;i<ev.results.length;i++){const t=ev.results[i][0].transcript;if(ev.results[i].isFinal)fin+=t+' ';else interim+=t;}
   this.cur=(fin+interim).trim();if(this.onText)this.onText(this.text(),false);
   if(this.mode==='toggle'){clearTimeout(this.silT);this.silT=setTimeout(()=>this.stop(0),2200);}};
  r.onerror=ev=>{if(ev.error==='no-speech'||ev.error==='aborted')return;this.active=false;clearTimeout(this.silT);this.wantStop=true;if(this.onState)this.onState(false,ev.error);};
  r.onend=()=>{
   this.acc=this.text();this.cur='';
   if(!this.wantStop&&this.active){try{this.begin(false);return;}catch(e){}}   // browser ended the session on its own while still held: keep listening
   const was=this.active;this.active=false;clearTimeout(this.silT);if(this.onState)this.onState(false,'end');
   if(was&&this.onDone)this.onDone(this.acc);this.acc='';
  };
  try{r.start();this.rec=r;this.active=true;if(first&&this.onState)this.onState(true);return true;}catch(e){this.active=false;if(this.onState)this.onState(false,String(e&&e.message||e));return false;}
 },
 stop(delay){
  this.wantStop=true;
  const go=()=>{clearTimeout(this.silT);if(this.rec&&this.active){try{this.rec.stop();}catch(e){}}};
  if(delay)setTimeout(go,delay);else go();
 }
};
