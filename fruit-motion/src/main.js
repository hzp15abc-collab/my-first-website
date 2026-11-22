import { FruitGame } from './game.js';
import { MotionTracker } from './motion.js';
import { coverCameraLayout, mapCameraPoint, belongsToCameraLayout } from './camera-layout.js';
import { createFullscreenController } from './fullscreen.js';
import { GameAudio } from './audio.js?v=1.7';
import { DEFAULT_MUSIC, MUSIC_TRACKS, normalizeMusicStyle } from './music-catalog.js';
import { DEFAULT_SFX, SFX_BANK_LABELS, normalizeEffectsStyle } from './sfx-catalog.js?v=1.7';
import { ROUND_SECONDS, formatRoundTime, effectiveFrameSeconds, bestForMode } from './round-config.js';
import { requestFrontCamera } from './camera-capture.js';
import { StartGestureGate } from './start-gesture.js';

const $ = (id) => document.getElementById(id);
const app = $('app'), video = $('camera'), canvas = $('gameCanvas');
const hud = $('hud'), status = $('bottomStatus'), trackingDot = $('trackingDot');
const panels = [...document.querySelectorAll('[data-panel]')];
const noHands = () => ({left:null,right:null});
const qa = new URLSearchParams(location.search).has('qa');
let screen = 'intro', mode = 'none', tracker = null, session = 0, lastFrame = null;
let countdownEnd = 0, countdownMode = 'new', lastCountdown = null;
let muted = false, needsCamera = false, lastTrackingAt = 0, trackedSince = 0;
let missingSince = 0, autoPaused = false;
let latestHands = noHands(), lastPerf = null;
let lastCaptureSettings = null;
let currentGeometry=null, geometryKey='', geometryChangedAt=-Infinity, geometryDirty=true, recalibrateOnSample=false;
let latestSampleTime=-Infinity, diagnosticMode=false;
const startGesture=new StartGestureGate();
const pointers = new Set();
const SETTINGS_KEY='fruit-planet-settings-v11';
const DEFAULT_PREFS={mode:'active',music:DEFAULT_MUSIC,effects:DEFAULT_SFX,musicVolume:.55,effectsVolume:.75,reduceMotion:false};
let prefs={...DEFAULT_PREFS};
try {
  const stored=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}');
  if(stored && typeof stored==='object'){
    if(['active','easy'].includes(stored.mode))prefs.mode=stored.mode;
    prefs.music=normalizeMusicStyle(stored.music);
    prefs.effects=normalizeEffectsStyle(stored.effects);
    for(const k of ['musicVolume','effectsVolume'])if(Number.isFinite(stored[k]))prefs[k]=Math.min(1,Math.max(0,stored[k]));
    prefs.reduceMotion=stored.reduceMotion===true;
  }
}catch{}
let settingsReturn='intro',previewing=false,effectsPreviewRequest=0;
const audio = new GameAudio();

const game = new FruitGame({ canvas,
  onScore: (v) => { $('score').textContent = String(v); },
  onTime: (v) => { $('time').textContent = formatRoundTime(v); $('timerBar').style.transform = `scaleX(${Math.max(0,Math.min(1,v / ROUND_SECONDS))})`; },
  onEnd: (result) => finishRound(typeof result === 'number' ? result : result.score),
  // Every actual hit selects that fruit's recorded-material cue. A combo
  // adds one separate short reward; it does not replace or double the cut.
  onSlice: (fruit,_points,detail={}) => audio.play('slice',{fruitType:fruit.type,combo:detail.combo||0}),
  onBomb: () => audio.play('bomb'),
  onWave: () => audio.play('wave'),
});

function savePrefs(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(prefs));}catch{}}
function applyAudioPrefs(){audio.setMusic(prefs.music);audio.setEffects(prefs.effects);audio.setMusicVolume(muted?0:prefs.musicVolume);audio.setEffectsVolume(muted?0:prefs.effectsVolume);}
function applyMotionPrefs(){game.setReducedMotion?.(prefs.reduceMotion||Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));}
function updateModeButtons(){const active=prefs.mode==='active';$('activeMode').setAttribute('aria-pressed',String(active));$('calmMode').setAttribute('aria-pressed',String(!active));app.dataset.difficulty=prefs.mode;}
function chooseMode(next){if(!['active','easy'].includes(next))return;prefs.mode=next;savePrefs();updateModeButtons();}
function syncSettings(){
  $('musicStyle').value=prefs.music;$('effectsStyle').value=prefs.effects;
  $('musicVolume').value=String(Math.round(prefs.musicVolume*100));$('effectsVolume').value=String(Math.round(prefs.effectsVolume*100));
  $('musicVolumeValue').textContent=`${Math.round(prefs.musicVolume*100)}%`;$('effectsVolumeValue').textContent=`${Math.round(prefs.effectsVolume*100)}%`;
  $('reduceMotion').checked=prefs.reduceMotion;
  $('previewMusic').disabled=prefs.music==='off'||prefs.musicVolume===0;$('previewEffects').disabled=prefs.effects==='off'||prefs.effectsVolume===0;
  $('previewMusic').textContent=previewing?'停止试听':'试听音乐';
  const track=MUSIC_TRACKS[prefs.music];
  $('musicTrackInfo').textContent=track?`${track.title} — ${track.author}${track.bpm?` · 约 ${track.bpm} BPM`:''}`:'不播放背景音乐';
  $('musicSource').hidden=!track;$('musicLicense').hidden=!track;
  if(track){$('musicSource').href=track.sourceUrl;$('musicLicense').href=track.licenseUrl;$('musicLicense').textContent=track.license;}
  syncMusicStatus();
}
function syncMusicStatus(){
  const target=$('musicStatus'),kind=audio.musicSourceKind;
  const message=!previewing?'':kind==='recording'?'♫ 正在试听原作者成品音乐':kind==='unavailable'?'此曲暂不可用。请停止试听后重试，或选择另一首。':kind==='loading'||kind==='idle'?'正在准备音乐…':'';
  if(target.textContent!==message)target.textContent=message;
  target.hidden=!message;
}
function setMute(next){muted=Boolean(next);applyAudioPrefs();$('soundIcon').textContent=muted?'×':'♪';$('soundButton').setAttribute('aria-pressed',String(muted));$('soundButton').setAttribute('aria-label',muted?'开启所有声音':'关闭所有声音');}
function startAudio(){if(!muted)void audio.unlock();}
function stopAudio(){audio.stopMusic();previewing=false;effectsPreviewRequest++;}
function beginMusic(){if(!muted)audio.startMusic();}
function openSettings(){settingsReturn=screen==='paused'?'paused':'intro';audio.pauseMusic();previewing=false;effectsPreviewRequest++;$('effectsStatus').hidden=true;$('settingsCameraNote').hidden=!(settingsReturn==='paused'&&mode==='camera'&&tracker);syncSettings();setScreen('settings');}
function closeSettings(){stopAudio();syncSettings();setScreen(settingsReturn);}
function changeSettings(){
  const oldEffects=prefs.effects;
  prefs.music=normalizeMusicStyle($('musicStyle').value);prefs.effects=normalizeEffectsStyle($('effectsStyle').value);
  prefs.musicVolume=Number($('musicVolume').value)/100;prefs.effectsVolume=Number($('effectsVolume').value)/100;
  prefs.reduceMotion=$('reduceMotion').checked;savePrefs();applyAudioPrefs();applyMotionPrefs();
  if(oldEffects!==prefs.effects||!prefs.effectsVolume){effectsPreviewRequest++;$('effectsStatus').hidden=true;}
  if(previewing&&(prefs.music==='off'||prefs.musicVolume===0)){audio.stopMusic();previewing=false;}syncSettings();
}
function bestForCurrentMode(score){
  // One-minute records were earned under a different time budget, and are
  // neither overwritten nor silently treated as a three-minute best.
  try{return bestForMode(localStorage,game.difficulty,score);}catch{return bestForMode(null,game.difficulty,score);}
}

function setScreen(next) {
  if(screen==='settings'&&next!=='settings')effectsPreviewRequest++;
  if(next!=='calibrate'&&diagnosticMode)setDiagnostic(false);
  if(next==='calibrate'&&screen!=='calibrate')startGesture.begin(performance.now());
  else if(screen==='calibrate'&&next!=='calibrate')startGesture.invalidate(performance.now());
  screen = next; app.dataset.screen = next;
  if(next!=='playing'){missingSince=0;autoPaused=false;$('trackingPrompt').hidden=true;}
  for (const panel of panels) panel.hidden = panel.dataset.panel !== next;
  const active = ['countdown','playing','paused'].includes(next);
  hud.hidden = !active; status.hidden = !(active && mode !== 'none');
  $('pauseButton').disabled = next !== 'playing';
  $('perfText').hidden = !qa;
  if (mode === 'practice') { $('trackingText').textContent = '触屏练习 · 轻轻划过水果'; trackingDot.classList.add('active'); }
  else if(mode==='camera'&&next==='countdown'){$('trackingText').textContent='体感识别 · 准备开始';trackingDot.classList.toggle('active',mappedHands().length>0);}
}
function setMode(next) { mode = next; app.dataset.mode = next; }
function clearTracking() {
  latestHands = noHands(); latestSampleTime=-Infinity;
  lastTrackingAt = 0; trackedSince=0;
  startGesture.invalidate(performance.now());
  if(screen==='calibrate')renderReadinessFeedback(startGesture.status(),null,null);
  game.clearHands();
}

// The displayed source, mapped landmarks and fruit area share the actual
// CSS game rectangle, independent of DPR, camera constraints and rotation.
// Cover crops at the edge without distorting the image or letterboxing it.
function resetComposition(){
  geometryChangedAt=performance.now();
  clearTracking();tracker?.resetHandFilter?.();game.resetInputHistory();pointers.clear();
  game.setReachZone(null);recalibrateOnSample=true;
}
function syncCameraGeometry(checkBounds=false){
  if(mode!=='camera'||!tracker||!video.srcObject)return false;
  const vw=video.videoWidth,vh=video.videoHeight;
  if(vw<=0||vh<=0){
    if(currentGeometry){currentGeometry=null;geometryKey='';resetComposition();game.setCameraBounds(null);}
    return false;
  }
  const dpr=Math.min(2,Math.max(1,globalThis.devicePixelRatio||1));
  // Live video has no copied inference-frame canvas. Only examine its actual
  // CSS rectangle on layout events, source changes or inference callbacks.
  if(!checkBounds&&!geometryDirty&&currentGeometry?.sourceWidth===vw&&currentGeometry?.sourceHeight===vh&&dpr===game.dpr)return false;
  const videoBounds=video.getBoundingClientRect(),canvasBounds=canvas.getBoundingClientRect();
  geometryDirty=false;
  if(canvasBounds.width!==game.width||canvasBounds.height!==game.height||dpr!==game.dpr)game.resize();
  // Relative CSS rect and intrinsic dimensions describe both image layers.
  const rectKey=[videoBounds.left-canvasBounds.left,videoBounds.top-canvasBounds.top,videoBounds.width,videoBounds.height,canvasBounds.width,canvasBounds.height];
  const key=[vw,vh,...rectKey.map(n=>Math.round(n*64)),dpr].join(':');
  if(key===geometryKey)return false;
  const geometry=coverCameraLayout(vw,vh,videoBounds,canvasBounds);
  if(!geometry){if(currentGeometry){currentGeometry=null;geometryKey='';resetComposition();game.setCameraBounds(null);}return false;}
  const changed=Boolean(currentGeometry)||game.running;currentGeometry=geometry;geometryKey=key;
  app.dataset.cameraFit='cover';
  if(changed)resetComposition();
  game.setCameraBounds(geometry.visible);
  return true;
}
function mapHand(point){return mapCameraPoint(point,currentGeometry);}
function portraitHint(){return game.width<game.height;}
function playableCameraArea(){return Boolean(currentGeometry&&game.playArea.width>=120&&game.playArea.height>=120);}
function readinessActive(){
  return screen==='calibrate'&&mode==='camera'&&!diagnosticMode&&!document.hidden&&$('fullscreenNotice').hidden&&playableCameraArea();
}
// The gate advances on accepted inference samples, independently of the
// renderer. Paint its current presentation at that exact sample as well as
// on RAF (which still clears expired feedback). No timing/state is advanced
// here; the original manual-readiness interval remains in updateCalibration.
function renderReadinessFeedback(gesture,left,right){
  const active=readinessActive();
  const raised=active?gesture.raised:{left:false,right:false};
  for(const [side,point] of [['left',left],['right',right]]){
    const node=$(side+'Check'),label=side==='left'?'左手':'右手';
    node.classList.toggle('ready',Boolean(point));
    node.classList.toggle('raised',Boolean(raised[side]));
    const value=raised[side]?`${label} ↑ ✓`:point?`${label} ✓`:`${label} ○`;
    if(node.textContent!==value)node.textContent=value;
  }
  const progress=active?Math.round(gesture.progress*100):0;
  const meter=$('startGestureProgress'),progressText=$('startGestureText');
  const message=active&&gesture.state==='confirmed'?'已确认！':gesture.state==='holding'&&progress>0?'保持双手举高…':left&&right?'双手举过肩膀':'等待两只小手';
  if(progressText.textContent!==message)progressText.textContent=message;
  if(meter.getAttribute('aria-valuenow')!==String(progress))meter.setAttribute('aria-valuenow',String(progress));
  $('startGestureFill').style.transform=`scaleX(${progress/100})`;
  meter.classList.toggle('holding',gesture.state==='holding'&&progress>0);
}
function updateCalibration(now=performance.now()) {
  const recent = now - lastTrackingAt < 900;
  const inside = id=>recent?mapHand(latestHands[id]):null;
  const left=inside('left'),right=inside('right');
  const enoughSpace=playableCameraArea();
  const ready = enoughSpace && Boolean(left || right);
  if (ready && !trackedSince) trackedSince=now;
  if (!ready) trackedSince=0;
  renderReadinessFeedback(startGesture.status(now),left,right);
  const stable = ready && now-trackedSince > 350;
  $('readyStart').disabled = !stable;
  $('calibrateTitle').textContent = '🙌 双手举起，开始！';
  $('calibrateText').textContent = currentGeometry&&!enoughSpace?'画面太窄，请横转设备。':left&&right?'双手举过肩，保持到进度条满。':left||right?'让另一只手也入镜，举过肩膀。':portraitHint()?'推荐横屏，让头、肩膀和双手入镜。':'设备放稳，头、肩膀和双手入镜；太远时稍靠近。';
  if(diagnosticMode){
    $('diagnosticFrameStatus').textContent=left||right?'实时画面 · 可观察游戏点':'实时画面 · 等待小手';
    const model=lastPerf?.delegate;
    $('diagnosticModel').textContent=model?`当前模型：${model}`:'当前模型：正在准备';
  }
}
function updateTracking(now=performance.now()) {
  if (mode !== 'camera') return true;
  const enoughSpace=playableCameraArea();
  const visible = enoughSpace && now - lastTrackingAt < 900 && mappedHands().length>0;
  trackingDot.classList.toggle('active',visible);
  $('trackingText').textContent = visible ? (portraitHint()?'已找到小手 · 横屏更宽':'已找到你的小手') : (currentGeometry&&!enoughSpace?'画面太窄，请调整设备方向':'让头、肩膀和双手回到画面内');
  if (!visible) game.clearHands();
  if (qa && lastPerf) $('perfText').textContent = `${Math.round(lastPerf.fps || 0)} FPS · ${Math.round(lastPerf.inferenceMs || 0)}ms`;
  if(visible){missingSince=0;if(autoPaused){autoPaused=false;game.resume();beginMusic();$('trackingPrompt').hidden=true;}}
  else { if(!missingSince) missingSince=now; if(now-missingSince>=1800&&!autoPaused){autoPaused=true;game.pause();audio.pauseMusic();$('trackingPrompt').hidden=false;}}
  return visible;
}
function mappedHands() {
  return ['left','right'].map(id=>mapHand(latestHands[id])).filter(Boolean);
}
function calibrateReach(){
  const points=mappedHands(), w=game.width||1,b=currentGeometry?.visible??{left:0,width:w};
  const xs=points.map(p=>(p.x-b.left)/Math.max(1,b.width));
  const center=xs.length===2?(xs[0]+xs[1])/2:xs.length===1?Math.min(.64,Math.max(.36,xs[0])):.5;
  const half=Math.min(.34,Math.max(.22,xs.length===2?Math.abs(xs[0]-xs[1])/2+.12:.22));
  game.setReachZone?.({minX:(b.left+b.width*Math.max(.07,center-half))/w,maxX:(b.left+b.width*Math.min(.93,center+half))/w});
  recalibrateOnSample=false;
}
function drawCalibrationMarkers(now){
  const ctx=canvas.getContext('2d');
  if(diagnosticMode&&currentGeometry){
    const b=currentGeometry.visible,left=b.left+b.width*.15,right=b.left+b.width*.85;
    const top=b.top+b.height*.25,bottom=b.top+b.height*.72;
    ctx.save();ctx.strokeStyle='rgba(235,255,241,.72)';ctx.fillStyle='rgba(10,40,32,.32)';ctx.lineWidth=1.5;
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      const x=left+(right-left)*col/2,y=top+(bottom-top)*row/2;
      ctx.beginPath();ctx.arc(x,y,Math.min(13,b.height*.032),0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-5);ctx.lineTo(x,y+5);ctx.stroke();
    }
    ctx.restore();
  }
  if(now-lastTrackingAt>900)return;
  for(const id of ['left','right']){
    const point=mapHand(latestHands[id]);
    ctx.save();
    if(point){ctx.beginPath();ctx.arc(point.x,point.y,10,0,Math.PI*2);ctx.fillStyle='rgba(102,244,221,.22)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#edfff3';ctx.stroke();ctx.beginPath();ctx.arc(point.x,point.y,4.5,0,Math.PI*2);ctx.fillStyle='#fffce1';ctx.fill();}
    ctx.restore();
  }
}
function setDiagnostic(enabled){
  if(diagnosticMode!==Boolean(enabled))startGesture.invalidate(performance.now());
  diagnosticMode=Boolean(enabled);app.dataset.diagnostic=String(diagnosticMode);
  $('diagnosticToggle').setAttribute('aria-pressed',String(diagnosticMode));$('diagnosticToggle').textContent=diagnosticMode?'返回校准':'定位检查';
  $('diagnosticLegend').hidden=!diagnosticMode;
}
function stopCamera() {
  session++; tracker?.stop(); tracker = null; clearTracking();
  lastCaptureSettings=null;
  video.srcObject?.getTracks?.().forEach(track=>track.stop()); video.srcObject=null;
  currentGeometry=null;geometryKey='';geometryChangedAt=-Infinity;geometryDirty=true;recalibrateOnSample=false;
  delete app.dataset.cameraFit;setDiagnostic(false);game.resetInputHistory();
}
function home() {
  stopAudio();stopCamera(); game.stop();game.setCameraBounds(null); pointers.clear(); needsCamera=false;
  setMode('none'); setScreen('intro');
}
function showError(reason, currentSession) {
  if (currentSession !== session) return;
  if(qa)console.error('Fruit Motion diagnostic:',reason?.cause||reason);
  const message = typeof reason === 'string' ? reason : reason?.message;
  stopAudio();stopCamera(); game.stop(); setMode('none');
  $('errorText').textContent = message || '请检查是否允许 Safari 使用摄像头，再试一次。';
  setScreen('error');
}
function handleHands(hands,timestamp=performance.now(),startPose=null) {
  if(mode!=='camera')return;
  syncCameraGeometry(true);
  // Guard only a change in composition. Keep V1.3's accepted timing and
  // recognition cadence (not a new global inference-age filter).
  if(!currentGeometry||!belongsToCameraLayout(timestamp,geometryChangedAt)){
    if(screen==='calibrate'){
      startGesture.invalidate(performance.now());
      renderReadinessFeedback(startGesture.status(),null,null);
    }
    tracker?.resetHandFilter?.();return;
  }
  latestHands=hands||noHands();latestSampleTime=timestamp;lastTrackingAt=performance.now();
  if(recalibrateOnSample&&mappedHands().length)calibrateReach();
  if(screen==='calibrate'){
    const confirmation=startGesture.update({pose:startPose,hands:latestHands,geometry:currentGeometry,
      timestamp,now:lastTrackingAt,active:readinessActive()});
    renderReadinessFeedback(confirmation,mapHand(latestHands.left),mapHand(latestHands.right));
    if(confirmation.triggered)beginReadyRound({gesture:true});
  }
  if(screen==='playing'&&playableCameraArea()){
    for(const id of ['left','right'])game.setHand(id,mapHand(latestHands[id]),timestamp,{receivedAt:lastTrackingAt});
  }
}
async function startCamera({resume=false}={}) {
  startAudio();if(!resume)stopAudio();stopCamera(); setMode('camera');
  if (!resume) game.stop();
  const current = session;
  $('loadingTitle').textContent='准备摄像头'; $('loadingText').textContent='请允许前置摄像头。首次载入动作模型需要几秒。';
  setScreen('loading');
  tracker = new MotionTracker({video,cameraRequest:requestFrontCamera,
    onCaptureSettings:qa?s=>{if(current===session)lastCaptureSettings=s}:undefined,
    wantsStartPose:()=>current===session&&readinessActive(),
    onHands:(h,t,p)=>{if(current===session)handleHands(h,t,p)},onStatus:(s)=>{
    if(current!==session)return;
    if(screen==='calibrate'&&lastPerf?.delegate&&s.delegate!==lastPerf.delegate)startGesture.invalidate(performance.now());
    lastPerf=s;
    if(screen==='loading' && s.message) $('loadingText').textContent=s.message;
  },onError:(e)=>showError(e,current)});
  try {
    const ready=await tracker.start();
    if(current!==session || ready===false) return;
    needsCamera=false;syncCameraGeometry();
    if (resume) { startCountdown('resume'); }
    else { setScreen('calibrate'); updateCalibration(); }
  } catch(e) { showError(e,current); }
}
function beginPractice() {
  stopAudio();stopCamera(); game.stop();game.setCameraBounds(null); game.setReachZone?.(null); startAudio(); setMode('practice'); needsCamera=false; startCountdown('new');
}
function beginReadyRound({gesture=false}={}){
  if(!readinessActive())return false;
  if(gesture?mappedHands().length!==2:$('readyStart').disabled)return false;
  // First camera-start tap has already unlocked audio/permission. The manual
  // backup can retry audio unlock during its own trusted user activation.
  if(!gesture)startAudio();
  calibrateReach();startCountdown('new',{gesture});return true;
}
function startCountdown(kind='new',{gesture=false}={}) {
  game.clearHands(); pointers.clear(); countdownMode=kind;
  if(kind==='new'){ $('score').textContent='0'; $('time').textContent=formatRoundTime(ROUND_SECONDS); $('timerBar').style.transform='scaleX(1)'; }
  $('countdownPrompt').textContent=gesture?'双手确认成功！小手准备！':'小手准备！';
  countdownEnd=performance.now()+3000; lastCountdown=null; setScreen('countdown');
}
function pauseRound(hidden=false) {
  if (screen!=='playing' && screen!=='countdown') return;
  const wasCounting=screen==='countdown';
  game.pause(); audio.pauseMusic();game.clearHands(); pointers.clear(); tracker?.pause?.();
  needsCamera = mode==='camera' && hidden;
  if (needsCamera) stopCamera();
  if(mode==='camera'){$('trackingText').textContent=needsCamera?'摄像头已关闭':'识别已暂停 · 摄像头仍开启';trackingDot.classList.remove('active');}
  if (wasCounting && countdownMode==='new') countdownMode='new'; else countdownMode='resume';
  $('pauseText').textContent=needsCamera?'屏幕离开时摄像头已关闭，继续前需要重新开启。':'水果在等你回来！';
  setScreen('paused');
}
function resumeRound() {
  startAudio();
  if (needsCamera) { startCamera({resume:countdownMode==='resume'}); return; }
  tracker?.resume?.(); startCountdown(countdownMode);
}
function finishRound(score) {
  if (screen==='result') return;
  stopAudio();stopCamera(); const best=bestForCurrentMode(score);
  $('finalScore').textContent=String(score||0); $('bestScore').textContent=String(best);
  setScreen('result');
  audio.play('end');
}
function drawFrame(now) {
  const previous=lastFrame;
  const activeBefore=screen==='playing'&&game.running&&!game.paused&&!document.hidden;
  lastFrame=now;
  syncCameraGeometry();
  if(screen==='calibrate') updateCalibration(now);
  if(screen==='countdown') {
    const n=Math.max(1,Math.ceil((countdownEnd-now)/1000));
    if(n!==lastCountdown){lastCountdown=n;$('countdownNum').textContent=String(n);audio.play('countdown');}
    if(now>=countdownEnd) {
      if(countdownMode==='new') game.start({duration:ROUND_SECONDS,difficulty:prefs.mode}); else game.resume();
      setScreen('playing'); audio.play('start');beginMusic();
    }
  }
  if(screen==='playing') {
    updateTracking(now);
    const activeAfter=screen==='playing'&&game.running&&!game.paused&&!document.hidden;
    game.update(effectiveFrameSeconds(previous,now,activeBefore,activeAfter));
  }
  game.draw();
  if(screen==='playing'&&mode==='camera')game.recordFrame(now);
  if(screen==='calibrate')drawCalibrationMarkers(now);
  if(screen==='settings')syncMusicStatus();
  requestAnimationFrame(drawFrame);
}
function updateSize(){const w=game.width,h=game.height,dpr=game.dpr;game.resize();if(w!==game.width||h!==game.height||dpr!==game.dpr)pointers.clear();geometryDirty=true;syncCameraGeometry(true);}

let lastFullscreenActive=false, fullscreenReturnFocus=null;
function syncFullscreenUI(state){
  app.dataset.presentation=state.mode;
  const label=state.active?'退出全屏':state.supported?'全屏':state.standalone?'独立窗口说明':'全屏说明';
  for(const button of document.querySelectorAll('[data-fullscreen]')){
    button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(state.active));
    const text=button.querySelector('[data-fullscreen-label]');if(text)text.textContent=label;
  }
  if(state.active!==lastFullscreenActive){
    lastFullscreenActive=state.active;
    if(mode==='camera')resetComposition();else{game.resetInputHistory();pointers.clear();}
    updateSize();
  }
}
const fullscreen=createFullscreenController(app,{onChange:syncFullscreenUI});
function showFullscreenNotice(state,button){
  if(screen==='playing'||screen==='countdown')pauseRound(false);
  if(screen==='calibrate')startGesture.invalidate(performance.now());
  fullscreenReturnFocus=button;
  $('fullscreenMessage').textContent=state.standalone?'正在独立网页窗口中运行。设备或电视的系统边框仍可能存在。':state.reason==='unsupported'?'当前浏览器不能开启整个游戏的系统全屏。游戏会继续铺满可用网页区域。':'浏览器未能确认系统全屏。游戏会继续铺满可用网页区域。';
  $('fullscreenNotice').hidden=false;$('fullscreenDismiss').focus();
}
function closeFullscreenNotice(){
  if(screen==='calibrate')startGesture.invalidate(performance.now());
  $('fullscreenNotice').hidden=true;
  if(fullscreenReturnFocus?.getClientRects().length)fullscreenReturnFocus.focus();
  else if(screen==='paused')$('resumeButton').focus();
  fullscreenReturnFocus=null;
}
for(const button of document.querySelectorAll('[data-fullscreen]'))button.addEventListener('click',()=>{
  // Invoke directly while this trusted tap still has user activation.
  void fullscreen.toggle().then(result=>{if(!result.ok&&result.reason!=='busy')showFullscreenNotice(result,button);});
});
$('fullscreenDismiss').addEventListener('click',closeFullscreenNotice);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('fullscreenNotice').hidden){e.preventDefault();closeFullscreenNotice();}});

$('cameraStart').addEventListener('click',()=>startCamera()); $('practiceStart').addEventListener('click',beginPractice);
$('helpButton').addEventListener('click',()=>setScreen('help')); $('readyStart').addEventListener('click',()=>beginReadyRound());
$('diagnosticToggle').addEventListener('click',()=>{if(screen==='calibrate')setDiagnostic(!diagnosticMode);});
$('pauseButton').addEventListener('click',()=>pauseRound(false)); $('resumeButton').addEventListener('click',resumeRound);
$('replayButton').addEventListener('click',()=>mode==='camera'?startCamera():beginPractice()); $('retryButton').addEventListener('click',()=>startCamera());
$('errorPractice').addEventListener('click',beginPractice); document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',home));
$('soundButton').addEventListener('click',()=>{setMute(!muted);if(muted)audio.pauseMusic();else{startAudio();if(screen==='playing'&&!autoPaused)beginMusic();}});
$('activeMode').addEventListener('click',()=>chooseMode('active'));$('calmMode').addEventListener('click',()=>chooseMode('easy'));
$('settingsButton').addEventListener('click',openSettings);$('pauseSettings').addEventListener('click',openSettings);$('settingsBack').addEventListener('click',closeSettings);
for(const id of ['musicStyle','effectsStyle','reduceMotion'])$(id).addEventListener('change',changeSettings);
for(const id of ['musicVolume','effectsVolume'])$(id).addEventListener('input',changeSettings);
$('previewMusic').addEventListener('click',()=>{if(previewing){audio.stopMusic();previewing=false;}else{setMute(false);startAudio();previewing=true;audio.startMusic();}syncSettings();});
$('previewEffects').addEventListener('click',()=>{
  setMute(false);
  const request=++effectsPreviewRequest,style=prefs.effects,node=$('effectsStatus');
  node.textContent='正在准备真实音效…';node.hidden=false;
  void audio.unlock().then(ok=>ok?audio.readyEffects():false).then(ready=>{
    if(screen!=='settings'||request!==effectsPreviewRequest||prefs.effects!==style||!prefs.effectsVolume)return;
    node.textContent=ready?(audio.play('slice')?'♫ 正在试听实录材质游戏音效':'音效已就绪，轻触再次试听。'):'音效暂不可用，点击重试。';
  });
});
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',applyMotionPrefs);
function pointerPoint(e){const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
canvas.addEventListener('pointerdown',e=>{if(screen!=='playing'||mode!=='practice')return;e.preventDefault();pointers.add(e.pointerId);try{canvas.setPointerCapture(e.pointerId)}catch{}game.setHand(`pointer-${e.pointerId}`,pointerPoint(e),performance.now(),{force:true});});
canvas.addEventListener('pointermove',e=>{if(screen==='playing'&&mode==='practice'&&pointers.has(e.pointerId)){e.preventDefault();game.setHand(`pointer-${e.pointerId}`,pointerPoint(e),performance.now(),{force:true});}});
for(const evt of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(evt,e=>{pointers.delete(e.pointerId);game.setHand(`pointer-${e.pointerId}`,null,performance.now(),{force:true});});
window.addEventListener('resize',updateSize);window.addEventListener('orientationchange',updateSize);window.visualViewport?.addEventListener('resize',updateSize);
video.addEventListener('loadedmetadata',updateSize);video.addEventListener('resize',updateSize);
if(typeof ResizeObserver==='function'){const observer=new ResizeObserver(updateSize);observer.observe(app);observer.observe(canvas);observer.observe(video);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pauseMusic();previewing=false;effectsPreviewRequest++;if(screen==='settings'){syncSettings();$('effectsStatus').hidden=true;}if(['playing','countdown'].includes(screen))pauseRound(true);else if(['calibrate','loading'].includes(screen)){home();}else if((screen==='paused'||screen==='settings')&&mode==='camera'&&tracker){needsCamera=true;stopCamera();$('pauseText').textContent='屏幕离开时摄像头已关闭，继续前需要重新开启。';$('trackingText').textContent='摄像头已关闭';}}});
window.addEventListener('pagehide',()=>{stopAudio();stopCamera();game.stop();});
if(qa) window.__fruitQA={game,audio,state:()=>({screen,mode,playMode:prefs.mode,prefs:{...prefs},muted,session,tracking:latestHands,needsCamera,geometry:currentGeometry,sampleTime:latestSampleTime,geometryEpoch:geometryChangedAt,diagnosticMode,presentation:fullscreen.state(),captureSettings:lastCaptureSettings,startGesture:startGesture.status(performance.now())}), getTracker:()=>tracker, handleHands:(h,t)=>handleHands(h,t,null), finishRound};
const musicOptions=$('musicStyle');
musicOptions.replaceChildren(...Object.values(MUSIC_TRACKS).map(track=>new Option(track.label,track.id)),new Option('关闭音乐','off'));
$('effectsStyle').replaceChildren(...Object.entries(SFX_BANK_LABELS).map(([id,label])=>new Option(label,id)));
updateModeButtons();applyAudioPrefs();applyMotionPrefs();syncSettings();updateSize();syncFullscreenUI(fullscreen.state());setScreen('intro');requestAnimationFrame(drawFrame);
