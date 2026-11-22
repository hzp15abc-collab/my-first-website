// W8-D8 isolated G1b startup repair. Not the production game or a test verdict.
// Actual adult camera frames or explicitly labelled procedural canvas self-test.
const el = id => document.getElementById(id);
const ui = Object.fromEntries([
  'candidate','mode','protocol','consent','start','stop','privacy','status','stage','no-render',
  'camera','viewfinder','preview','source','gesture','clock','prompt','phase','frame-metric',
  'frame-count','infer-metric','infer-count','track-metric','event-metric','latency-metric',
  'load-metric','error-metric','report','copy','copy-raw','copy-status',
  'stage-overlay','overlay-title','overlay-detail'
].map(id=>[id,el(id)]));
const missingKeys=Object.keys(ui).filter(key=>!ui[key]);
if(missingKeys.length){
  const status=el('status');
  if(status)status.textContent='UI_MAP / 启动失败：实验控件缺失。';
  const button=el('start');if(button)button.disabled=true;
  const title=el('overlay-title');if(title)title.textContent='UI_MAP / 页面结构错误';
  throw new Error('UI_MAP');
}
const root = new URL('./',import.meta.url);
const asset = name => new URL(name,root).href;
const choices = Object.freeze({T1:()=>import('./t1.bundle.js'),T2:()=>import('./t2.bundle.js')});
const WARMUP = 3000;
const LABELS = Object.freeze({
  neutral:'自然站立',left_raise:'轻轻抬左手',right_raise:'轻轻抬右手',
  cross:'双手轻轻交叉于胸前',horizontal_vertical:'左臂横放、右手轻抬'
});
const PROTOCOLS = Object.freeze({
  quick:{duration:30000, title:'快速试验'},
  positive:{duration:320000, title:'正例引导'},
  negative:{duration:600000, title:'负例观测'},
  endurance:{duration:360000, title:'连续三局'},
  anomaly:{duration:120000, title:'异常观察'}
});
const TRIAL_MS=4000, TRIAL_REST_MS=1000, SEED=20261122;
const TARGETS=['left_raise','right_raise','cross','horizontal_vertical'];
const ALLOWED_RESOURCES=new Set(['index.html','style.css','app.mjs','tf.min.js','pose-detection.min.js',
  't1.bundle.js','t2.bundle.js','frozen-config.json','scene.glb','model.json',
  'group1-shard1of2.bin','group1-shard2of2.bin','NOTICE.txt']);
const privacyViolations=[];
let current=null, lastCompleted=null;
const loadedScripts=new Map();
function localScript(name){
  if(!['tf.min.js','pose-detection.min.js'].includes(name))return Promise.reject(new Error('LOCAL_SCRIPT_NAME'));
  if(loadedScripts.has(name))return loadedScripts.get(name);
  const src=new URL(name,root);
  if(src.origin!==location.origin)return Promise.reject(new Error('LOCAL_SCRIPT_ORIGIN'));
  const pending=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src.href;script.async=false;
    script.addEventListener('load',()=>resolve(),{once:true});
    script.addEventListener('error',()=>{script.remove();reject(new Error('LOCAL_SCRIPT_LOAD'));},{once:true});
    document.head.append(script);
  }).catch(error=>{loadedScripts.delete(name);throw error});
  loadedScripts.set(name,pending);return pending;
}
const needsCamera=mode=>mode==='infer'||mode==='combined';
function overlay(title,detail='',error=false){
  ui['overlay-title'].textContent=title;
  ui['overlay-detail'].textContent=detail;
  ui['stage-overlay'].classList.toggle('is-error',error);
  ui['stage-overlay'].hidden=false;
}
const STAGE_LABELS=Object.freeze({
  setup:'初始化控件',permission:'请求相机权限',video:'相机播放',config:'读取冻结配置',engineImport:'加载 3D 引擎',
  engineCreate:'创建 3D 场景',tfScript:'加载本地 TFJS',poseScript:'加载本地姿态模型',
  backend:'启动 WebGL 后端',detector:'加载与创建 MoveNet',synthetic:'创建无相机自检图像',
  render:'提交绘制',inference:'执行真实模型推理',cleanup:'释放资源'
});
const SAFE_NAMES=new Set(['Error','TypeError','ReferenceError','SyntaxError','NotAllowedError','NotFoundError',
  'NotReadableError','OverconstrainedError','SecurityError','AbortError','InvalidStateError','NotSupportedError','OperationError']);
const SAFE_CODES=new Set(['CONSENT_REQUIRED','HTTPS_CAMERA_UNAVAILABLE','UNEXPECTED_AUDIO_TRACK','NO_VIDEO_TRACK',
  'CONFIG_LOAD','FROZEN_CONFIG_MISMATCH','CAMERA_FRAME_TIMEOUT','LOCAL_MODEL_RUNTIME_UNAVAILABLE','UNAPPROVED_BACKEND',
  'LOCAL_SCRIPT_NAME','LOCAL_SCRIPT_ORIGIN','LOCAL_SCRIPT_LOAD','SYNTHETIC_CANVAS_UNAVAILABLE','UI_MAP']);
const SAFE_MESSAGES=Object.freeze({
  CAMERA_DENIED:'相机权限未获批准。',CAMERA_NOT_FOUND:'未发现可用相机。',CAMERA_UNAVAILABLE:'相机不可读取。',
  CAMERA_CONSTRAINT:'相机条件无法满足。',CAMERA_SECURITY:'相机被浏览器安全设置阻止。',
  HTTPS_CAMERA_UNAVAILABLE:'相机需要安全上下文及受支持的浏览器。',CAMERA_FRAME_TIMEOUT:'相机未及时返回可用视频帧。',
  LOCAL_SCRIPT_LOAD:'无法读取本地运行库。',LOCAL_MODEL_RUNTIME_UNAVAILABLE:'本地模型 API 尚未可用。',
  FROZEN_CONFIG_MISMATCH:'冻结参数不一致。',UNAPPROVED_BACKEND:'WebGL 后端不可用或发生回退。',
  CONFIG_LOAD:'无法读取冻结配置。',UNEXPECTED_AUDIO_TRACK:'意外音轨已立即停止。',
  SYNTHETIC_CANVAS_UNAVAILABLE:'无法创建本地几何画布。'
});
function stageStatus(run,stage){
  run.stage=stage;
  const label=STAGE_LABELS[stage]||'准备实验';
  overlay(label+'…',run.synthetic?'SYNTHETIC · 无相机内部自检':'正在准备同条件实验');
  setStatus(label+'…');
}
function errorDetail(run,error,forcedCode){
  const name=SAFE_NAMES.has(error?.name)?error.name:'Error';
  const code=forcedCode||(SAFE_CODES.has(error?.message)?error.message:(
    run.stage==='permission'?({NotAllowedError:'CAMERA_DENIED',NotFoundError:'CAMERA_NOT_FOUND',NotReadableError:'CAMERA_UNAVAILABLE',OverconstrainedError:'CAMERA_CONSTRAINT',SecurityError:'CAMERA_SECURITY'}[name]||'CAMERA_PERMISSION_ERROR')
      :({video:'CAMERA_PLAY_ERROR',config:'CONFIG_ERROR',engineImport:'ENGINE_IMPORT_ERROR',engineCreate:'ENGINE_CREATE_ERROR',
        tfScript:'TFJS_SCRIPT_ERROR',poseScript:'POSE_SCRIPT_ERROR',backend:'WEBGL_BACKEND_ERROR',detector:'MODEL_CREATE_ERROR',
        synthetic:'SYNTHETIC_ERROR',inference:'MODEL_INFERENCE',render:'RENDER'}[run.stage]||'INITIALIZATION_ERROR')));
  // Never include exception stack, raw browser/driver message, identifiers, or URLs.
  // The short, bounded message is a local controlled description rather than raw exception text.
  const message=(SAFE_MESSAGES[code]||((STAGE_LABELS[run.stage]||'实验阶段')+'失败，请复制匿名摘要排查。')).slice(0,96);
  run.errorDetails.push({code,stage:run.stage,name,message});run.errors.push(code);
  return {code,stage:run.stage,name,message};
}
const round=(n,places=2)=>Math.round(n*10**places)/10**places;
function stat(a){
  if(!a.length)return {n:0,p50:null,p95:null,max:null};
  const s=[...a].sort((a,b)=>a-b);
  return {n:s.length,p50:round(s[Math.ceil(s.length*.5)-1]),p95:round(s[Math.ceil(s.length*.95)-1]),max:round(s[s.length-1])};
}
function pair(a){const s=stat(a);return s.n?`${s.p50} / ${s.p95} ms`:'—'}
function timeText(ms){
  const s=Math.floor(Math.max(0,ms)/1000);
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
class Interrupted extends Error {}
function guard(run){if(!run.active)throw new Interrupted()}
function randomTrials(){
  let n=SEED>>>0;
  const labels=TARGETS.flatMap(g=>Array(20).fill(g));
  for(let i=labels.length-1;i>0;i--){
    n=(Math.imul(n,1664525)+1013904223)>>>0;
    const j=Math.floor(n/4294967296*(i+1));
    [labels[i],labels[j]]=[labels[j],labels[i]];
  }
  return labels.map((expected,index)=>({index:index+1,expected,events:[]}));
}
function good(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.score>=.3}
function classify(pose){
  const k=Object.fromEntries((pose?.keypoints||[]).map(p=>[p.name,p]));
  const a=k.left_shoulder,b=k.right_shoulder,l=k.left_wrist,r=k.right_wrist;
  if(![a,b,l,r].every(good))return {valid:false,gesture:'neutral'};
  const span=Math.max(1,Math.abs(a.x-b.x));
  if(Math.abs(l.x-r.x)<.35*span && l.y<Math.max(a.y,b.y)+.65*span && r.y<Math.max(a.y,b.y)+.65*span)
    return {valid:true,gesture:'cross'};
  const left=l.y<a.y-.25*span,right=r.y<b.y-.25*span;
  if(right&&Math.abs(l.y-a.y)<.45*span)return {valid:true,gesture:'horizontal_vertical'};
  if(left&&!right)return {valid:true,gesture:'left_raise'};
  if(right&&!left)return {valid:true,gesture:'right_raise'};
  return {valid:true,gesture:'neutral'};
}
function networkCategory(value){
  try{
    const u=new URL(value,location.href);
    if(u.origin!==location.origin)return '非同源';
    const basename=u.pathname.slice(u.pathname.lastIndexOf('/')+1)||'index.html';
    return ALLOWED_RESOURCES.has(basename)?basename:'未列入静态清单的同源资源';
  }catch{return '无法识别的资源'}
}
document.addEventListener('securitypolicyviolation',e=>{
  privacyViolations.push({directive:e.effectiveDirective||'unknown',resource:networkCategory(e.blockedURI)});
});
function makeRun(){
  const candidate=ui.candidate.value,mode=ui.mode.value,protocol=ui.protocol.value;
  return {
    candidate,mode,protocol,needRender:mode!=='infer',needInfer:mode!=='render',needCamera:needsCamera(mode),synthetic:mode==='synthetic',active:true,loading:true,
    stream:null,detector:null,engine:null,inference:null,frameId:0,videoFrameId:null,decoded:null,lastVideoTime:-1,
    lastTrackedAt:null,invalidAt:null,paused:false,stable:null,stableCount:0,armed:false,gesture:'neutral',feedback:null,
    startedAt:performance.now(),begin:null,lastDrawTs:null,lastUi:0,phaseKey:'',hasCamera:false,permissionMs:null,loadMs:null,
    raw:{frameMs:[],inferenceMs:[],sampleToDrawMs:[],sampleToDrawClocks:[],events:[],trackingLoss:[]},
    counts:{frames:0,inferences:0,tracked:0,nonNeutral:0,transitions:0,events:0,freeze:0,loss:0,recovery:0},
    errors:[],errorDetails:[],stage:'setup',syntheticCanvas:null,syntheticStep:-1,elapsedMs:0,stopReason:null,protocolCompleted:false,trials:protocol==='positive'?randomTrials():[],
    phase:null,backend:null,cameraSettings:null,resourceStart:performance.getEntriesByType('resource').length
  }
}
function setStatus(t){ui.status.textContent=t}
function setupState(){
  const cameraRequired=needsCamera(ui.mode.value);
  ui.consent.disabled=!cameraRequired;
  ui.start.disabled=!!current||(cameraRequired&&!ui.consent.checked);
  ui.stop.disabled=!current?.active;
  const synthetic=ui.mode.value==='synthetic';
  for(const opt of ui.protocol.options)opt.disabled=synthetic&&opt.value!=='quick';
  if(synthetic)ui.protocol.value='quick';
  ui.preview.disabled=!cameraRequired;
  ui.privacy.textContent=cameraRequired
    ?'仅成年人点击开始后才申请相机视频。视频仅本地推理，不上传、不存储、不录音；后台、退出、切换或停止会停流。'
    :synthetic?'SYNTHETIC 内部自检：仅用程序生成的几何人形执行真实模型推理，不申请相机，不是人体准确率或 iPhone 验收。'
      :'仅 3D 渲染：不申请相机、不启动识别。此工况不能作为相机或动作识别证据。';
}
function validateChoice(){
  const mode=ui.mode.value,protocol=ui.protocol.value;
  if(mode==='synthetic'&&protocol!=='quick')return '内部无相机自检仅支持30秒快速试验。';
  const needsMotion=protocol==='positive'||protocol==='negative';
  if(needsMotion&&mode==='render')return '正例及负例须使用真实推理工况，不能用仅渲染替代。';
  if(protocol==='endurance'&&mode!=='combined')return '连续三局应使用 C 工况（3D + 真实姿态推理）。';
  return null;
}
function stopTrack(stream){for(const track of stream?.getTracks()||[])try{track.stop()}catch{}}
function stopCamera(run){
  // Stop every stream first, even if permission or model loading races with stop.
  stopTrack(run.stream);
  const bound=ui.camera.srcObject;
  if(bound&&bound!==run.stream)stopTrack(bound);
  ui.camera.pause();ui.camera.srcObject=null;
  ui.viewfinder.hidden=true;
}
function closeRenderer(run){
  if(run.engine){const e=run.engine;run.engine=null;try{e.dispose()}catch{run.errors.push('RENDER_DISPOSE')}}
}
function cancelCallbacks(run){
  if(run.frameId)cancelAnimationFrame(run.frameId);
  run.frameId=0;
  if(run.videoFrameId!==null&&typeof ui.camera.cancelVideoFrameCallback==='function'){
    try{ui.camera.cancelVideoFrameCallback(run.videoFrameId)}catch{}
  }
  run.videoFrameId=null;
}
function stopCurrent(reason){
  const run=current;
  if(!run?.active)return;
  run.active=false;
  run.stopReason=reason;
  run.elapsedMs=run.begin?Math.max(run.elapsedMs,performance.now()-run.begin-WARMUP):0;
  run.gesture='neutral';run.feedback=null;
  cancelCallbacks(run);stopCamera(run);closeRenderer(run);
  ui.source.textContent=run.needCamera?'已停止（相机已请求停流）':run.synthetic?'SYNTHETIC 自检已停止 · 无相机':'仅渲染已停止 · 无相机';
  ui.gesture.textContent='已暂停';ui.phase.textContent='已停止';
  ui.prompt.textContent='实验已停止。重新开始须由成人再次主动确认。';
  ui.stop.disabled=true;
  overlay('已停止',STOP_LABELS[reason]||'正在释放本地实验资源。');
  setStatus('已请求停止。正在释放本地实验资源；不会自动恢复。');
}
const STOP_LABELS=Object.freeze({'user-stop':'用户停止','selection-changed':'候选或工况切换','consent-withdrawn':'成人撤回同意',
  'background':'页面进入后台','page-exit':'页面退出','orientation-change':'设备实际旋转','camera-ended':'相机流结束',
  'protocol-complete':'实验计时结束','inference-error':'模型推理错误','render-error':'3D 绘制错误'});
function phaseAt(run,elapsed){
  if(run.synthetic)return {key:elapsed<0?'warm':'synthetic',label:elapsed<0?'内部自检 · 预热':'SYNTHETIC · 30 秒',text:'程序自动生成匿名几何人形；无需真人或相机。仅诊断模型及引擎启动。'};
  if(elapsed<0)return {key:'warm',label:'预热 · 3 秒',text:'自然站立，先让设备稳定。'};
  if(run.protocol==='positive'){
    const i=Math.min(79,Math.floor(elapsed/TRIAL_MS)),within=elapsed-i*TRIAL_MS;
    const trial=run.trials[i],rest=within<TRIAL_REST_MS;
    return {key:`${i}-${rest?'rest':'action'}`,label:`${i+1}/80 · ${rest?'回到自然站立':'做动作'}`,text:rest?'请恢复自然站立、放松双手。':LABELS[trial.expected]+'，以自己的左右手为准。轻柔保持，不用发力。',trial:i,expected:rest?null:trial.expected};
  }
  if(run.protocol==='negative')return {key:'negative',label:'负例 · 10 分钟',text:'静止、自然活动、短时遮挡等非目标动作。请勿做四类目标姿态。'};
  if(run.protocol==='endurance'){
    const lap=Math.min(3,Math.floor(elapsed/120000)+1);
    return {key:'lap'+lap,label:`第 ${lap}/3 局 · 每局 2 分钟`,text:'保持舒适，自然做动作，可随时停止，不需要速度或力度。'};
  }
  return {key:run.protocol,label:PROTOCOLS[run.protocol].title,text:run.needInfer?'抬手、交叉或做轻柔的光线姿态；观察反馈。有不适立即停止。':'仅渲染观察，不使用相机。观察画面是否顺畅。'};
}
function addEvent(run,gesture,at,sampleAt,timestampKind){
  const elapsed=at-run.begin-WARMUP;
  if(elapsed<0)return;
  const phase=phaseAt(run,elapsed);
  const event={gesture,tMs:round(elapsed),phase:phase.key};
  if(phase.expected)event.promptExpected=phase.expected;
  if(phase.trial!==undefined&&phase.expected)run.trials[phase.trial].events.push(event);
  run.raw.events.push(event);run.counts.events++;
  if(run.needRender)run.feedback={sampleAt,timestampKind,gesture};
}
function loseTracking(run,at){
  run.gesture='neutral';run.stable=null;run.stableCount=0;run.armed=false;run.feedback=null;
  if(run.paused)return;
  run.paused=true;run.invalidAt=at;
  if(at-run.begin>=WARMUP){run.counts.loss++;run.raw.trackingLoss.push({observedMs:round(at-run.begin-WARMUP),recoveredAfterMs:null});}
}
function handlePose(run,pose,sampleAt,timestampKind,doneAt,measuring,duration){
  const p=classify(pose);
  if(measuring){
    run.raw.inferenceMs.push(round(duration));run.counts.inferences++;
    if(p.valid)run.counts.tracked++;
    if(p.valid&&p.gesture!=='neutral')run.counts.nonNeutral++;
  }
  if(!p.valid){loseTracking(run,doneAt);return;}
  run.lastTrackedAt=doneAt;
  if(run.paused){
    run.paused=false;
    if(measuring){run.counts.recovery++;
      const loss=run.raw.trackingLoss.at(-1);
      if(loss&&loss.recoveredAfterMs===null)loss.recoveredAfterMs=round(doneAt-run.invalidAt);
    }
    run.armed=false;run.stable=null;run.stableCount=0;run.invalidAt=null;
  }
  if(p.gesture===run.stable)run.stableCount++;else{run.stable=p.gesture;run.stableCount=1;}
  if(run.stableCount<2)return;
  if(p.gesture!==run.gesture&&measuring)run.counts.transitions++;
  run.gesture=p.gesture;
  if(p.gesture==='neutral'){run.armed=true;return;}
  if(run.armed){
    run.armed=false;
    if(measuring)addEvent(run,p.gesture,doneAt,sampleAt,timestampKind);
  }
}
function monitorVideoFrames(run){
  if(!run.active||!run.needCamera||typeof ui.camera.requestVideoFrameCallback!=='function')return;
  run.videoFrameId=ui.camera.requestVideoFrameCallback((now,metadata)=>{
    run.videoFrameId=null;
    if(!run.active)return;
    run.decoded={time:metadata.mediaTime,observedAt:now};
    monitorVideoFrames(run);
  });
}
function syntheticFrame(run,step){
  // Deterministic original geometry only. The pixels are the model input,
  // not fake keypoints; no media device, image file or user-facing data.
  const c=run.syntheticCanvas,ctx=c.getContext('2d');
  if(!ctx)throw new Error('SYNTHETIC_CANVAS_UNAVAILABLE');
  const phase=Math.floor(step/24)%6;
  ctx.fillStyle='#d8e6ec';ctx.fillRect(0,0,480,270);
  ctx.fillStyle='#bbcad1';ctx.fillRect(0,230,480,40);
  ctx.fillStyle='#284c65';ctx.fillRect(217,73,46,77);
  ctx.strokeStyle='#294960';ctx.lineWidth=16;ctx.lineCap='round';ctx.lineJoin='round';
  const line=(...p)=>{ctx.beginPath();ctx.moveTo(...p[0]);for(const point of p.slice(1))ctx.lineTo(...point);ctx.stroke()};
  line([226,143],[218,187],[211,229]);line([254,143],[262,187],[270,229]);
  const arms=[
    [[199,119],[193,145],[281,119],[287,145]],
    [[199,55],[203,28],[281,119],[287,145]],
    [[199,119],[193,145],[281,55],[277,28]],
    [[208,115],[264,99],[272,115],[216,99]],
    [[189,83],[157,83],[281,58],[280,26]],
    [[199,119],[193,145],[281,119],[287,145]]
  ][phase];
  line([217,82],arms[0],arms[1]);line([263,82],arms[2],arms[3]);
  ctx.fillStyle='#cfb6a1';ctx.beginPath();ctx.arc(240,49,17,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#294960';ctx.beginPath();ctx.ellipse(211,233,13,5,0,0,Math.PI*2);ctx.ellipse(270,233,13,5,0,0,Math.PI*2);ctx.fill();
}
function maybeInfer(run,now){
  if(!run.needInfer||run.inference||(!run.synthetic&&ui.camera.readyState<2))return;
  let frame=null,currentTime,sampleAt,kind,input;
  if(run.synthetic){
    const step=Math.floor((now-run.begin)/1000*12);
    if(step===run.syntheticStep)return;
    try{syntheticFrame(run,step)}catch(e){
      run.stage='synthetic';errorDetail(run,e);stopCurrent('inference-error');return;
    }
    run.syntheticStep=step;currentTime=step/12;sampleAt=performance.now();kind='synthetic-canvas-generated';input=run.syntheticCanvas;
  }else{
    frame=typeof ui.camera.requestVideoFrameCallback==='function'?run.decoded:null;
    if(typeof ui.camera.requestVideoFrameCallback==='function'&&!frame)return;
    currentTime=frame?.time??ui.camera.currentTime;
    sampleAt=frame?.observedAt??performance.now();kind=frame?'decoded-frame-callback-observed':'inference-start-fallback';input=ui.camera;
  }
  if(!Number.isFinite(currentTime)||Math.abs(currentTime-run.lastVideoTime)<.0001)return;
  run.lastVideoTime=currentTime;
  const began=performance.now();
  const measuring=began-run.begin>=WARMUP;
  // One actual asynchronous inference on newly decoded video or a synthetic canvas.
  run.inference=Promise.resolve().then(()=>{
    if(!run.active)return null;
    return run.detector.estimatePoses(input);
  }).then(poses=>{
    if(!run.active||!poses)return;
    const done=performance.now();
    handlePose(run,poses[0],sampleAt,kind,done,measuring,done-began);
  }).catch(e=>{
    if(run.active){run.stage='inference';errorDetail(run,e);stopCurrent('inference-error')}
  }).finally(()=>{run.inference=null;});
}
function updateMetrics(run,now=performance.now()){
  const dt=run.active?(run.begin?now-run.begin-WARMUP:0):run.elapsedMs;
  // During measurement only sort a small rolling tail, not the growing full
  // sample arrays. Full exact percentiles are calculated after the run stops.
  const displaySamples=a=>run.active?a.slice(-480):a;
  const label=run.active?'（滚动）':'（全轮）';
  ui.clock.textContent=timeText(Math.min(PROTOCOLS[run.protocol].duration,dt));
  ui['frame-metric'].textContent=pair(displaySamples(run.raw.frameMs));
  ui['frame-count'].textContent=run.raw.frameMs.length+' 个累计实际绘制间隔'+label;
  ui['infer-metric'].textContent=pair(displaySamples(run.raw.inferenceMs));
  ui['infer-count'].textContent=run.counts.inferences+' 次累计推理'+label;
  ui['track-metric'].textContent=run.needInfer?`${run.counts.tracked} / ${run.counts.inferences}`:'未启用';
  ui['event-metric'].textContent=`${run.counts.events} / ${run.counts.transitions}`;
  ui['latency-metric'].textContent=pair(displaySamples(run.raw.sampleToDrawMs));
  ui['load-metric'].textContent=run.loadMs===null?'—':round(run.loadMs)+' ms';
  ui['error-metric'].textContent=run.errors.length+' 条运行错误';
  ui.gesture.textContent=run.active?(run.needInfer?(run.paused?'跟踪暂停，先自然站立':LABELS[run.gesture]):'仅渲染'):'已暂停';
}
function runFrames(run){
  return new Promise(resolve=>{
    function step(ts){
      if(!run.active){resolve();return}
      const now=performance.now(),elapsed=now-run.begin-WARMUP,measuring=elapsed>=0;
      run.elapsedMs=Math.max(0,elapsed);
      if(elapsed>=PROTOCOLS[run.protocol].duration){run.protocolCompleted=true;stopCurrent('protocol-complete');resolve();return}
      if(run.needInfer&&run.lastTrackedAt!==null&&now-run.lastTrackedAt>=500)loseTracking(run,now);
      if(run.needRender){
        try{
          run.engine.draw(now-run.begin,run.gesture);
          if(measuring){
            run.counts.frames++;
            if(run.lastDrawTs!==null){
              const d=ts-run.lastDrawTs;
              run.raw.frameMs.push(round(d));if(d>1000)run.counts.freeze++;
            }
          }
          if(run.feedback){
            const d=performance.now()-run.feedback.sampleAt;
            if(d>=0){run.raw.sampleToDrawMs.push(round(d));run.raw.sampleToDrawClocks.push(run.feedback.timestampKind)}
            run.feedback=null;
          }
          run.lastDrawTs=measuring?ts:null;
        }catch(e){run.stage='render';errorDetail(run,e);stopCurrent('render-error');resolve();return}
      }
      maybeInfer(run,now);
      const phase=phaseAt(run,elapsed);
      if(phase.key!==run.phaseKey){run.phaseKey=phase.key;run.phase=phase;ui.phase.textContent=phase.label;ui.prompt.textContent=phase.text;}
      if(now-run.lastUi>=750){updateMetrics(run,now);run.lastUi=now}
      if(run.active)run.frameId=requestAnimationFrame(step);else resolve();
    }
    run.frameId=requestAnimationFrame(step);
    // Cancellation must settle this promise even when rAF was cancelled by stop/background.
    const interval=setInterval(()=>{
      if(!run.active){clearInterval(interval);resolve();}
    },100);
  });
}
async function begin(run){
  let loadStart;
  try{
    // Called directly inside an explicit click, before an awaited operation.
    if(run.needCamera){
      stageStatus(run,'permission');
      if(!ui.consent.checked)throw new Error('CONSENT_REQUIRED');
      if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('HTTPS_CAMERA_UNAVAILABLE');
      setStatus('等待成人确认相机视频权限…');
      const permissionStart=performance.now();
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:'user',width:{ideal:480},height:{ideal:270},frameRate:{ideal:30}},audio:false
      });
      run.permissionMs=performance.now()-permissionStart;
      if(!run.active){stopTrack(stream);throw new Interrupted()}
      run.stream=stream;
      if(stream.getAudioTracks().length){stopTrack(stream);throw new Error('UNEXPECTED_AUDIO_TRACK')}
      run.hasCamera=true;
      const videoTrack=stream.getVideoTracks()[0];
      if(!videoTrack)throw new Error('NO_VIDEO_TRACK');
      videoTrack.addEventListener('ended',()=>{if(run.active)stopCurrent('camera-ended')},{once:true});
      const s=videoTrack.getSettings();
      run.cameraSettings={width:s.width??null,height:s.height??null,frameRate:s.frameRate??null};
      ui.camera.srcObject=stream;ui.camera.muted=true;ui.camera.playsInline=true;
      ui.viewfinder.hidden=false;ui.viewfinder.classList.toggle('preview-off',!ui.preview.checked);
      // Start playing immediately after attaching the approved stream.
      // Do not interleave configuration, engine or model fetches.
      stageStatus(run,'video');loadStart=performance.now();
      await ui.camera.play();guard(run);
      const deadline=performance.now()+8000;
      while(ui.camera.readyState<2&&performance.now()<deadline){guard(run);await wait(40)}
      if(ui.camera.readyState<2)throw new Error('CAMERA_FRAME_TIMEOUT');
      run.videoSize={width:ui.camera.videoWidth,height:ui.camera.videoHeight};
    }
    guard(run);
    loadStart??=performance.now();stageStatus(run,'config');
    const response=await fetch(asset('frozen-config.json'),{method:'GET',cache:'no-store',credentials:'omit'});
    if(!response.ok)throw new Error('CONFIG_LOAD');
    const cfg=await response.json();guard(run);
    if(cfg.scene.width!==960||cfg.scene.height!==540||cfg.scene.particles.maxVisible!==32||
      cfg.scene.shadows!==false||cfg.seed!==SEED||cfg.moveNet.backend!=='webgl'||cfg.moveNet.enableSmoothing!==false)
      throw new Error('FROZEN_CONFIG_MISMATCH');
    run.configProtocol=cfg.protocol;
    ui.stage.width=960;ui.stage.height=540;ui['no-render'].hidden=run.needRender;
    if(run.needRender){
      stageStatus(run,'engineImport');
      const module=await choices[run.candidate]();guard(run);
      stageStatus(run,'engineCreate');
      const engine=await module.createEngine(ui.stage,cfg,asset('scene.glb'));
      run.engine=engine;guard(run);
    }
    if(run.needInfer){
      stageStatus(run,'tfScript');await localScript('tf.min.js');guard(run);
      if(!globalThis.tf)throw new Error('LOCAL_MODEL_RUNTIME_UNAVAILABLE');
      stageStatus(run,'poseScript');await localScript('pose-detection.min.js');guard(run);
      if(!globalThis.tf||!globalThis.poseDetection)throw new Error('LOCAL_MODEL_RUNTIME_UNAVAILABLE');
      stageStatus(run,'backend');
      await tf.setBackend('webgl');await tf.ready();guard(run);
      run.backend=tf.getBackend();
      if(run.backend!=='webgl')throw new Error('UNAPPROVED_BACKEND');
      stageStatus(run,'detector');
      const detector=await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,{
        modelType:poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        modelUrl:asset('model.json'),enableSmoothing:false
      });
      run.detector=detector;guard(run);
    }
    if(run.synthetic){
      stageStatus(run,'synthetic');
      run.syntheticCanvas=document.createElement('canvas');run.syntheticCanvas.width=480;run.syntheticCanvas.height=270;
      syntheticFrame(run,0);
    }
    run.loadMs=performance.now()-loadStart;
    run.loading=false;run.begin=performance.now();run.paused=run.needInfer;
    run.invalidAt=run.begin;run.armed=false;setupState();
    if(run.needCamera)monitorVideoFrames(run);
    // The overlay stays visible until a successful initial actual draw.
    if(run.needRender){run.stage='render';run.engine.draw(0,'neutral');}
    ui['stage-overlay'].hidden=true;
    ui.source.textContent=run.synthetic?'SYNTHETIC · 无相机':run.needCamera?'真实成人相机 · 本地':'仅渲染 · 无相机';
    setStatus('正在本地测量。随时可停止；没有正式验收结论。');
    await runFrames(run);
  }catch(e){
    if(!(e instanceof Interrupted)){
      if(run.active){const detail=errorDetail(run,e);stopCurrent(detail.code);}
    }
  }finally{
    run.active=false;cancelCallbacks(run);stopCamera(run);closeRenderer(run);
    // Pending inference is allowed to settle before disposal, never starts more work.
    if(run.inference)try{await run.inference}catch{}
    if(run.detector){try{run.detector.dispose()}catch{run.errors.push('MODEL_DISPOSE')}run.detector=null;}
    run.syntheticCanvas=null;
    run.cameraTrackStates=run.stream?.getTracks().map(t=>t.readyState)??[];
    run.stream=null;
    // Do not retain or reuse the stopped renderer's canvas/WebGL context.
    const fresh=ui.stage.cloneNode(false);
    ui.stage.replaceWith(fresh);ui.stage=fresh;
    run.loading=false;run.network=observeResources(run);
    updateMetrics(run);
    lastCompleted=run;
    showReport(run);
    if(current===run)current=null;
    ui.consent.checked=false;
    setupState();
    const errors=run.errors;
    const detail=run.errorDetails.at(-1);
    const explanation=errors.includes('CAMERA_DENIED')?'相机权限被拒绝：可改用仅渲染或无相机内部自检，或在 Safari 中自行允许相机后重新主动开始。'
      :errors.length?'本次有运行错误：'+errors.join('、')+'；未签任何验收通过。'
      :run.protocolCompleted?'本轮已结束；资源已停止。结果仍需独立复核。':'本轮已停止；原因：'+(STOP_LABELS[run.stopReason]||'其他停止')+'。重新开始需主动确认。';
    if(detail)overlay(detail.code,((STAGE_LABELS[detail.stage]||detail.stage)+' · '+detail.name+' · '+detail.message),true);
    else overlay(run.protocolCompleted?'本轮已结束':'已停止',explanation,errors.length>0);
    setStatus(explanation);
  }
}
function observeResources(run){
  const entries=performance.getEntriesByType('resource');
  const groups={};
  for(const e of entries){const k=networkCategory(e.name);groups[k]=(groups[k]||0)+1;}
  return {observedResourceCategories:groups,observedSinceNavigation:entries.length,
    runStartResourceCount:run.resourceStart,cspViolations:privacyViolations.slice(),
    fullNetworkTrace:'UNVERIFIED: Performance 资源条目与 CSP 事件不是完整网络请求记录，仍须外部复核。'};
}
function summary(run,includeRaw=false){
  const planned=PROTOCOLS[run.protocol].duration;
  const completedTrials=Math.min(80,Math.floor(Math.min(run.elapsedMs,planned)/TRIAL_MS));
  const positives={};
  if(run.protocol==='positive'){
    for(const g of TARGETS){
      const done=run.trials.slice(0,completedTrials).filter(t=>t.expected===g);
      positives[g]={planned:20,completedPromptWindows:done.length,
        observedMatchedWindows:done.filter(t=>t.events.some(e=>e.gesture===g)).length,
        extraEvents:done.reduce((n,t)=>n+Math.max(0,t.events.length-1),0)};
    }
  }
  const report={
    experiment:'ULTRAL-MAN W8 / G1b',candidate:run.candidate,mode:run.mode,protocol:run.protocol,
    input:run.synthetic?'SYNTHETIC_CANVAS_NO_CAMERA; 实际模型推理自检，非真人准确率或 iPhone 验收':!run.needInfer?'NO_CAMERA_RENDER_ONLY':run.counts.inferences?'ACTUAL_CAMERA_FRAMES_MEASURED; 参与者自主确认成人身份':run.hasCamera?'CAMERA_GRANTED_NO_MEASURED_INFERENCE':'NO_GRANTED_CAMERA',
    status:'UNVERIFIED',completed:run.protocolCompleted,stopReason:run.stopReason,
    measuredMs:round(Math.min(run.elapsedMs||0,planned)),plannedMs:planned,backend:run.backend,
    cameraDimensions:run.cameraSettings,decodedVideoDimensions:run.videoSize??null,
    load:{afterPermissionMs:run.loadMs===null?null:round(run.loadMs),permissionWaitMs:run.permissionMs===null?null:round(run.permissionMs),
      definition:'按钮后，权限返回至准备可用；未含首次页面导航前段，不是完整冷载验收。'},
    frameIntervalsMs:stat(run.raw.frameMs),actualModelInferenceMs:stat(run.raw.inferenceMs),
    inputSampleObservedToDrawSubmittedMs:stat(run.raw.sampleToDrawMs),
    proxyClockCounts:run.raw.sampleToDrawClocks.reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{}),
    proxyTimingNote:'真实输入优先使用解码帧回调时钟，否则使用推理开始时钟；合成输入使用生成画布时钟。绘制提交并非真实可见反馈或真实动作开始。',
    counts:run.counts,positivePromptObservation:run.protocol==='positive'?positives:null,
    positiveNote:'提示窗口是否出现匹配事件只代表观察；不证明成人真实按提示完成，不能当作姿态准确率签 PASS。',
    trials:run.protocol==='positive'?run.trials.slice(0,completedTrials):null,
    negativeObservation:run.protocol==='negative'?{observedEventCount:run.counts.events,durationMs:round(Math.min(run.elapsedMs,planned)),groundTruth:'UNVERIFIED; 独立核对参与者非目标动作'}:null,
    enduranceObservation:run.protocol==='endurance'?{completedTwoMinuteLaps:Math.min(3,Math.floor(run.elapsedMs/120000)),frameIntervalsOverOneSecond:run.counts.freeze,crashOrReloadHistory:'UNVERIFIED'}:null,
    trackingLossObservation:run.raw.trackingLoss,network:run.network,
    errors:run.errors,errorDetails:run.errorDetails,cameraTrackStates:run.cameraTrackStates??[],
    unverified:['iPhone/Safari 真机及环境须参与者和独立审核确认：不自动读取设备指纹。',
      '真实成人动作/独立真值、每类准确率与误触、重复/漏识、实际动作到可见反馈。',
      '完整首载3次、内存、崩溃/重载、异常3次、停流实际时限及平台表现。',
      '完整网络记录、授权许可/独立舒适审查、正式技术选型均未签 PASS。']
  };
  if(includeRaw)report.rawAnonymousDurationsAndEvents=run.raw;
  return report;
}
function showReport(run){
  ui.report.textContent=JSON.stringify(summary(run),null,2);
  ui.copy.disabled=false;ui['copy-raw'].disabled=false;
  ui['copy-status'].textContent='仅本地匿名结果；如果需要，可以主动复制，不会自动发送。';
}
async function copyReport(raw){
  if(!lastCompleted)return;
  const text=JSON.stringify(summary(lastCompleted,raw),null,2);
  try{
    if(!navigator.clipboard?.writeText)throw new Error('unavailable');
    await navigator.clipboard.writeText(text);
    ui['copy-status'].textContent='已主动复制匿名结果。页面未上传结果。';
  }catch{
    ui.report.textContent=text;
    const range=document.createRange();range.selectNodeContents(ui.report);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    ui['copy-status'].textContent='系统未允许自动复制，请长按选中的文本自行复制。';
  }
}
ui.start.addEventListener('click',()=>{
  if(current)return;
  const error=validateChoice();
  if(error){setStatus(error);return}
  if(needsCamera(ui.mode.value)&&!ui.consent.checked){setStatus('请先由成年人自愿勾选同意。');return}
  const run=makeRun();current=run;setupState();
  ui.copy.disabled=true;ui['copy-raw'].disabled=true;ui['copy-status'].textContent='';
  ui.report.textContent='本轮进行中……';ui.source.textContent='正在准备';
  ui.clock.textContent='00:00';ui.gesture.textContent='等待输入';
  overlay('正在准备…',run.synthetic?'SYNTHETIC · 无相机内部自检':'准备同条件实验。');
  begin(run);
});
ui.stop.addEventListener('click',()=>stopCurrent('user-stop'));
for(const key of ['candidate','mode','protocol'])ui[key].addEventListener('change',()=>{
  if(current)stopCurrent('selection-changed');
  ui.consent.checked=false;setupState();
});
ui.consent.addEventListener('change',()=>{
  if(!ui.consent.checked&&current?.needCamera)stopCurrent('consent-withdrawn');
  setupState();
});
ui.preview.addEventListener('change',()=>ui.viewfinder.classList.toggle('preview-off',!ui.preview.checked));
ui.copy.addEventListener('click',()=>copyReport(false));
ui['copy-raw'].addEventListener('click',()=>copyReport(true));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCurrent('background')});
window.addEventListener('pagehide',()=>stopCurrent('page-exit'));
window.addEventListener('orientationchange',()=>stopCurrent('orientation-change'));
const orientation=matchMedia('(orientation: landscape)');
orientation.addEventListener?.('change',()=>stopCurrent('orientation-change'));
setupState();
