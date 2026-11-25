// W9 approved private candidate only; no public distribution or claim of complete V2.2.
import {createCombinedArtTheme} from './combined-art-theme.js?v=2.3-w4';
import {MONSTER_CUES,HERO_CUES} from './monster-audio.js?v=2.0-iso';
export function newMotionSeed(){try{return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];}catch{return Math.floor(Math.random()*4294967296)>>>0;}}
const bases={w7:new URL('../assets/family-w7/',import.meta.url),w8:new URL('../assets/family-w8/',import.meta.url)};
export async function loadFamilyCandidate({fetchImpl=globalThis.fetch,loadImage}={}){
  async function manifest(base){const url=new URL('manifest.json',base);const response=await fetchImpl(url,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw new Error('角色清单无法载入');return response.json();}
  const [m7,m8]=await Promise.all([manifest(bases.w7),manifest(bases.w8)]);
  return createCombinedArtTheme(m7,m8,{baseW7:bases.w7,baseW8:bases.w8,technicalPreview:true,...(loadImage?{loadImage}:{})});
}
export function mapNamedAudioEvent(event,theme){
  const role=theme?.roleById?.[event?.roleId];if(!role||event?.id===undefined)return null;
  const kind=event.kind,cue=event.cue;if(role.hero){if(kind!=='wrong'||cue!==role.wrongCue)return null;const old=Object.keys(HERO_CUES).find(x=>HERO_CUES[x]===cue);return old?{...event,roleId:old}:null;}
  const expected=kind==='appear'?role.appearanceCue:kind==='defeat'?role.defeatCue:null;if(!expected||cue!==expected)return null;const clip=MONSTER_CUES[cue];return clip&&clip.kind===kind?{...event,roleId:clip.roleId}:null;
}
export const FAMILY_COUNT=24;
