import {RailGame,ACTIONS,STAGES,DURATION,MAX_GAP} from './rules.mjs';
import {createRailScene} from '../scene/index.mjs';
import {createCameraController} from '../input/index.mjs';
import {createAudio} from '../audio/index.mjs';

const $=id=>document.getElementById(id),els=Object.fromEntries(['scene','startCamera','startTouch','homePanel','cameraPanel','camera','cameraDot','cameraStatus','videoWrap','previewBtn','modeBadge','soundBtn','hud','score','stageName','stageNumber','progress','promptPanel','tutorialBadge','promptIcon','promptTitle','promptHint','demoLabel','feedback','overlay','overlayTitle','overlayText','overlayIcon','resumeBtn','retryBtn','switchTouchBtn','finishPanel','finalScore','replayBtn','finishExitBtn','controls','touchControls','cameraHelp','recenterBtn','pauseBtn','exitBtn'].map(id=>[id,$(id)]));
const shell=document.querySelector('.shell'),actions=[...document.querySelectorAll('[data-action]')],game=new RailGame(),audio=createAudio();
const text=(el,value)=>{value=String(value);if(el.textContent!==value)el.textContent=value;};
const hidden=(el,value)=>{if(el.hidden!==Boolean(value))el.hidden=Boolean(value);};
const setAttr=(el,k,v)=>{v=String(v);if(el.getAttribute(k)!==v)el.setAttribute(k,v);};
let cameraFlow=false,lastInferenceAt=-Infinity,lastSession=0,lastActionAt=-Infinity,cameraStatus={status:'idle',message:'未启动相机',ready:false},cameraError='',previewHidden=false,muted=false;
let scene=null,fatal='',lastTick=performance.now(),lastRender=-Infinity,sceneFrame=null,sceneKey='',ended=false,audioEpoch=0;
const note=(s)=>{if(typeof s?.catch==='function')s.catch(()=>{});};
const sound=name=>{audio.play(name);};
function unlockSound(cue){const token=++audioEpoch;note(audio.unlock().then(()=>{if(token!==audioEpoch)return;if(ended||document.hidden||game.hold||game.phase==='home'){note(audio.pause());return;}if(cue)sound(cue);}));}
function stopSound(){audioEpoch++;note(audio.pause());}
try{scene=createRailScene(els.scene);}catch(e){fatal='无法启动本站的三维森林场景。请重新打开验证页面。';console.error('Forest scene initialization failed',e);}
const camera=createCameraController({video:els.camera,onState:handleState,onAction:handleAction,onError:handleError});

function handleState(s){
  if(!cameraFlow||game.mode!=='camera'||!['tutorial','running'].includes(game.phase))return;
  cameraStatus=s;
  if(Number.isFinite(s.timestampMs))lastInferenceAt=s.timestampMs;
  const safe=s.ready===true&&s.partial!==true&&Number.isFinite(s.timestampMs)&&performance.now()-s.timestampMs<=MAX_GAP;
  const wasReady=game.ready;game.setReady(safe);
  if(!safe||wasReady!==safe)lastTick=performance.now();
  if(['error','paused','stopped'].includes(s.status)){cameraError=s.message||'相机已停止。';cameraFlow=false;}
  else if(s.status==='background'){pause('background');return;}
  else cameraError='';
  update();
}
function handleError(e){if(game.mode!=='camera'||!['tutorial','running'].includes(game.phase))return;cameraFlow=false;game.setReady(false);cameraError=e?.message||'无法打开相机。';update();}
function handleAction(e){
  if(game.mode!=='camera'||!cameraFlow||!game.canAdvance()||!e||!Number.isFinite(e.session)||!Number.isFinite(e.timestampMs))return;
  const now=performance.now();if(now-lastInferenceAt>MAX_GAP||now-e.timestampMs>MAX_GAP||now-lastRender>MAX_GAP){pause('slow');return;}
  if(e.session<lastSession||(e.session===lastSession&&e.timestampMs<=lastActionAt))return;
  if(e.session!==cameraStatus.session||e.timestampMs!==lastInferenceAt)return;
  lastSession=e.session;lastActionAt=e.timestampMs;
  if(game.action(e.action)){consume();update();}
}
function releaseCamera(){cameraFlow=false;lastInferenceAt=-Infinity;if(game.mode==='camera')game.setReady(false);note(camera.stop());}
function openCamera(){
  if(document.hidden||game.mode!=='camera'||game.hold)return;
  cameraFlow=true;cameraError='';lastInferenceAt=-Infinity;game.setReady(false);cameraStatus={status:'requesting',message:'请允许相机访问（不使用麦克风）',ready:false};
  // The call remains inside the user's explicit gesture, before any await.
  note(camera.start());update();
}
function start(mode){
  if(fatal||document.hidden)return;
  releaseCamera();previewHidden=false;cameraError='';cameraStatus={status:'idle',message:'未启动相机',ready:false};lastTick=performance.now();game.start(mode);
  if(mode==='camera')openCamera();
  unlockSound('start');
  consume();update();
}
function pause(reason='manual'){
  if(!game.pause(reason))return;
  releaseCamera();stopSound();lastTick=performance.now();update();
}
function resume(){
  if(fatal||document.hidden||!game.resume())return;
  lastTick=performance.now();unlockSound();
  if(game.mode==='camera')openCamera();
  update();
}
function exit(){releaseCamera();stopSound();game.exit();previewHidden=false;cameraError='';lastTick=performance.now();update();}
function recenter(){
  if(game.mode!=='camera'||game.hold||!cameraFlow||document.hidden)return;
  game.setReady(false);lastInferenceAt=-Infinity;lastTick=performance.now();note(camera.recenter());update();
}
function touchAction(action){if(game.mode!=='touch'||document.hidden||fatal)return;if(game.action(action)){consume();update();}}
function consume(){
  for(const event of game.drain()){
    if(event.type==='finish'){releaseCamera();sound('finish');}
    else if(event.type==='success'||event.type==='miss'||event.type==='step')sound(event.type);
    else if(event.type==='depart')sound('start');
  }
}
function overlayContents(){
  if(fatal)return{icon:'!',title:'暂时无法运行',body:fatal};
  if(game.hold){const info={manual:['⏸','休息一下','游戏已暂停，不扣分。准备好再继续。'],background:['⏸','已安全暂停','切换后台时相机已关闭。返回后可重新连接并校准。'],slow:['⏸','等等，画面有点慢','画面或识别停顿，游戏已安全暂停，不扣分。可以休息后再继续。']}[game.hold]||['⏸','已暂停','准备好再继续。'];return{icon:info[0],title:info[1],body:info[2],resume:true};}
  if(game.mode==='camera'&&!game.ready){
    if(cameraError)return{icon:'◉',title:'相机暂不可用',body:cameraError,retry:true};
    const status=cameraStatus.status;
    if(status==='requesting'||status==='loading')return{icon:'◉',title:status==='requesting'?'等待相机权限':'本机识别模型加载中',body:cameraStatus.message};
    return{icon:'◉',title:status==='stand-neutral-anchor'?'请回到准备位置':status==='ready-partial'?'让全身入框':status==='lost'||status==='stale-frame'?'安全暂停':'请站好，准备出发',body:cameraStatus.message||'让全身进入镜像小窗，自然站直。'};
  }
  return null;
}
function update(){
  if(ended)return;
  const active=game.phase==='running'||game.phase==='tutorial',home=game.phase==='home',finish=game.phase==='finished',cameraMode=active&&game.mode==='camera',touchMode=active&&game.mode==='touch';
  shell.classList.toggle('play-camera',cameraMode);shell.classList.toggle('play-touch',touchMode);
  hidden(els.homePanel,!home);hidden(els.finishPanel,!finish);hidden(els.hud,!active);hidden(els.promptPanel,!active);hidden(els.controls,!active);hidden(els.cameraPanel,!cameraMode);hidden(els.touchControls,!touchMode);hidden(els.recenterBtn,!cameraMode);
  text(els.modeBadge,cameraMode?'体感验证 · 未验真机':touchMode?'触摸练习 · 非体感':'公开试玩版 · A-R1');
  text(els.cameraStatus,cameraStatus.message||'等待相机');els.cameraDot.classList.toggle('ready',game.ready&&!game.hold);hidden(els.videoWrap,previewHidden);text(els.previewBtn,previewHidden?'显示':'隐藏');setAttr(els.previewBtn,'aria-pressed',previewHidden);
  text(els.score,game.points);text(els.stageName,STAGES[game.stage-1]);text(els.stageNumber,`${game.stage}/3`);
  if(els.progress.value!==game.elapsedMs)els.progress.value=game.elapsedMs;
  setAttr(els.progress.parentElement,'aria-valuenow',Math.floor(game.elapsedMs/1000));
  text(els.tutorialBadge,game.phase==='tutorial'?`动作教学 · ${Math.min(6,game.tutorialIndex+1)}/6`:game.active?'障碍提示':'探险进行中');
  const prompt=game.prompt; text(els.promptIcon,prompt?.icon||'✦');text(els.promptTitle,prompt?.label||'森林探险');text(els.promptHint,prompt?.hint||'');
  hidden(els.demoLabel,!(game.phase==='tutorial'&&game.sceneState().tutorialDemo));
  hidden(els.feedback,!active||!game.feedback||Boolean(game.hold)||!game.ready);text(els.feedback,game.feedback);
  const overlay=active||fatal?overlayContents():null;
  hidden(els.overlay,!overlay);if(overlay){text(els.overlayIcon,overlay.icon);text(els.overlayTitle,overlay.title);text(els.overlayText,overlay.body);hidden(els.resumeBtn,!overlay.resume);hidden(els.retryBtn,!overlay.retry);hidden(els.switchTouchBtn,!overlay.retry);}
  els.pauseBtn.disabled=Boolean(game.hold);els.recenterBtn.disabled=!cameraFlow||!!game.hold;
  text(els.cameraHelp,cameraMode?'请保持舒适距离，全身入框；动作不需要跳跃。':'触摸按钮或方向键。此模式无需相机，也不会测试识别。');
  for(const button of actions){const expected=game.phase==='tutorial'?game.tutorialAction?.id:game.active?.action;button.classList.toggle('expected',button.dataset.action===expected&&game.canAdvance()&&!game.tutorialRemaining);button.disabled=!touchMode||!game.canAdvance()||(game.phase==='tutorial'&&(game.tutorialRemaining>0||button.dataset.action!==expected));}
  text(els.finalScore,`收获 ${game.points} 颗星星`);els.startCamera.disabled=!!fatal;els.startTouch.disabled=!!fatal;
  requestScene();
}
function requestScene(){
  if(!scene||fatal||document.hidden||ended||sceneFrame!==null)return;
  const state=game.sceneState(),key=JSON.stringify(state);
  if(key===sceneKey)return;
  sceneFrame=requestAnimationFrame(()=>{sceneFrame=null;if(document.hidden||ended)return;try{const current=game.sceneState();scene.render(current);lastRender=performance.now();sceneKey=JSON.stringify(current);}catch(e){fatal='三维画面运行失败，已经停止探险。请重新打开验证页面。';console.error('Forest render failed',e);releaseCamera();game.pause('slow');stopSound();update();}});
}
// During static camera tutorial, the scene does not need repeated paint, but a
// visible animation-frame heartbeat is necessary for fresh-frame safety. It
// never counts time itself and exposes no fabricated FPS metric.
let heartbeatFrame=null;
function heartbeat(){heartbeatFrame=requestAnimationFrame(()=>{heartbeatFrame=null;if(ended||document.hidden)return;if(game.mode==='camera'&&['running','tutorial'].includes(game.phase)){if(sceneKey&&sceneFrame===null)lastRender=performance.now();heartbeat();}});}
function step(){
  if(ended||document.hidden){lastTick=performance.now();return;}
  const now=performance.now(),delta=now-lastTick;lastTick=now;
  if(game.mode==='camera'&&['running','tutorial'].includes(game.phase)&&!game.hold){
    if(heartbeatFrame===null)heartbeat();
    if(game.ready&&(now-lastInferenceAt>MAX_GAP||now-lastRender>MAX_GAP)){pause('slow');return;}
  }
  const prevHold=game.hold;game.tick(delta);
  if(!prevHold&&game.hold){releaseCamera();stopSound();}
  consume();update();
}
const timer=setInterval(step,50);

els.startCamera.addEventListener('click',()=>start('camera'));
els.startTouch.addEventListener('click',()=>start('touch'));
els.resumeBtn.addEventListener('click',resume);
els.retryBtn.addEventListener('click',()=>{if(game.mode==='camera'){openCamera();unlockSound();}});
els.switchTouchBtn.addEventListener('click',()=>{if(game.mode==='camera'&&cameraError&&!game.hold)start('touch');});
els.pauseBtn.addEventListener('click',()=>pause());els.exitBtn.addEventListener('click',exit);els.finishExitBtn.addEventListener('click',exit);
els.replayBtn.addEventListener('click',()=>start(game.mode||'touch'));
els.recenterBtn.addEventListener('click',recenter);
els.previewBtn.addEventListener('click',()=>{previewHidden=!previewHidden;update();});
els.soundBtn.addEventListener('click',()=>{muted=!muted;audio.setMuted(muted);if(!muted&&['tutorial','running'].includes(game.phase)&&!game.hold)unlockSound();setAttr(els.soundBtn,'aria-pressed',muted);setAttr(els.soundBtn,'aria-label',muted?'开启声音':'静音');text(els.soundBtn,muted?'♪ 静音':'♪ 声音');});
for(const button of actions)button.addEventListener('click',()=>touchAction(button.dataset.action));
const keyMap={ArrowLeft:'left_step',ArrowRight:'right_step',ArrowDown:'squat',ArrowUp:'arms_up',q:'reach_left',e:'reach_right'};
window.addEventListener('keydown',e=>{if(game.mode!=='touch'||document.hidden||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;const action=keyMap[e.key]||keyMap[e.key?.toLowerCase()];if(action&&game.canAdvance()){e.preventDefault();touchAction(action);}});
function haltForBackground(){if(['running','tutorial'].includes(game.phase))pause('background');else{releaseCamera();stopSound();}if(sceneFrame!==null){cancelAnimationFrame(sceneFrame);sceneFrame=null;}if(heartbeatFrame!==null){cancelAnimationFrame(heartbeatFrame);heartbeatFrame=null;}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)haltForBackground();else{lastTick=performance.now();sceneKey='';update();}});
window.addEventListener('pagehide',e=>{haltForBackground();if(!e.persisted){ended=true;clearInterval(timer);note(camera.dispose());note(audio.dispose());scene?.dispose();}});
window.addEventListener('pageshow',()=>{lastTick=performance.now();update();});
window.addEventListener('resize',()=>{sceneKey='';update();});
update();
