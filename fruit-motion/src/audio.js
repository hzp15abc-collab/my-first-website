// V1.6: attributed same-origin recordings only; no synthesis, remote stream
// or microphone access. Audio failures must never block play.
import { DEFAULT_MUSIC, MUSIC_TRACKS } from './music-catalog.js';
import { DEFAULT_SFX, SFX_BANKS, SFX_COMBO_DELAY } from './sfx-catalog.js?v=1.7';
export { DEFAULT_MUSIC, MUSIC_TRACKS, MUSIC_LICENSE, MUSIC_LICENSE_URL, normalizeMusicStyle } from './music-catalog.js';

const clamp01 = v => Number.isFinite(Number(v)) ? Math.max(0, Math.min(1, Number(v))) : 0;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const EFFECT_LIMIT = 12;
const INTERVALS = Object.freeze({slice:.055, combo:.11, bomb:.25, countdown:.12, start:.12, end:.18, wave:.16});
const loadController = () => typeof AbortController === 'function' ? new AbortController() : null;

async function loadRecording(clip, {signal} = {}) {
  const response = await globalThis.fetch(clip.src, {credentials:'same-origin',cache:'force-cache',signal});
  if (!response.ok) throw new Error(`Recording unavailable (${response.status})`);
  return response.arrayBuffer();
}
function decodeRecording(ctx, bytes) {
  return new Promise((resolve,reject) => {
    try {
      const promise=ctx.decodeAudioData(bytes,resolve,reject);
      if (promise && typeof promise.then==='function') promise.then(resolve,reject);
    } catch (error) { reject(error); }
  });
}
function loopOffset(offset,start,end) {
  return offset < end ? Math.max(0,offset) : start+(offset-end)%(end-start);
}

export class GameAudio {
  constructor({contextFactory = () => {
    const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
    return Audio ? new Audio() : null;
  },fetchTrack=loadRecording,fetchEffect=loadRecording} = {}) {
    this._factory=contextFactory;
    this._fetchTrack=fetchTrack; this._fetchEffect=fetchEffect;
    this._ctx=null; this._unlockPromise=null; this._unlockFailed=false;
    this._musicBus=null; this._effectsBus=null; this._master=null; this._compressor=null;
    this._musicWanted=false;
    this._preparedTrack=null; this._loadingTrack=null; this._failedFiles=new Set();
    this._fileTrack=null; this._fadingTracks=new Set(); this._trackOffset=0;
    this._effectVoices=new Set(); this._effectBuffers=new Map();
    this._preparedEffects=null; this._loadingEffects=null; this._failedEffects=new Set();
    this._lastEffect=new Map(); this._effectCursor=new Map();
    this._timer=null; // diagnostic compatibility; no oscillator scheduler
    this.musicStyle=DEFAULT_MUSIC; this.effectsStyle=DEFAULT_SFX;
    this.musicVolume=.55; this.effectsVolume=.75;
  }
  get available() { return !!this._ctx && this._ctx.state==='running'; }
  get musicPlaying() { return !!this._fileTrack && this._musicWanted && this.musicStyle!=='off' && this.available; }
  get musicSourceKind() {
    if(this.musicStyle==='off')return 'off';
    if(this.musicPlaying)return 'recording';
    if(this._loadingTrack)return 'loading';
    if(this._failedFiles.has(this.musicStyle)||this._unlockFailed)return 'unavailable';
    return 'idle';
  }
  get effectsSourceKind() {
    if(this.effectsStyle==='off')return 'off';
    if(this._loadingEffects)return 'loading';
    if(this._failedEffects.has(this.effectsStyle)||this._unlockFailed)return 'unavailable';
    if(this.available&&this._preparedEffects?.style===this.effectsStyle)return 'recording';
    return 'idle';
  }

  // Resume on the real gesture, before awaiting any download or decoding.
  unlock() {
    if(this._unlockPromise)return this._unlockPromise;
    const failed=()=>{this._unlockFailed=true;return false;};
    try {
      if(!this._ctx||this._ctx.state==='closed') {
        this._stopFileTrack({immediate:true});this._dropPreparedTrack();
        this._cancelEffects();this._dropPreparedEffects();
        this._failedFiles.clear();this._failedEffects.clear();
        const ctx=this._factory();if(!ctx)return Promise.resolve(failed());
        this._ctx=ctx;this._musicBus=ctx.createGain();this._effectsBus=ctx.createGain();this._master=ctx.createGain();
        this._compressor=null;
        this._musicBus.connect(this._master);this._effectsBus.connect(this._master);
        this._master.gain.value=.85;
        // Conservative master gain and optional compressor protect mix peaks.
        if(typeof ctx.createDynamicsCompressor==='function') {
          this._compressor=ctx.createDynamicsCompressor();
          this._compressor.threshold.value=-8;this._compressor.knee.value=12;
          this._compressor.ratio.value=3;this._compressor.attack.value=.004;this._compressor.release.value=.13;
          this._master.connect(this._compressor);this._compressor.connect(ctx.destination);
        } else this._master.connect(ctx.destination);
        this._syncVolumes(true);
        ctx.addEventListener?.('statechange',()=>{
          if(this._ctx!==ctx)return;
          if(ctx.state==='running'){
            this._primeFileTrack();this._primeEffects();this._beginFileTrack();
          }else{
            this._stopFileTrack({keepOffset:true,immediate:true});this._cancelEffects();this._lastEffect.clear();
            if(ctx.state==='closed'){this._dropPreparedTrack();this._dropPreparedEffects();}
          }
        });
      }
      const ctx=this._ctx;
      const activate=()=>{
        if(this._ctx!==ctx||ctx.state!=='running')return failed();
        this._unlockFailed=false;
        // Retry only on an explicit gesture, never an animation frame.
        this._failedFiles.delete(this.musicStyle);this._failedEffects.delete(this.effectsStyle);
        this._primeFileTrack();this._primeEffects();this._beginFileTrack();
        return true;
      };
      if(ctx.state==='running')return Promise.resolve(activate());
      const resumed=ctx.resume();
      this._unlockPromise=Promise.resolve(resumed).then(activate,failed).finally(()=>{this._unlockPromise=null;});
      return this._unlockPromise;
    }catch{this._unlockPromise=null;return Promise.resolve(failed());}
  }
  _setBus(bus,value,immediate=false){
    if(!bus)return;const p=bus.gain;
    try{
      const now=this._ctx.currentTime;
      p.cancelScheduledValues(now);
      if(immediate)p.setValueAtTime(value,now);
      else{p.setValueAtTime(p.value,now);p.linearRampToValueAtTime(value,now+.025);}
    }catch{p.value=value;}
  }
  _syncVolumes(immediate=false){
    this._setBus(this._musicBus,this.musicStyle==='off'?0:this.musicVolume,immediate);
    this._setBus(this._effectsBus,this.effectsStyle==='off'?0:this.effectsVolume,immediate);
  }
  setMusic(style){
    if(typeof style!=='string'||(style!=='off'&&!own(MUSIC_TRACKS,style)))return false;
    if(style===this.musicStyle)return true;
    this._stopFileTrack();this._dropPreparedTrack();
    this.musicStyle=style;this._failedFiles.delete(style);this._syncVolumes();this._primeFileTrack();
    return true;
  }
  setEffects(style){
    if(typeof style!=='string'||(style!=='off'&&!own(SFX_BANKS,style)))return false;
    if(style===this.effectsStyle)return true;
    this._cancelEffects();this._dropPreparedEffects();
    this.effectsStyle=style;this._failedEffects.delete(style);this._lastEffect.clear();this._effectCursor.clear();
    this._syncVolumes();this._primeEffects();
    return true;
  }
  setMusicVolume(value){this.musicVolume=clamp01(value);this._setBus(this._musicBus,this.musicStyle==='off'?0:this.musicVolume);}
  setEffectsVolume(value){this.effectsVolume=clamp01(value);this._setBus(this._effectsBus,this.effectsStyle==='off'?0:this.effectsVolume);if(!this.effectsVolume)this._cancelEffects();}

  startMusic(){this._musicWanted=true;this._primeFileTrack();this._beginFileTrack();}
  pauseMusic(){this._musicWanted=false;this._stopFileTrack({keepOffset:true});this._cancelEffects();this._lastEffect.clear();}
  stopMusic(){this.pauseMusic();this._trackOffset=0;}
  _supportsRecordings(){return typeof this._ctx?.createBufferSource==='function'&&typeof this._ctx?.decodeAudioData==='function';}
  _dropPreparedTrack(){
    const pending=this._loadingTrack;this._loadingTrack=null;this._preparedTrack=null;
    try{pending?.controller?.abort();}catch{}
  }
  _primeFileTrack(){
    const style=this.musicStyle,track=MUSIC_TRACKS[style],ctx=this._ctx;
    if(!track||!this.available||this._failedFiles.has(style))return Promise.resolve(false);
    if(!this._supportsRecordings()){this._failedFiles.add(style);return Promise.resolve(false);}
    if(this._preparedTrack?.style===style&&this._preparedTrack.ctx===ctx)return Promise.resolve(true);
    if(this._loadingTrack?.style===style&&this._loadingTrack.ctx===ctx)return this._loadingTrack.promise;
    this._dropPreparedTrack();
    const controller=loadController(),pending={style,ctx,controller,promise:null};
    this._loadingTrack=pending;
    const current=()=>this._loadingTrack===pending&&this._ctx===ctx&&this.musicStyle===style;
    pending.promise=Promise.resolve().then(()=>this._fetchTrack(track,{signal:controller?.signal})).then(bytes=>{
      return current()?decodeRecording(ctx,bytes):null;
    }).then(buffer=>{
      if(!current())return false;
      if(!buffer||!Number.isFinite(buffer.duration)||buffer.duration<.5)throw Error('Invalid recording');
      const loopEnd=Math.min(buffer.duration,Number.isFinite(track.loopEnd)?track.loopEnd:buffer.duration);
      const loopStart=Math.min(Math.max(0,Number(track.loopStart)||0),Math.max(0,loopEnd-.25));
      if(loopEnd-loopStart<.25)throw Error('Invalid loop range');
      this._loadingTrack=null;this._preparedTrack={style,ctx,buffer,loopStart,loopEnd};
      this._beginFileTrack();return true;
    }).catch(()=>{
      if(current()){this._loadingTrack=null;this._failedFiles.add(style);}return false;
    });
    return pending.promise;
  }
  _beginFileTrack(){
    const ready=this._preparedTrack;
    if(!this._musicWanted||!this.available||this._failedFiles.has(this.musicStyle)||!ready||
      ready.style!==this.musicStyle||ready.ctx!==this._ctx||this._fileTrack)return false;
    this._stopFadingTracks();const ctx=ready.ctx;
    let source,envelope;
    try{
      source=ctx.createBufferSource();envelope=ctx.createGain();
      source.buffer=ready.buffer;source.loop=true;source.loopStart=ready.loopStart;source.loopEnd=ready.loopEnd;
      source.connect(envelope);envelope.connect(this._musicBus);
      const at=ctx.currentTime+.006,offset=loopOffset(this._trackOffset,ready.loopStart,ready.loopEnd);
      envelope.gain.setValueAtTime(0,ctx.currentTime);envelope.gain.linearRampToValueAtTime(1,at+.055);
      const playing={ctx,source,envelope,at,offset,duration:ready.buffer.duration,loopStart:ready.loopStart,loopEnd:ready.loopEnd};
      source.onended=()=>{if(this._fileTrack===playing)this._fileTrack=null;this._disconnectFileTrack(playing);};
      this._fileTrack=playing;source.start(at,offset);return true;
    }catch{
      this._fileTrack=null;try{source?.disconnect();envelope?.disconnect();}catch{}
      this._failedFiles.add(this.musicStyle);return false;
    }
  }
  _disconnectFileTrack(playing){
    this._fadingTracks.delete(playing);
    try{playing.source.disconnect();}catch{}try{playing.envelope.disconnect();}catch{}
  }
  _stopFadingTracks(){
    for(const playing of this._fadingTracks){
      const now=playing.ctx.currentTime;
      try{playing.envelope.gain.cancelScheduledValues(now);playing.envelope.gain.setValueAtTime(0,now);playing.source.stop(now);}catch{}
      this._disconnectFileTrack(playing);
    }
  }
  _stopFileTrack({keepOffset=false,immediate=false}={}){
    if(immediate)this._stopFadingTracks();
    const playing=this._fileTrack;this._fileTrack=null;
    if(!keepOffset)this._trackOffset=0;
    if(!playing)return;
    const now=playing.ctx.currentTime;
    if(keepOffset)this._trackOffset=loopOffset(playing.offset+Math.max(0,now-playing.at),playing.loopStart,playing.loopEnd);
    try{
      const p=playing.envelope.gain;p.cancelScheduledValues(now);p.setValueAtTime(now<playing.at?0:Math.max(0,p.value),now);
      const fade=immediate||playing.ctx.state!=='running'||now<playing.at?0:.045;
      if(fade){p.linearRampToValueAtTime(0,now+fade);this._fadingTracks.add(playing);}else p.setValueAtTime(0,now);
      playing.source.stop(now+fade);if(!fade)this._disconnectFileTrack(playing);
    }catch{this._disconnectFileTrack(playing);}
  }
  _duckFileTrack(event){
    if(!this._fileTrack||!['slice','combo','bomb'].includes(event))return;
    const p=this._fileTrack.envelope.gain,now=this._ctx.currentTime;
    try{
      const target=event==='bomb'?.64:event==='combo'?.69:.73;
      if(typeof p.cancelAndHoldAtTime==='function')p.cancelAndHoldAtTime(now);
      else{p.cancelScheduledValues(now);p.setValueAtTime(p.value,now);}
      p.linearRampToValueAtTime(target,now+.022);p.linearRampToValueAtTime(1,now+.19);
    }catch{}
  }

  _dropPreparedEffects(){
    const pending=this._loadingEffects;this._loadingEffects=null;this._preparedEffects=null;this._effectBuffers.clear();
    try{pending?.controller?.abort();}catch{}
  }
  _primeEffects(){
    const style=this.effectsStyle,bank=SFX_BANKS[style],ctx=this._ctx;
    if(!bank||!this.available||this._failedEffects.has(style))return Promise.resolve(false);
    if(!this._supportsRecordings()){this._failedEffects.add(style);return Promise.resolve(false);}
    if(this._preparedEffects?.style===style&&this._preparedEffects.ctx===ctx)return Promise.resolve(true);
    if(this._loadingEffects?.style===style&&this._loadingEffects.ctx===ctx)return this._loadingEffects.promise;
    this._dropPreparedEffects();
    const controller=loadController(),pending={style,ctx,controller,promise:null};this._loadingEffects=pending;
    const clips=[...new Map(Object.values(bank).flat().map(clip=>[clip.id,clip])).values()];
    const buffers=new Map();let index=0;
    const current=()=>this._loadingEffects===pending&&this._ctx===ctx&&this.effectsStyle===style;
    async function worker(audio){
      while(current()&&index<clips.length){
        const clip=clips[index++],bytes=await audio._fetchEffect(clip,{signal:controller?.signal});
        if(!current())return;
        const buffer=await decodeRecording(ctx,bytes);
        if(!current())return;
        if(!buffer||!Number.isFinite(buffer.duration)||buffer.duration<.015||buffer.duration>4)throw Error('Invalid sound effect');
        buffers.set(clip.id,buffer);
      }
    }
    pending.promise=Promise.all(Array.from({length:Math.min(3,clips.length)},()=>worker(this))).then(()=>{
      if(!current())return false;
      if(!clips.length||buffers.size!==clips.length)throw Error('Incomplete sound bank');
      this._loadingEffects=null;this._effectBuffers=buffers;this._preparedEffects={style,ctx};return true;
    }).catch(()=>{
      if(current()){this._loadingEffects=null;this._failedEffects.add(style);try{controller?.abort();}catch{}}
      return false;
    });
    return pending.promise;
  }
  // Preview waits for actual recordings; regular hit events are never queued.
  readyEffects(){return this._primeEffects();}
  _releaseEffect(voice){this._effectVoices.delete(voice);try{voice.source.disconnect();}catch{}try{voice.gain.disconnect();}catch{}}
  _stopEffect(voice){try{voice.source.stop();}catch{}this._releaseEffect(voice);}
  _cancelEffects(){for(const voice of [...this._effectVoices])this._stopEffect(voice);}
  _startEffect(clip,event,at){
    const buffer=clip&&this._effectBuffers.get(clip.id);
    if(!buffer)return false;
    if(this._effectVoices.size>=EFFECT_LIMIT)this._stopEffect(this._effectVoices.values().next().value);
    let source,gain,voice;
    try{
      source=this._ctx.createBufferSource();gain=this._ctx.createGain();source.buffer=buffer;
      gain.gain.value=Math.min(1.3,Math.max(0,Number(clip.level)||0));
      source.connect(gain);gain.connect(this._effectsBus);
      voice={source,gain,clip,event,start:at};source.onended=()=>this._releaseEffect(voice);this._effectVoices.add(voice);
      source.start(at);return true;
    }catch{
      if(voice)this._releaseEffect(voice);else{try{source?.disconnect();gain?.disconnect();}catch{}}
      return false;
    }
  }
  /** A real typed collision is already deduplicated by the engine. Never
   * discard a second fruit that intersects the same sweep (or substitute its
   * sound with a different fruit). Generic settings previews retain the old
   * rate limiter and cycle the clips. Every earned combo is a short, separate
   * decoded reward scheduled after the actual cut; pause/mute/bank changes
   * cancel these pending nodes via the same voice lifecycle as ordinary FX. */
  play(event,options={}){
    if(!this.available||this.effectsStyle==='off'||!this.effectsVolume||!own(INTERVALS,event)||this._preparedEffects?.style!==this.effectsStyle)return false;
    const bank=SFX_BANKS[this.effectsStyle],clips=bank?.[event];if(!clips?.length)return false;
    const now=this._ctx.currentTime,typed=event==='slice'&&options?.fruitType!==undefined;
    const position=this._effectCursor.get(event)??0;
    const clip=typed?clips.find(c=>c.fruitType===options.fruitType):clips[position%clips.length];
    if(!clip||(!typed&&now-(this._lastEffect.get(event)??-Infinity)<INTERVALS[event]))return false;
    if(!this._startEffect(clip,event,now))return false;
    if(!typed)this._effectCursor.set(event,position+1);
    this._lastEffect.set(event,now);
    if(event==='bomb')this._lastEffect.delete('slice');
    const combo=options?.combo,reward=typed&&Number.isInteger(combo)&&combo>=3&&combo%3===0;
    if(reward&&this._startEffect(bank.combo[0],'combo',now+SFX_COMBO_DELAY))this._lastEffect.set('combo',now);
    this._duckFileTrack(reward?'combo':event);
    return true;
  }
}
