// R2 isolate: original procedural toy recordings and device-local audio.
// No recordings copied from Ultraman or commercial music; no remote TTS;
// runtime speech is requested only of a confirmed device-local Cantonese voice.
export const MONSTER_SOUND_IDS=Object.freeze(['fire-dragon','ice-dragon','robot','electric','dinosaur','horn','wing','bat','octopus','deep-sea','rock','lava','alien','slime']);
export const HERO_PROMPTS=Object.freeze({
  'guardian-red':'唔好切超人呀！','guardian-blue':'超人係自己友！','guardian-gold':'小心，呢個係好人！',
  'guardian-green':'哎呀，切錯喇！','guardian-violet':'英雄唔可以切㗎！','guardian-silver':'停一停，保護超人！',
});
export const HERO_CUES=Object.freeze(Object.fromEntries(Object.keys(HERO_PROMPTS).map(id=>[id,`wrong-${id}`])));
export const MONSTER_CUES=Object.freeze(Object.fromEntries(MONSTER_SOUND_IDS.flatMap(roleId=>['appear','defeat'].map(kind=>{
  const cue=`${kind}-${roleId}`,file=`${roleId}-${kind}.wav`;
  return[cue,Object.freeze({cue,roleId,kind,file,src:new URL(`../assets/monster/audio/${file}`,import.meta.url).href})];
}))));

const EFFECT_LIMIT=6,EFFECT_GAIN=.76,MUSIC_GAIN=.42,MAX_LOCAL_BYTES=128*1024*1024;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clamp01=x=>Number.isFinite(Number(x))?Math.min(1,Math.max(0,Number(x))):0;
const supportedFile=file=>file&&Number.isFinite(file.size)&&file.size>0&&file.size<=MAX_LOCAL_BYTES&&(
  /^audio\//i.test(file.type||'')||(!file.type&&/\.(mp3|m4a|aac|wav|ogg|opus|flac|aif|aiff)$/i.test(file.name||'')));
async function fetchCue(clip,{signal}={}){
  const src=new URL(clip.src);
  if(globalThis.location?.origin&&src.origin!==globalThis.location.origin)throw new Error('same-origin cue asset required');
  const r=await globalThis.fetch(src,{credentials:'same-origin',cache:'force-cache',signal});
  if(!r.ok)throw new Error(`Missing cue ${clip.cue} (${r.status})`);return r.arrayBuffer();
}
function decode(ctx,bytes){return new Promise((resolve,reject)=>{
  try{const p=ctx.decodeAudioData(bytes,resolve,reject);if(p?.then)p.then(resolve,reject);}catch(e){reject(e);}
});}
export function isLocalCantoneseVoice(v){
  if(v?.localService!==true)return false;
  const lang=(v.lang||'').toLowerCase().replaceAll('_','-');
  return lang==='yue'||lang.startsWith('yue-')||lang==='zh-yue'||lang.startsWith('zh-yue-')||
    (['zh-hk','zh-mo','zh-hant-hk','zh-hant-mo'].includes(lang)&&/cantonese|粵語|粤语|廣東話|广东话|sin[-\s]?ji/i.test(v.name||''));
}
export function chooseLocalCantoneseVoice(voices=[]){return voices.find(v=>isLocalCantoneseVoice(v)&&/yue/i.test(v.lang||''))||voices.find(isLocalCantoneseVoice)||null;}

export class MonsterAudio {
  constructor({contextFactory=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;},fetchEffect=fetchCue,
    audioElementFactory=()=>typeof globalThis.Audio==='function'?new globalThis.Audio():null,urlAPI=globalThis.URL,
    speech=globalThis.speechSynthesis,utteranceFactory=text=>typeof globalThis.SpeechSynthesisUtterance==='function'?new globalThis.SpeechSynthesisUtterance(text):null,
    onHeroPrompt=()=>{},onLocalPlaybackError=()=>{},documentTarget=globalThis.document,windowTarget=globalThis.window,metadataTimeout=8000}={}){
    this._factory=contextFactory;this._fetchEffect=fetchEffect;this._audioFactory=audioElementFactory;this._URL=urlAPI;
    this._speech=speech;this._utteranceFactory=utteranceFactory;this._onHeroPrompt=onHeroPrompt;this._onLocalPlaybackError=onLocalPlaybackError;
    this._doc=documentTarget;this._win=windowTarget;this._metadataTimeout=metadataTimeout;
    this._ctx=null;this._fxBus=null;this._musicBus=null;this._unlock=null;this._controller=null;this._buffers=new Map();this._effects=new Set();this._seen=new Set();
    this._paused=false;this._muted=false;this._disposed=false;this._speechGeneration=0;this._speechPending=false;
    this._selection=null;this._candidate=null;this._selectionEpoch=0;this._playEpoch=0;this._playPending=null;this._musicWanted=false;
    this.effectsVolume=.75;this.musicVolume=.55;this.speechMode='text-only';
    this._hidden=()=>{if(this._doc?.hidden)this.pause();};
    this._pagehide=()=>{this.stop();this.clearLocalFile();};
    this._doc?.addEventListener?.('visibilitychange',this._hidden);this._win?.addEventListener?.('pagehide',this._pagehide);
  }
  get available(){return this._ctx?.state==='running';}
  get readyCount(){return this._buffers.size;}
  get localMusicState(){if(this._candidate)return 'checking';if(!this._selection)return 'none';if(this._selection.failed)return 'unavailable';return this._selection.audio.paused?'selected':'playing';}
  _gain(bus,v){if(!bus)return;try{const now=this._ctx.currentTime;bus.gain.cancelScheduledValues(now);bus.gain.setValueAtTime(bus.gain.value,now);bus.gain.linearRampToValueAtTime(v,now+.025);}catch{bus.gain.value=v;}}
  _syncVolumes(){
    const effects=this._muted?0:this.effectsVolume*EFFECT_GAIN, music=this._muted?0:this.musicVolume*MUSIC_GAIN;
    this._gain(this._fxBus,effects);this._gain(this._musicBus,music);
    const s=this._selection;if(s){try{s.audio.volume=s.source?1:music;s.audio.muted=this._muted||this.musicVolume===0;}catch{}}
  }
  unlock(){
    if(this._disposed)return Promise.resolve(false);
    if(this._unlock)return this._unlock;
    try{
      if(!this._ctx||this._ctx.state==='closed'){
        if(this._selection?.source)this._failLocal(this._selection);
        this._controller?.abort();this._controller=null;this._buffers.clear();this._stopEffects();
        const ctx=this._factory();if(!ctx)return Promise.resolve(false);
        this._ctx=ctx;this._fxBus=ctx.createGain();this._musicBus=ctx.createGain();
        this._fxBus.connect(ctx.destination);this._musicBus.connect(ctx.destination);this._syncVolumes();
        ctx.addEventListener?.('statechange',()=>{if(this._ctx!==ctx)return;if(ctx.state!=='running'){this._stopEffects();this._cancelSpeech();if(this._selection?.source)this._pauseMedia();}});
      }
      // Gesture activation occurs before fetch/decode awaits.
      const ctx=this._ctx, resumed=ctx.state==='running'?Promise.resolve():ctx.resume();
      this._unlock=Promise.resolve(resumed).then(async()=>{
        if(this._disposed||this._ctx!==ctx||ctx.state!=='running')return false;
        const missing=Object.values(MONSTER_CUES).filter(clip=>!this._buffers.has(clip.cue));
        if(!missing.length)return true;
        const controller=typeof AbortController==='function'?new AbortController():null;this._controller=controller;
        await Promise.all(missing.map(async clip=>{
          try{const bytes=await this._fetchEffect(clip,{signal:controller?.signal});const b=await decode(ctx,bytes);
            if(!this._disposed&&this._ctx===ctx&&b&&Number.isFinite(b.duration)&&b.duration>=.1&&b.duration<1)this._buffers.set(clip.cue,b);
          }catch{/* missing asset remains visible in readyCount; next gesture may retry */}
        }));
        if(this._controller===controller)this._controller=null;
        return !this._disposed&&this._ctx===ctx&&this._buffers.size===28;
      }).catch(()=>false).finally(()=>{this._unlock=null;});
      return this._unlock;
    }catch{this._unlock=null;return Promise.resolve(false);}
  }
  _remember(id){if((typeof id!=='string'&&typeof id!=='number')||String(id)===''||this._seen.has(String(id)))return false;this._seen.add(String(id));if(this._seen.size>8192)this._seen.delete(this._seen.values().next().value);return true;}
  event(e={}){
    const {id,roleId,kind,cue}=e||{};
    const isHero=own(HERO_PROMPTS,roleId)&&kind==='wrong'&&cue===HERO_CUES[roleId];
    const key=`${kind}-${roleId}`,clip=MONSTER_CUES[key];
    if(!isHero&&(!clip||cue!==key))return{triggered:false,played:false,reason:'unknown-event'};
    if(!this._remember(id))return{triggered:false,played:false,reason:'duplicate-or-missing-id'};
    if(this._disposed||this._paused)return{triggered:false,played:false,reason:'paused-or-disposed'};
    if(isHero)return this._hero(e);
    if(this._muted||this.effectsVolume===0)return{triggered:true,played:false,reason:'muted'};
    const buffer=this._buffers.get(key);
    if(!this.available||!buffer)return{triggered:true,played:false,reason:'not-ready'};
    if(this._effects.size>=EFFECT_LIMIT)return{triggered:true,played:false,reason:'voice-limit'};
    let src;try{
      src=this._ctx.createBufferSource();src.buffer=buffer;src.connect(this._fxBus);this._effects.add(src);
      src.onended=()=>{this._effects.delete(src);try{src.disconnect();}catch{}};src.start();
      return{triggered:true,played:true,reason:'ok',cue:key};
    }catch{this._effects.delete(src);try{src?.disconnect();}catch{}return{triggered:true,played:false,reason:'playback-error'};}
  }
  _hero(e){
    const phrase=HERO_PROMPTS[e.roleId],result={triggered:true,played:false,phrase,speech:false,speechMode:'text-only',reason:'local-cantonese-unavailable'};
    this.speechMode='text-only';try{this._onHeroPrompt({...e,phrase});}catch{}
    if(this._muted||!this.effectsVolume){result.reason='muted';return result;}
    let voice;try{voice=chooseLocalCantoneseVoice(this._speech?.getVoices?.()||[]);}catch{return result;}
    if(!voice)return result;
    // A new collision supersedes an unfinished speech cue, preventing a stale
    // backlog or overlapping speech. The distinct text always fires per event.
    this._cancelSpeech();const generation=this._speechGeneration;
    try{
      const utterance=this._utteranceFactory(phrase);if(!utterance)return result;
      utterance.voice=voice;utterance.lang=voice.lang;utterance.volume=.66*this.effectsVolume;utterance.rate=1.02;utterance.pitch=1;
      utterance.onend=()=>{if(this._speechGeneration===generation)this._speechPending=false;};
      utterance.onerror=()=>{if(this._speechGeneration===generation){this._speechPending=false;this.speechMode='text-only';}};
      this._speechPending=true;this._speech.speak(utterance);this.speechMode='local-cantonese-requested';
      return{...result,played:true,speech:true,speechMode:this.speechMode,reason:'requested'};
    }catch{this._speechPending=false;this.speechMode='text-only';return result;}
  }
  _cancelSpeech(){this._speechGeneration++;if(this._speechPending){try{this._speech?.cancel?.();}catch{}}this._speechPending=false;}
  _stopEffects(){for(const s of this._effects){try{s.stop();}catch{}try{s.disconnect();}catch{}}this._effects.clear();}
  setEffectsVolume(v){this.effectsVolume=clamp01(v);this._syncVolumes();if(!this.effectsVolume){this._stopEffects();this._cancelSpeech();}}
  setMusicVolume(v){this.musicVolume=clamp01(v);this._syncVolumes();}
  setMuted(flag){this._muted=Boolean(flag);this._syncVolumes();if(this._muted){this._stopEffects();this._cancelSpeech();}}

  // Only a Blob URL produced from an explicitly selected device file is valid.
  // There is no URL/text input, remote music request, recording API or upload.
  _release(record){if(!record)return;try{record.audio.pause();}catch{}try{record.source?.disconnect();}catch{}try{record.audio.removeEventListener?.('error',record.onError);}catch{}try{record.audio.removeAttribute('src');record.audio.load();}catch{}try{if(record.url)this._URL.revokeObjectURL(record.url);}catch{}record.url=null;}
  _cancelCandidate(){const c=this._candidate;if(c){this._candidate=null;c.finish?.(false);this._release(c);}}
  async chooseLocalFile(file){
    if(this._disposed||!supportedFile(file)||typeof this._URL?.createObjectURL!=='function')return false;
    const token=++this._selectionEpoch;this._cancelCandidate();let audio,url;
    try{audio=this._audioFactory();if(!audio)return false;url=this._URL.createObjectURL(file);if(!String(url).startsWith('blob:')){this._URL.revokeObjectURL(url);return false;}}
    catch{return false;}
    const rec={audio,url,source:null,failed:false,finish:null};this._candidate=rec;
    try{if(file.type&&typeof audio.canPlayType==='function'&&!audio.canPlayType(file.type)){this._candidate=null;this._release(rec);return false;}}
    catch{this._candidate=null;this._release(rec);return false;}
    const valid=await new Promise(resolve=>{
      let finished=false,timer=null;
      const clean=()=>{if(timer!==null)clearTimeout(timer);audio.removeEventListener?.('loadedmetadata',ok);audio.removeEventListener?.('error',bad);audio.removeEventListener?.('abort',bad);};
      const finish=flag=>{if(finished)return;finished=true;clean();resolve(flag);};rec.finish=finish;
      const ok=()=>finish(!audio.error&&Number.isFinite(audio.duration)&&audio.duration>0),bad=()=>finish(false);
      audio.addEventListener?.('loadedmetadata',ok);audio.addEventListener?.('error',bad);audio.addEventListener?.('abort',bad);
      timer=setTimeout(bad,this._metadataTimeout);
      try{audio.preload='metadata';audio.loop=true;audio.playsInline=true;audio.src=url;audio.load?.();if(audio.readyState>=1)ok();}catch{bad();}
    });
    if(this._disposed||this._selectionEpoch!==token||this._candidate!==rec)return false;
    this._candidate=null;
    if(!valid){this._release(rec);return false;}
    this._playEpoch++;this._playPending=null;this._release(this._selection);this._selection=rec;
    rec.onError=()=>{if(this._selection===rec)this._failLocal(rec);};rec.audio.addEventListener?.('error',rec.onError);this._syncVolumes();
    if(this._musicWanted&&!this._paused)this._playLocal();return true;
  }
  hasLocalMusic(){return !!this._selection&&!this._selection.failed;}
  _connectMedia(rec){
    if(rec.source||!this.available||typeof this._ctx.createMediaElementSource!=='function')return;
    try{rec.source=this._ctx.createMediaElementSource(rec.audio);rec.source.connect(this._musicBus);this._syncVolumes();}catch{if(rec.source)this._failLocal(rec);else rec.source=null;}
  }
  _failLocal(rec){if(rec.failed)return;const wanted=this._musicWanted;rec.failed=true;this._musicWanted=false;this._playEpoch++;this._playPending=null;this._release(rec);if(wanted)try{this._onLocalPlaybackError();}catch{}}
  _playLocal(){
    const rec=this._selection;if(!rec||rec.failed||this._paused||!this._musicWanted||this._disposed)return false;
    if(rec.audio.paused===false||this._playPending?.rec===rec)return true;
    this._connectMedia(rec);if(rec.failed)return false;this._syncVolumes();const attempt=++this._playEpoch;
    const pending={rec,attempt};this._playPending=pending;
    const fail=()=>{if(this._selection!==rec||this._playEpoch!==attempt)return;this._failLocal(rec);};
    try{const p=rec.audio.play();Promise.resolve(p).then(()=>{if(this._selection!==rec||!this._musicWanted||this._paused||this._disposed)try{rec.audio.pause();}catch{}}).catch(fail).finally(()=>{if(this._playPending===pending)this._playPending=null;});return true;}catch{if(this._playPending===pending)this._playPending=null;fail();return false;}
  }
  startLocalMusic(){if(!this.hasLocalMusic()||this._disposed)return false;this._musicWanted=true;return this._paused?true:this._playLocal();}
  stopLocalMusic(){this._musicWanted=false;this._pauseMedia();}
  _pauseMedia(){this._playEpoch++;this._playPending=null;try{this._selection?.audio.pause();}catch{}}
  clearLocalFile(){this._selectionEpoch++;this._cancelCandidate();this._musicWanted=false;this._playEpoch++;this._playPending=null;this._release(this._selection);this._selection=null;}
  pause(){this._paused=true;this._stopEffects();this._cancelSpeech();this._pauseMedia();}
  resume(){if(this._disposed)return;const wasPaused=this._paused;this._paused=false;if(wasPaused&&this._musicWanted)this._playLocal();}
  stop(){this._musicWanted=false;this._paused=false;this._stopEffects();this._cancelSpeech();this._pauseMedia();try{if(this._selection)this._selection.audio.currentTime=0;}catch{}this._seen.clear();}
  dispose(){if(this._disposed)return;this.stop();this.clearLocalFile();this._disposed=true;this._controller?.abort();this._buffers.clear();
    this._doc?.removeEventListener?.('visibilitychange',this._hidden);this._win?.removeEventListener?.('pagehide',this._pagehide);
    try{this._fxBus?.disconnect();this._musicBus?.disconnect();}catch{}try{Promise.resolve(this._ctx?.close?.()).catch(()=>{});}catch{}this._ctx=null;
  }
}
