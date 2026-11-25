// Original, soft synthesized private-proof feedback. No assets, recording, external requests.
const notes={
 success:[[523.25,0,.105,.058],[659.25,.085,.12,.055],[783.99,.18,.14,.047]],
 miss:[[392,0,.13,.035],[329.63,.10,.16,.028]],
 start:[[392,0,.10,.05],[523.25,.10,.12,.05]],
 finish:[[523.25,0,.12,.05],[659.25,.11,.12,.052],[783.99,.22,.20,.045]],
 step:[[440,0,.065,.026]],
 pause:[[349.23,0,.07,.020]]
};
export function createAudioCore(env){let context=null,master=null,muted=false,closed=false,active=new Set();
 function silence(){for(const item of [...active]){try{item.gain.gain.cancelScheduledValues(context?.currentTime??0);item.gain.gain.setValueAtTime(0,context?.currentTime??0);item.osc.stop()}catch{}try{item.osc.disconnect();item.gain.disconnect()}catch{}active.delete(item);}}
 function setVolume(value){if(master&&context){try{master.gain.cancelScheduledValues(context.currentTime);master.gain.setValueAtTime(value,context.currentTime)}catch{}}}
 async function unlock(){if(closed||env.hidden())return false;try{if(!context){context=env.makeContext();if(!context)return false;master=context.createGain();master.gain.value=muted?0:.32;master.connect(context.destination);}if(context.state==='suspended')await context.resume();if(env.hidden()){pause();return false;}setVolume(muted?0:.32);return context.state==='running';}catch{return false;}}
 function play(name){if(closed||muted||env.hidden()||context?.state!=='running'||!notes[name])return false;const t=context.currentTime+.012;try{for(const [freq,delay,duration,level]of notes[name]){const osc=context.createOscillator(),gain=context.createGain(),start=t+delay,end=start+duration;osc.type='sine';osc.frequency.setValueAtTime(freq,start);gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+.014);gain.gain.exponentialRampToValueAtTime(.001,end);gain.gain.setValueAtTime(0,end+.012);osc.connect(gain);gain.connect(master);const item={osc,gain};active.add(item);osc.onended=()=>{active.delete(item);try{osc.disconnect();gain.disconnect()}catch{}};osc.start(start);osc.stop(end+.018);}return true;}catch{silence();return false;}}
 function setMuted(value){muted=!!value;if(muted)silence();setVolume(muted?0:.32);return muted;}
 function pause(){silence();setVolume(0);if(context?.state==='running')try{return Promise.resolve(context.suspend()).catch(()=>{});}catch{}return Promise.resolve();}
 const onHidden=()=>{if(env.hidden())void pause();};const onPageHide=()=>{void pause();};env.addVisibility?.(onHidden);env.addPageHide?.(onPageHide);
 async function dispose(){if(closed)return;closed=true;silence();setVolume(0);env.removeVisibility?.(onHidden);env.removePageHide?.(onPageHide);try{await context?.close?.()}catch{}try{master?.disconnect()}catch{}context=null;master=null;}
 return Object.freeze({unlock,play,setMuted,pause,dispose});}
export function createAudio(){return createAudioCore({makeContext:()=>{const C=globalThis.AudioContext??globalThis.webkitAudioContext;return C?new C():null;},hidden:()=>document.hidden,addVisibility:fn=>document.addEventListener('visibilitychange',fn),removeVisibility:fn=>document.removeEventListener('visibilitychange',fn),addPageHide:fn=>window.addEventListener('pagehide',fn),removePageHide:fn=>window.removeEventListener('pagehide',fn)});}
