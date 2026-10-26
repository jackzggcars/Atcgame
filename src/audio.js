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
 async idle(){while(this.held||(typeof Mic!=='undefined'&&(Mic.active||Mic.starting)))await new Promise(r=>setTimeout(r,120));},
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
   const e=this.queue.shift();const spoken=toSpeech(e.text);
   try{
    let done=false;
    if(this.gemini&&this.key&&this.fails<4){
     try{const buf=await this.geminiBuffer(spoken,e.voice||'Charon',this.styleFor(e));if(buf){await this.playBuffer(buf);done=true;this.fails=0;this.status='gemini';this.nGemini++;}}
     catch(err){this.fails++;this.lastErr=String(err&&err.message||err);this.status='error';if(window.UI&&UI.voiceStatus)UI.voiceStatus();}
    }
    if(!done&&this.fallback)await this.browserSpeak(spoken,e);
   }catch(err){}
   this.release(e);
  }
  while(this.queue.length)this.release(this.queue.shift());
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
 async playBuffer(buf){await this.idle();return this._play(buf);},
 _play(buf){
  return new Promise(res=>{
   const ctx=this.ensureCtx();if(!ctx)return res();
   const t0=ctx.currentTime+0.02;const out=ctx.createGain();out.gain.value=this.vol;out.connect(ctx.destination);
   const src=ctx.createBufferSource();src.buffer=buf;
   if(this.fx){
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=380;
    const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3100;
    const sh=ctx.createWaveShaper();const c=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;c[i]=Math.tanh(x*2.2);}sh.curve=c;
    const g=ctx.createGain();g.gain.value=0.9;
    src.connect(hp);hp.connect(lp);lp.connect(sh);sh.connect(g);g.connect(out);
    const ns=ctx.createBufferSource();ns.buffer=this.noiseBuf(buf.duration+0.4);const nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=1800;nf.Q.value=0.6;const ng=ctx.createGain();ng.gain.value=0.035;
    ns.connect(nf);nf.connect(ng);ng.connect(out);ns.start(t0);
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
  return new Promise(res=>{
   if(!('speechSynthesis' in window)){res();return;}
   const vs=this.pickVoices();const u=new SpeechSynthesisUtterance(text);
   let h=0;for(const ch of (e.cs||'x'))h=(h*31+ch.charCodeAt(0))>>>0;
   if(vs.length)u.voice=vs[h%vs.length];u.rate=e.urgent?1.2:1.08;u.pitch=0.75+((h>>3)%9)/12;u.volume=this.vol;
   let fin=false;const done=()=>{if(!fin){fin=true;res();}};u.onend=done;u.onerror=done;
   setTimeout(done,15000);
   try{speechSynthesis.speak(u);}catch(err){done();}
  });
 },
 async test(){
  this.ensureCtx();this.fails=0;this.lastErr='';
  const e={text:'Marlow Tower, Speedbird 452, holding point Bravo, runway 09, ready for departure.',voice:'Charon',accent:'British',cs:'BAW452',urgent:false};
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
