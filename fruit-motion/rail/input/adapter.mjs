// W5 private proof only: exact W4 strict-CSP MoveNet v4 runtime, same weights and processing.
// URL base is this module, not document path; runtime/model initialized once per controller.
import {NAMES} from './motion.mjs';
const now=()=>performance.now();
const finite=(v,fallback)=>Number.isFinite(v)?v:fallback;
const localURL=relative=>{const u=new URL(relative,import.meta.url);if(u.origin!==window.location.origin)throw Error('Model asset must remain same origin');return u.href;};
async function localScript(relative){const url=localURL(relative);await new Promise((ok,fail)=>{const s=document.createElement('script');let runtimeError=null;const errors=e=>{if(e.filename===url)runtimeError=new Error(`Local model runtime: ${e.message}`)};window.addEventListener('error',errors);const cleanup=()=>window.removeEventListener('error',errors);s.src=url;s.onload=()=>{cleanup();runtimeError?fail(runtimeError):ok()};s.onerror=()=>{cleanup();fail(Error('Local model file could not load'))};document.head.append(s);});}
let runtimePromise=null;
function ensureRuntime(){if(!runtimePromise)runtimePromise=(async()=>{
 await localScript('./vendor/movenet/tf.es2017.min.js');
 if(typeof globalThis.tf?.registerBackend!=='function')throw Error('Pinned TFJS runtime unavailable');
 await localScript('./vendor/movenet/tf-backend-wasm.es2017.min.js');
 if(typeof globalThis.tf?.wasm?.setWasmPaths!=='function')throw Error('Pinned WASM backend unavailable');
 await localScript('./vendor/movenet/pose-detection.min.js');
 if(typeof globalThis.poseDetection?.createDetector!=='function')throw Error('Pinned MoveNet detector unavailable');
 globalThis.tf.wasm.setWasmPaths(localURL('./vendor/movenet/'));
 globalThis.tf.wasm.setThreadsCount(1);
 if(!await globalThis.tf.setBackend('wasm'))throw Error('WASM backend initialization returned false');
 await globalThis.tf.ready();
 return globalThis.tf;
})();return runtimePromise;}
export async function createPoseAdapter(){const t0=now();const tf=await ensureRuntime();const pd=globalThis.poseDetection;const d=await pd.createDetector(pd.SupportedModels.MoveNet,{modelType:pd.movenet.modelType.SINGLEPOSE_LIGHTNING,modelUrl:localURL('./vendor/movenet/model/model.json'),enableSmoothing:false,minPoseScore:.25});let closed=false;return {candidate:'movenet-lightning-v4-wasm-es2017',backend:tf.getBackend(),initMs:now()-t0,async predict(canvas,timestampMs){if(closed)throw Error('Pose detector disposed');const t=now();const r=await d.estimatePoses(canvas,{flipHorizontal:false},timestampMs);const l=r?.[0]?.keypoints;const pts=l?l.map((p,i)=>({name:p.name??NAMES[i],x:p.x/canvas.width,y:p.y/canvas.height,score:finite(p.score,0)})):[];return {points:pts,inferenceMs:now()-t,rawCount:l?.length??0};},dispose(){if(!closed){closed=true;d.dispose();}}};}
