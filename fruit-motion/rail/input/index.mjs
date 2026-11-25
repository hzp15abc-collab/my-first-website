// W5 private playable validation hypothesis, not selected production input.
import {createCameraControllerCore} from './core.mjs';
import {createPoseAdapter} from './adapter.mjs';
export function createCameraController(options){return createCameraControllerCore(options,{
 mediaDevices:globalThis.navigator?.mediaDevices,createAdapter:createPoseAdapter,makeCanvas:()=>document.createElement('canvas'),clock:()=>performance.now(),raf:callback=>requestAnimationFrame(callback),caf:id=>cancelAnimationFrame(id),hidden:()=>document.hidden,setInterval:(fn,ms)=>window.setInterval(fn,ms),clearInterval:id=>window.clearInterval(id),
 addVisibility:fn=>document.addEventListener('visibilitychange',fn),removeVisibility:fn=>document.removeEventListener('visibilitychange',fn),addPageHide:fn=>window.addEventListener('pagehide',fn),removePageHide:fn=>window.removeEventListener('pagehide',fn),log:()=>console.warn('Camera UI callback failed')
});}
