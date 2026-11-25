// Browser controller logic with private-proof lifecycle; env injected only by
// index.mjs in the actual app. E2-L test uses explicit separate env mock.
import {MotionClassifier} from './motion-w4-r2.mjs';
const messages={idle:'点击开始相机，准备站在画面中央。',requesting:'请允许相机访问（不使用麦克风）。',loading:'相机已连接，正在本机加载姿态模型。',calibrating:'站在镜头中央、双手放下，等待准备完成。', 'stand-neutral':'站直，双手放下，等待准备。','neutral-unknown':'请让肩、髋、手脚清楚进入画面。','stand-neutral-anchor':'请回到原来的准备位置；需要换位置时点击重新校准。',ready:'已准备，跟随画面动作。','ready-partial':'部分关节不清楚，暂缓动作，请让全身入镜。',pending:'正在确认动作。',event:'已确认动作。','active-held':'回到准备姿势后可以做下一个动作。',lost:'未确认有效身体姿态；游戏暂停，请回到准备位置。','stale-frame':'等待新相机帧。','stale-session':'等待当前相机会话。','bad-time':'无法确认相机时间，暂停等待。',paused:'相机已关闭，点击开始相机恢复。',background:'已切到后台，相机关闭；返回后请点击开始。',stopped:'相机已关闭。',disposed:'本次相机验证已结束。',error:'相机或本地模型不可用，请重试。'};
export function createCameraControllerCore({video,onState=()=>{},onAction=()=>{},onError=()=>{}},env){
 if(!video)throw TypeError('video element required');
 const classifier=new MotionClassifier();let canvas=null,ctx=null;
 let epoch=0,session=0,active=false,disposed=false,capture=null,trackEndHandlers=[],frameHandle=null,startTask=null,adapterPromise=null,adapter=null,inFlight=null,lastMediaTime=null,lastFrameTimestamp=-Infinity,sourceDimensions=null,watchdogTimer=null,lastResultWall=-Infinity,watchdogStale=false;
 const clock=env.clock;let currentStatus='idle';
 const safeCall=(cb,val)=>{try{cb(val);}catch{/* consumer callback failure cannot keep camera running */try{env.log?.('Camera callback failed');}catch{}}};
 function publish(status,extra={}){currentStatus=status;const partial=extra.partial??status==='ready-partial';const ready=extra.ready??(['ready','pending','event','active-held'].includes(status)&&!partial);safeCall(onState,{status,message:extra.message??messages[status]??messages.error,ready:!!ready,partial:!!partial,...('inferenceMs'in extra?{inferenceMs:extra.inferenceMs}:{}),session, ...(Number.isFinite(extra.timestampMs)?{timestampMs:extra.timestampMs}:{})});}
 const still=g=>!disposed&&active&&g===epoch&&!env.hidden();
 function stopTracks(s){if(!s)return;for(const t of s.getTracks?.()??[])try{t.stop()}catch{}}
 function cancelFrame(){if(frameHandle){try{frameHandle.cancel(frameHandle.id)}catch{}frameHandle=null;}}
 function clearWatchdog(){if(watchdogTimer!==null){env.clearInterval(watchdogTimer);watchdogTimer=null;}}
 function armWatchdog(g,stale=false){clearWatchdog();lastResultWall=clock();watchdogStale=stale;watchdogTimer=env.setInterval(()=>{
   if(!still(g)||watchdogStale||clock()-lastResultWall<=600)return;
   // A stuck video or inference may otherwise leave the previous ready status
   // visible forever. Invalidate old frame epoch but retain neutral anchor;
   // resume only from fresh observed neutral, never award old pending results.
   const next=++epoch;cancelFrame();classifier.invalidate();publish('stale-frame',{ready:false,message:'相机或识别没有新画面，游戏暂停；请回到准备位置。'});armWatchdog(next,true);schedule(next);
  },100);}
 function endCapture(){cancelFrame();clearWatchdog();for(const [track,fn] of trackEndHandlers){try{track.removeEventListener?.('ended',fn)}catch{}}trackEndHandlers=[];const s=capture;capture=null;stopTracks(s);try{video.pause?.()}catch{}try{video.srcObject=null}catch{}lastMediaTime=null;lastFrameTimestamp=-Infinity;sourceDimensions=null;}
 function invalidate(status,message){++epoch;active=false;startTask=null;classifier.invalidate();endCapture();publish(status,message?{message,ready:false}:{ready:false});}
 function fail(g,error,message){if(g!==epoch||disposed)return;invalidate('error',message);safeCall(onError,new Error(message??error?.message??messages.error));}
 function ensureAdapter(){if(!adapterPromise){adapterPromise=Promise.resolve().then(env.createAdapter).then(a=>{if(disposed){a.dispose?.();throw Error('Controller ended before model initialization');}adapter=a;return a;});}return adapterPromise;}
 function captureCanvas(){if(!canvas){canvas=env.makeCanvas();ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Unable to create the on-device pose canvas');}const w=Number(video.videoWidth),h=Number(video.videoHeight);if(!w||!h)return false;const scale=Math.min(1,1280/Math.max(w,h));const cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;ctx.drawImage(video,0,0,cw,ch);return true;}
 function schedule(g){if(!still(g)||frameHandle)return;const callback=(now,meta)=>{frameHandle=null;void frame(g,meta);};if(typeof video.requestVideoFrameCallback==='function'){frameHandle={kind:'video',id:video.requestVideoFrameCallback(callback),cancel:id=>video.cancelVideoFrameCallback?.(id)};}else{frameHandle={kind:'raf',id:env.raf(callback),cancel:env.caf};}}
 async function frame(g,meta){if(!still(g))return;if(inFlight){schedule(g);return;}const mediaTime=Number.isFinite(meta?.mediaTime)?Number(meta.mediaTime):Number(video.currentTime);
  if(video.readyState<2||!Number.isFinite(mediaTime)||mediaTime===lastMediaTime){schedule(g);return;}
  // The actual camera frame may not yet be available; no guessed action.
  let timestampMs=clock();if(!Number.isFinite(timestampMs)||timestampMs<=lastFrameTimestamp){schedule(g);return;}
  try{if(!captureCanvas()){publish('calibrating',{ready:false});schedule(g);return;}const dims=`${canvas.width}x${canvas.height}`;if(sourceDimensions&&dims!==sourceDimensions){invalidate('paused','相机画面方向或尺寸已变化，请重新开始并校准。');return;}sourceDimensions=dims;}catch(e){fail(g,e,'相机画面无法读取，请重新开始。');return;}
  lastFrameTimestamp=timestampMs;lastMediaTime=mediaTime;
  const localSession=session;const p=Promise.resolve().then(()=>adapter.predict(canvas,timestampMs));inFlight=p;
  try{const result=await p;if(!still(g)||localSession!==session)return;
   // Never pass fixture truth, a stored pose, or UI practice actions here.
   // R2 validates confidence, front-facing geometry, anchor, dwell and generation.
   lastResultWall=clock();watchdogStale=false;const ret=classifier.update({points:result.points,previewMirror:true,session:localSession,timestampMs,width:canvas.width,height:canvas.height,enabled:true});
   const action=ret.event;const finiteMs=Number.isFinite(result.inferenceMs)?result.inferenceMs:undefined;
   // At partial starts no two-foot neutral yet, so freeze ordinary progression.
   // A validated action has its exact required-point checks in R2 and is allowed.
   const partial=ret.status==='ready-partial'||(ret.status==='ready'&&classifier.baseline?.ax===null);
   publish(ret.status,{partial,ready:!!action||(['ready','pending','active-held'].includes(ret.status)&&!partial),inferenceMs:finiteMs,timestampMs});
   if(action&&still(g)&&action.session===localSession&&action.timestampMs===timestampMs)safeCall(onAction,action);
  }catch(e){if(still(g))fail(g,e,'本机姿态识别暂不可用，相机已关闭。请重新打开／重载验证页面。');}
  finally{if(inFlight===p)inFlight=null;if(still(g))schedule(g);}
 }
 async function doStart(g){let s=null;try{
   // Call permission synchronously as part of the user's explicit start gesture.
   if(!env.mediaDevices?.getUserMedia)throw Error('Camera not available on this page');
   s=await env.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:25,max:30}}});
   if(disposed||g!==epoch||env.hidden()){stopTracks(s);return false;}
   capture=s;video.muted=true;video.playsInline=true;video.setAttribute?.('playsinline','');video.srcObject=s;
   for(const track of s.getVideoTracks?.()??s.getTracks?.()??[]){const handler=()=>{if(capture===s&&!disposed)invalidate('stopped','相机已断开，点击开始重新连接。');};track.addEventListener?.('ended',handler);trackEndHandlers.push([track,handler]);}
   await video.play?.();if(disposed||g!==epoch||env.hidden()){if(capture===s)endCapture();else stopTracks(s);return false;}
   publish('loading',{ready:false});await ensureAdapter();
   if(disposed||g!==epoch||env.hidden()){if(capture===s)endCapture();else stopTracks(s);return false;}
   active=true;publish('calibrating',{ready:false});armWatchdog(g);schedule(g);return true;
  }catch(e){if(g!==epoch||disposed){stopTracks(s);return false;}if(s&&capture!==s)stopTracks(s);const msg=e?.name==='NotAllowedError'?'没有相机权限。可在 Safari 设置允许相机，或选择触摸练习。':!env.mediaDevices?.getUserMedia?'当前页面无法使用相机。请在支持相机的 HTTPS Safari 打开，或使用触摸练习。':capture?'相机或本地姿态模型加载失败，相机已关闭。可选触摸练习或重载页面。':'无法打开相机。请检查相机是否被占用，或选择触摸练习。';fail(g,e,msg);return false;}
 }
 function start(){if(disposed){publish('disposed',{ready:false});return Promise.resolve(false);}if(env.hidden()){publish('background',{ready:false});return Promise.resolve(false);}if(active&&capture)return Promise.resolve(true);if(startTask)return startTask;const g=++epoch;session++;endCapture();publish('requesting',{ready:false});const p=doStart(g);startTask=p;p.finally(()=>{if(startTask===p)startTask=null;});return p;}
 async function pause(){if(!disposed)invalidate('paused');return true;}
 async function stop(){if(!disposed)invalidate('stopped');return true;}
 async function recenter(){if(disposed||!active||!capture){publish('paused',{ready:false,message:'请先点击开始相机，再重新校准。'});return false;}++epoch;cancelFrame();if(classifier.session===session)classifier.requestRecenter({session});else classifier.reset();publish('calibrating',{ready:false,message:'已重新校准，请站直、双手放下，等待准备。'});armWatchdog(epoch);schedule(epoch);return true;}
 const onHidden=()=>{if(env.hidden()&&!disposed)invalidate('background');};const onPageHide=()=>{if(!disposed)invalidate('background');};
 env.addVisibility?.(onHidden);env.addPageHide?.(onPageHide);
 async function dispose(){if(disposed)return true;disposed=true;++epoch;active=false;startTask=null;classifier.invalidate();endCapture();env.removeVisibility?.(onHidden);env.removePageHide?.(onPageHide);publish('disposed',{ready:false});const p=inFlight;if(p)try{await p}catch{}if(adapter){try{adapter.dispose?.()}catch{}adapter=null;}canvas=null;ctx=null;return true;}
 publish('idle',{ready:false});return Object.freeze({start,pause,stop,recenter,dispose});
}
