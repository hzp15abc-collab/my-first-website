// W5-D5 isolated G1b comparison. Not the production game, not a test verdict.
// Actual adult camera frames only; no coordinates, images, storage, identity or telemetry.
const el = id => document.getElementById(id);
const ui = Object.fromEntries([
  'candidate','mode','protocol','consent','start','stop','privacy','status','stage','no-render',
  'camera','viewfinder','preview','source','gesture','clock','prompt','phase','frame-metric',
  'frame-count','infer-metric','infer-count','track-metric','event-metric','latency-metric',
  'load-metric','error-metric','report','copy','copy-raw','copy-status'
].map(id=>[id,el(id)]));
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
    candidate,mode,protocol,needRender:mode!=='infer',needInfer:mode!=='render',active:true,loading:true,
    stream:null,detector:null,engine:null,inference:null,frameId:0,videoFrameId:null,decoded:null,lastVideoTime:-1,
    lastTrackedAt:null,invalidAt:null,paused:false,stable:null,stableCount:0,armed:false,gesture:'neutral',feedback:null,
    startedAt:performance.now(),begin:null,lastDrawTs:null,lastUi:0,phaseKey:'',hasCamera:false,permissionMs:null,loadMs:null,
    raw:{frameMs:[],inferenceMs:[],sampleToDrawMs:[],sampleToDrawClocks:[],events:[],trackingLoss:[]},
    counts:{frames:0,inferences:0,tracked:0,nonNeutral:0,transitions:0,events:0,freeze:0,loss:0,recovery:0},
    errors:[],elapsedMs:0,stopReason:null,protocolCompleted:false,trials:protocol==='positive'?randomTrials():[],
    phase:null,backend:null,cameraSettings:null,resourceStart:performance.getEntriesByType('resource').length
  }
}
function setStatus(t){ui.status.textContent=t}
function setupState(){
  const needsCamera=ui.mode.value!=='render';
  ui.consent.disabled=!needsCamera;
  ui.start.disabled=!!current||(needsCamera&&!ui.consent.checked);
  ui.stop.disabled=!current?.active;
  ui.privacy.textContent=needsCamera
    ?'仅成年人点击开始后才申请相机视频。视频仅本地推理，不上传、不存储、不录音；后台、退出、切换或停止会停流。'
    :'仅 3D 渲染：不申请相机、不启动识别。此工况不能作为相机或动作识别证据。';
}
function validateChoice(){
  const mode=ui.mode.value,protocol=ui.protocol.value;
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
  ui.source.textContent=run.needInfer?'已停止（相机已请求停流）':'仅渲染已停止 · 无相机';
  ui.gesture.textContent='已暂停';ui.phase.textContent='已停止';
  ui.prompt.textContent='实验已停止。重新开始须由成人再次主动确认。';
  ui.stop.disabled=true;
  setStatus('已请求停止。正在释放本地实验资源；不会自动恢复。');
}
function phaseAt(run,elapsed){
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
  if(!run.active||typeof ui.camera.requestVideoFrameCallback!=='function')return;
  run.videoFrameId=ui.camera.requestVideoFrameCallback((now,metadata)=>{
    run.videoFrameId=null;
    if(!run.active)return;
    run.decoded={time:metadata.mediaTime,observedAt:now};
    monitorVideoFrames(run);
  });
}
function maybeInfer(run,now){
  if(!run.needInfer||run.inference||ui.camera.readyState<2)return;
  const frame=typeof ui.camera.requestVideoFrameCallback==='function'?run.decoded:null;
  if(typeof ui.camera.requestVideoFrameCallback==='function'&&!frame)return;
  const currentTime=frame?.time??ui.camera.currentTime;
  if(!Number.isFinite(currentTime)||Math.abs(currentTime-run.lastVideoTime)<.0001)return;
  run.lastVideoTime=currentTime;
  const began=performance.now();
  const sampleAt=frame?.observedAt??began;
  const kind=frame?'decoded-frame-callback-observed':'inference-start-fallback';
  const measuring=began-run.begin>=WARMUP;
  // One asynchronous inference at a time, on an actual, newly decoded frame.
  run.inference=Promise.resolve().then(()=>{
    if(!run.active)return null;
    return run.detector.estimatePoses(ui.camera);
  }).then(poses=>{
    if(!run.active||!poses)return;
    const done=performance.now();
    handlePose(run,poses[0],sampleAt,kind,done,measuring,done-began);
  }).catch(()=>{
    if(run.active){run.errors.push('MODEL_INFERENCE');stopCurrent('inference-error')}
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
        }catch{run.errors.push('RENDER');stopCurrent('render-error');resolve();return}
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
    if(run.needInfer){
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
    }
    guard(run);
    loadStart=performance.now();setStatus('加载相同冻结场景与模型…');
    const response=await fetch(asset('frozen-config.json'),{method:'GET',cache:'no-store',credentials:'omit'});
    if(!response.ok)throw new Error('CONFIG_LOAD');
    const cfg=await response.json();guard(run);
    if(cfg.scene.width!==960||cfg.scene.height!==540||cfg.scene.particles.maxVisible!==32||
      cfg.scene.shadows!==false||cfg.seed!==SEED||cfg.moveNet.backend!=='webgl'||cfg.moveNet.enableSmoothing!==false)
      throw new Error('FROZEN_CONFIG_MISMATCH');
    run.configProtocol=cfg.protocol;
    ui.stage.width=960;ui.stage.height=540;ui.noRender.hidden=run.needRender;
    if(run.needInfer){
      await ui.camera.play();guard(run);
      const deadline=performance.now()+8000;
      while(ui.camera.readyState<2&&performance.now()<deadline){guard(run);await wait(40)}
      if(ui.camera.readyState<2)throw new Error('CAMERA_FRAME_TIMEOUT');
      run.videoSize={width:ui.camera.videoWidth,height:ui.camera.videoHeight};
    }
    if(run.needRender){
      const module=await choices[run.candidate]();guard(run);
      const engine=await module.createEngine(ui.stage,cfg,asset('scene.glb'));
      run.engine=engine;guard(run);
    }
    if(run.needInfer){
      if(!globalThis.tf||!globalThis.poseDetection)throw new Error('LOCAL_MODEL_RUNTIME_UNAVAILABLE');
      await tf.setBackend('webgl');await tf.ready();guard(run);
      run.backend=tf.getBackend();
      if(run.backend!=='webgl')throw new Error('UNAPPROVED_BACKEND');
      const detector=await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet,{
        modelType:poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        modelUrl:asset('model.json'),enableSmoothing:false
      });
      run.detector=detector;guard(run);
    }
    run.loadMs=performance.now()-loadStart;
    run.loading=false;run.begin=performance.now();run.paused=run.needInfer;
    run.invalidAt=run.begin;run.armed=false;setupState();
    if(run.needInfer)monitorVideoFrames(run);
    ui.source.textContent=run.needInfer?'真实成人相机 · 本地':'仅渲染 · 无相机';
    setStatus('正在本地测量。随时可停止；没有正式验收结论。');
    await runFrames(run);
  }catch(e){
    if(!(e instanceof Interrupted)){
      const name=e?.name||'Error';
      const internal=['CONSENT_REQUIRED','HTTPS_CAMERA_UNAVAILABLE','UNEXPECTED_AUDIO_TRACK','NO_VIDEO_TRACK','CONFIG_LOAD',
        'FROZEN_CONFIG_MISMATCH','CAMERA_FRAME_TIMEOUT','LOCAL_MODEL_RUNTIME_UNAVAILABLE','UNAPPROVED_BACKEND'].includes(e?.message);
      const code=internal?e.message:({NotAllowedError:'CAMERA_DENIED',NotFoundError:'CAMERA_NOT_FOUND',NotReadableError:'CAMERA_UNAVAILABLE',
        OverconstrainedError:'CAMERA_CONSTRAINT',SecurityError:'CAMERA_SECURITY'}[name]||'INITIALIZATION_ERROR');
      run.errors.push(code);
      if(run.active)stopCurrent(code);
    }
  }finally{
    run.active=false;cancelCallbacks(run);stopCamera(run);closeRenderer(run);
    // Pending inference is allowed to settle before disposal, never starts more work.
    if(run.inference)try{await run.inference}catch{}
    if(run.detector){try{run.detector.dispose()}catch{run.errors.push('MODEL_DISPOSE')}run.detector=null;}
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
    const explanation=errors.includes('CAMERA_DENIED')?'相机权限被拒绝：可改用仅渲染，或在 Safari 中自行允许相机后重新主动开始。'
      :errors.length?'本次有运行错误：'+errors.join('、')+'；未签任何验收通过。'
      :run.protocolCompleted?'本轮已结束；摄像头已停止。结果仍需独立复核。':'本轮已停止；重新开始需主动确认。';
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
    experiment:'ULTRAL-MAN W5 / G1b',candidate:run.candidate,mode:run.mode,protocol:run.protocol,
    input:!run.needInfer?'NO_CAMERA_RENDER_ONLY':run.counts.inferences?'ACTUAL_CAMERA_FRAMES_MEASURED; 参与者自主确认成人身份':run.hasCamera?'CAMERA_GRANTED_NO_MEASURED_INFERENCE':'NO_GRANTED_CAMERA',
    status:'UNVERIFIED',completed:run.protocolCompleted,stopReason:run.stopReason,
    measuredMs:round(Math.min(run.elapsedMs||0,planned)),plannedMs:planned,backend:run.backend,
    cameraDimensions:run.cameraSettings,decodedVideoDimensions:run.videoSize??null,
    load:{afterPermissionMs:run.loadMs===null?null:round(run.loadMs),permissionWaitMs:run.permissionMs===null?null:round(run.permissionMs),
      definition:'按钮后，权限返回至准备可用；未含首次页面导航前段，不是完整冷载验收。'},
    frameIntervalsMs:stat(run.raw.frameMs),actualModelInferenceMs:stat(run.raw.inferenceMs),
    inputSampleObservedToDrawSubmittedMs:stat(run.raw.sampleToDrawMs),
    proxyClockCounts:run.raw.sampleToDrawClocks.reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{}),
    proxyTimingNote:'优先使用解码帧回调时钟，否则使用推理开始时钟；绘制提交并非真实可见反馈或真实动作开始。',
    counts:run.counts,positivePromptObservation:run.protocol==='positive'?positives:null,
    positiveNote:'提示窗口是否出现匹配事件只代表观察；不证明成人真实按提示完成，不能当作姿态准确率签 PASS。',
    trials:run.protocol==='positive'?run.trials.slice(0,completedTrials):null,
    negativeObservation:run.protocol==='negative'?{observedEventCount:run.counts.events,durationMs:round(Math.min(run.elapsedMs,planned)),groundTruth:'UNVERIFIED; 独立核对参与者非目标动作'}:null,
    enduranceObservation:run.protocol==='endurance'?{completedTwoMinuteLaps:Math.min(3,Math.floor(run.elapsedMs/120000)),frameIntervalsOverOneSecond:run.counts.freeze,crashOrReloadHistory:'UNVERIFIED'}:null,
    trackingLossObservation:run.raw.trackingLoss,network:run.network,
    errors:run.errors,cameraTrackStates:run.cameraTrackStates??[],
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
  if(ui.mode.value!=='render'&&!ui.consent.checked){setStatus('请先由成年人自愿勾选同意。');return}
  const run=makeRun();current=run;setupState();
  ui.copy.disabled=true;ui['copy-raw'].disabled=true;ui['copy-status'].textContent='';
  ui.report.textContent='本轮进行中……';ui.source.textContent='正在准备';
  ui.clock.textContent='00:00';ui.gesture.textContent='等待输入';
  begin(run);
});
ui.stop.addEventListener('click',()=>stopCurrent('user-stop'));
for(const key of ['candidate','mode','protocol'])ui[key].addEventListener('change',()=>{
  if(current)stopCurrent('selection-changed');
  ui.consent.checked=false;setupState();
});
ui.consent.addEventListener('change',()=>{
  if(!ui.consent.checked&&current?.needInfer)stopCurrent('consent-withdrawn');
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
