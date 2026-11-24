// W63-capability-1. Static, original, no model/media or result transmission.
const el = id => document.getElementById(id);
const start = el('start'), progress = el('progress'), secure = el('secure');
const glOut = el('gl'), glCleanup = el('gl-cleanup');
const gpuOut = el('gpu'), gpuCleanup = el('gpu-cleanup');
const fresh = () => ({status:'NOT_RUN', reason:'未运行', cleanup:'NOT_ACQUIRED'});
const glResult = fresh(), gpuResult = fresh();
const cleanupText = Object.freeze({
  NOT_ACQUIRED:'未获取',
  REQUESTED_UNVERIFIED:'已请求或尝试清理，未能确认',
  VERIFIED:'已确认清理条件'
});
const operations = Object.freeze({
  operation:Symbol(), timeout:Symbol(), interrupted:Symbol(), lost:Symbol()
});
const statusReason = reason =>
  reason === operations.timeout ? '超时' :
  reason === operations.interrupted ? '中断' :
  reason === operations.lost ? '上下文或设备丢失' : '操作失败';
let started=false, closed=false, active=null, deadline=0, overallTimer=null;
let unresolved=false;
let abort, glOwner=null, gpuOwner=null;
const pending = new Set();
const show = (out, cleanup, result) => {
  out.textContent = result.status + ' · ' + result.reason;
  cleanup.textContent = result.cleanup + ' · ' + cleanupText[result.cleanup];
};
function render() {
  show(glOut,glCleanup,glResult);
  show(gpuOut,gpuCleanup,gpuResult);
}
function finish(message) {
  if (closed) return;
  closed=true;
  clearTimeout(overallTimer);
  start.disabled=true;
  progress.textContent=message;
  render();
}
function releaseGL(verify) {
  const owner=glOwner;
  glOwner=null;
  if (!owner) return 'NOT_ACQUIRED';
  let result=owner.context ? 'REQUESTED_UNVERIFIED' : 'NOT_ACQUIRED';
  if (owner.context) {
    // Only the standard context-release extension; no device/renderer query.
    try {
      const release=owner.context.getExtension('WEBGL_lose_context');
      if (release) {
        release.loseContext();
        if (verify && owner.context.isContextLost()) result='VERIFIED';
      }
    } catch {}
  }
  try { owner.canvas.width=0; owner.canvas.height=0; } catch {
    if (owner.context) result='REQUESTED_UNVERIFIED';
  }
  owner.context=null;
  owner.canvas=null;
  return result;
}
function releaseGPU(owner) {
  if (!owner || owner.released) return;
  owner.released=true;
  // On any interrupted operation, do not read more output. Release only.
  if (owner.scopeOpen) {
    owner.scopeOpen=false;
    owner.cleanupError=true;
    try { Promise.resolve(owner.device.popErrorScope()).catch(()=>{}); } catch {}
  }
  if (owner.readback) {
    try { if (owner.readback.mapState==='mapped') owner.readback.unmap(); }
    catch { owner.cleanupError=true; }
  }
  for (const buffer of [owner.readback,owner.storage]) {
    if (buffer) try {buffer.destroy();} catch {owner.cleanupError=true;}
  }
  owner.readback=null; owner.storage=null;
  if (owner.device) {
    owner.destroyStarted=true;
    try {owner.device.destroy(); owner.destroyCalled=true;}
    catch {owner.cleanupError=true;}
  }
}
function stopRun(reason) {
  if (!started || closed) return;
  abort.abort();
  if (active) {
    active.status='FAIL';
    active.reason=statusReason(reason);
    if (pending.size) active.cleanup='REQUESTED_UNVERIFIED';
  }
  if (glOwner) glResult.cleanup=releaseGL(false);
  if (gpuOwner) {
    releaseGPU(gpuOwner);
    gpuResult.cleanup='REQUESTED_UNVERIFIED';
    gpuOwner=null;
  }
  finish(reason===operations.timeout ? '检测已超时停止，请勿重试。' : '检测已经中断，请勿重试。');
}
function ensureLive() {
  if (closed || abort.signal.aborted) throw operations.interrupted;
  if (document.hidden) {stopRun(operations.interrupted);throw operations.interrupted;}
  if (performance.now()>=deadline) {stopRun(operations.timeout);throw operations.timeout;}
}
// A native promise cannot necessarily be cancelled. Terminate our wait, then
// observe the late settlement only to dispose of any resulting owned resources.
function bounded(work, onLate=()=>{}) {
  ensureLive();
  return new Promise((resolve,reject)=>{
    const signal=abort.signal, token={};
    let ended=false, timer;
    const clear=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);};
    const fail=reason=>{
      if(!ended){
        if(reason===operations.timeout || reason===operations.interrupted)unresolved=true;
        ended=true;clear();reject(reason);
      }
    };
    const cancel=()=>fail(operations.interrupted);
    pending.add(token);
    signal.addEventListener('abort',cancel,{once:true});
    timer=setTimeout(()=>fail(operations.timeout),Math.min(8000,Math.max(0,deadline-performance.now())));
    let native;
    try {native=work();}
    catch {pending.delete(token);fail(operations.operation);return;}
    Promise.resolve(native).then(value=>{
      pending.delete(token);
      if (ended || closed || signal.aborted || document.hidden || performance.now()>=deadline) {
        try {Promise.resolve(onLate(value)).catch(()=>{});} catch {}
        fail(document.hidden ? operations.interrupted : operations.timeout);
        return;
      }
      ended=true;clear();resolve(value);
    },()=>{
      pending.delete(token);
      fail(operations.operation);
    });
  });
}
function checkGL() {
  active=glResult;
  let severe=false;
  try {
    ensureLive();
    const canvas=document.createElement('canvas');
    canvas.width=1; canvas.height=1;
    glOwner={canvas,context:null};
    const gl=canvas.getContext('webgl2');
    glOwner.context=gl;
    ensureLive();
    if (!gl) {glResult.status='UNSUPPORTED';glResult.reason='上下文不可用';}
    else {
      gl.clearColor(1,0,1,1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      ensureLive();
      const value=new Uint8Array(4);
      gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,value);
      const error=gl.getError(), lost=gl.isContextLost();
      ensureLive();
      if (lost) {severe=true;throw operations.lost;}
      if(error!==gl.NO_ERROR || value[0]!==255 || value[1]!==0 || value[2]!==255 || value[3]!==255)
        throw operations.operation;
      glResult.status='PASS';glResult.reason='固定颜色读回一致';
    }
  } catch (reason) {
    if (!closed) {severe=true;glResult.status='FAIL';glResult.reason=statusReason(reason);}
  } finally {
    if (!closed) glResult.cleanup=releaseGL(true);
  }
  if (closed) return false;
  ensureLive();
  active=null;
  render();
  return !severe && glResult.cleanup!=='REQUESTED_UNVERIFIED';
}
async function checkGPU() {
  active=gpuResult;
  let owner=null, outcome='FAIL', reason='操作失败';
  try {
    ensureLive();
    if (!navigator.gpu || typeof navigator.gpu.requestAdapter!=='function') {
      outcome='UNSUPPORTED';reason='默认 API 不可用';
      return;
    }
    const adapter=await bounded(()=>navigator.gpu.requestAdapter());
    ensureLive();
    if (!adapter) {outcome='UNSUPPORTED';reason='无默认适配器';return;}
    const device=await bounded(()=>adapter.requestDevice(),late=>{
      // No late outcome reporting; discard/release a device that arrived late.
      if(late) {
        try {Promise.resolve(late.lost).catch(()=>{});} catch {}
        try {late.destroy();} catch {}
      }
    });
    owner={device,storage:null,readback:null,scopeOpen:false,released:false,
      destroyStarted:false,destroyCalled:false,cleanupError:false,unexpectedLoss:false,gpuError:false};
    gpuOwner=owner;
    if (!device) throw operations.operation;
    const loss=Promise.resolve(device.lost).then(info=>{
      if (!closed && !(owner.destroyStarted && info?.reason==='destroyed')) owner.unexpectedLoss=true;
      return owner.destroyStarted && info?.reason==='destroyed';
    },()=>{if(!closed)owner.unexpectedLoss=true;return false;});
    owner.loss=loss;
    device.addEventListener('uncapturederror',()=>{if(!closed)owner.gpuError=true;});
    ensureLive();
    device.pushErrorScope('validation');
    owner.scopeOpen=true;
    owner.storage=device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});
    owner.readback=device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const module=device.createShaderModule({code:'@group(0) @binding(0) var<storage, read_write> value: array<u32>; @compute @workgroup_size(1) fn main() { value[0] = 6u * 7u; }'});
    const pipeline=await bounded(()=>device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}}));
    ensureLive();
    if(owner.unexpectedLoss)throw operations.lost;
    const group=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:owner.storage}}]});
    const encoder=device.createCommandEncoder(), pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,group);
    ensureLive();
    pass.dispatchWorkgroups(1);pass.end();
    encoder.copyBufferToBuffer(owner.storage,0,owner.readback,0,4);
    ensureLive();
    device.queue.submit([encoder.finish()]);
    const readback=owner.readback;
    await bounded(()=>readback.mapAsync(GPUMapMode.READ),()=>{
      try {if(readback.mapState==='mapped')readback.unmap();}catch {}
    });
    ensureLive();
    if(owner.unexpectedLoss)throw operations.lost;
    if(readback.mapState!=='mapped')throw operations.operation;
    const value=new Uint32Array(readback.getMappedRange());
    const correct=value.length===1 && value[0]===42;
    readback.unmap();
    owner.scopeOpen=false;
    const validation=await bounded(()=>device.popErrorScope());
    ensureLive();
    if(owner.unexpectedLoss)throw operations.lost;
    if(!correct || validation!==null || owner.gpuError)throw operations.operation;
    outcome='PASS';reason='固定算术读回一致';
  } catch (error) {
    outcome='FAIL';reason=statusReason(error);
  } finally {
    if (!closed && owner) {
      gpuResult.cleanup='REQUESTED_UNVERIFIED';
      releaseGPU(owner);
      // Only verify in the still-visible single run. Unresolved operations
      // prevent a verified cleanup, even when a destroy call succeeded.
      if(owner.device && owner.destroyCalled && !owner.cleanupError && !unresolved && pending.size===0) {
        try {
          const lost=await bounded(()=>owner.loss);
          ensureLive();
          if(lost && !owner.unexpectedLoss && !owner.gpuError && pending.size===0)
            gpuResult.cleanup='VERIFIED';
        } catch (error) {outcome='FAIL';reason=statusReason(error);}
      }
      if(!closed && (owner.unexpectedLoss || owner.gpuError)) {
        outcome='FAIL';reason=owner.unexpectedLoss?'上下文或设备丢失':'操作失败';
      }
      gpuOwner=null;
    }
    if(!closed) {
      if(pending.size || unresolved)gpuResult.cleanup='REQUESTED_UNVERIFIED';
      gpuResult.status=outcome;gpuResult.reason=reason;
      active=null;render();
    }
  }
}
async function run() {
  try {
    const sameOrigin=new URL(import.meta.url).origin===location.origin;
    const safe=globalThis.isSecureContext===true && sameOrigin;
    secure.textContent=safe?'PASS · 安全上下文':'FAIL · 不满足前置条件';
    if(!safe) {finish('未运行：不满足前置条件。请勿重试。');return;}
    ensureLive();
    if(!checkGL()) {
      if(!closed){gpuResult.reason='前序异常或清理未确认';finish('已停止，请勿重试。');}
      return;
    }
    await checkGPU();
    if(!closed){ensureLive();finish('检测已结束。请勿重试；清理未确认不代表通过全部条件。');}
  } catch(error) {
    if(!closed)stopRun(error===operations.timeout?error:operations.interrupted);
  }
}
if ([start,progress,secure,glOut,glCleanup,gpuOut,gpuCleanup].every(Boolean)) {
  start.addEventListener('click',event=>{
    if(started || !event.isTrusted)return;
    started=true;start.disabled=true;
    abort=new AbortController();
    deadline=performance.now()+30000;
    overallTimer=setTimeout(()=>stopRun(operations.timeout),30000);
    progress.textContent='正在检测，请保持页面在前台。';
    void run();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRun(operations.interrupted);});
  window.addEventListener('pagehide',()=>stopRun(operations.interrupted));
  start.disabled=false;
  progress.textContent='已就绪，点击一次开始。';
}
