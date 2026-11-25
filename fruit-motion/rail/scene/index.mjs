/* I02 G1b private validation renderer. Pure scene transformation from app state;
 * it owns no score, tracking, timing loop, media stream, storage or network. */
import {geometrySet} from './geometry.js';
import {createAdapter} from './cpu3d-vector-adapter.js';
import {createSceneManifest,MAX_OBJECTS} from './manifest.mjs';

const laneValue=v=>v===-1||v===0||v===1?v:0;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const mod=(x,n)=>((x%n)+n)%n;
const moving=m=>m.group==='cart'||m.group==='avatar'||m.dynamic==='course';
const validKind=k=>['block','bar','star','left_star','right_star'].includes(k);
function original(m,index){return {index,position:[...m.position],rotation:[...(m.rotation??[0,0,0])],scale:[1,1,1],active:true};}
const hide=t=>{t.active=false;return t;};

export function buildRenderTransforms(scene,state={}){
  const {manifest}=scene,ms=Number.isFinite(state.elapsedMs)?Math.max(0,state.elapsedMs):0;
  const lane=laneValue(state.lane),center=2.7*lane;
  const pose=['neutral','left_step','right_step','squat','arms_up','reach_left','reach_right'].includes(state.pose)?state.pose:'neutral';
  const objects=Array.isArray(state.objects)?state.objects:[];
  const guide=(state.activeLane===-1||state.activeLane===0||state.activeLane===1)?state.activeLane:null;
  const transformed=[];
  for(let index=0;index<manifest.meshes.length;index++){
    const m=manifest.meshes[index];if(!moving(m))continue;const t=original(m,index);
    if(m.group==='cart'||m.group==='avatar')t.position[0]+=center;
    if(m.group==='avatar'){
      if(pose==='squat'){
        // Lower the complete visible silhouette: hat top is below the bar's lower edge.
        if(m.id.startsWith('leg_')){t.position[1]-=.17;t.scale[1]=.38;}
        else if(!m.id.startsWith('foot_'))t.position[1]-=(m.id==='head'||m.id==='hat'||m.id==='hat-brim') ? .65 : .51;
      }else if(pose==='arms_up'&&m.id.startsWith('arm_')){
        const side=m.id.endsWith('_-1')?-1:1;t.position[0]+=side*.11;t.position[1]=1.87;t.rotation[2]=side*-.25;
      }else if((pose==='reach_left'||pose==='reach_right')&&m.id.startsWith('arm_')){
        const side=m.id.endsWith('_-1')?-1:1,target=pose==='reach_left'?-1:1;
        if(side===target){t.position[0]=center+side*.47;t.position[1]=1.42;t.rotation[2]=-side*Math.PI/2;}
      }else if((pose==='left_step'||pose==='right_step')&&!m.id.startsWith('foot_')&&!m.id.startsWith('leg_')){
        const side=pose==='left_step'?-1:1;t.position[0]+=side*.06;t.rotation[2]+=-side*.06;
      }
    }else if(m.id.startsWith('tie_')&&m.dynamic==='course'){
      t.position[2]=-17.75+mod(m.position[2]+17.75+ms*.0042,22.5);
    }else if(m.id.startsWith('obj-')){
      const match=/^obj-(\d+)-(.+)$/.exec(m.id),slot=Number(match[1]),piece=match[2],obj=objects[slot];
      if(slot>=MAX_OBJECTS||!obj||obj.active===false||!validKind(obj.kind)||!Number.isFinite(obj.distance)||obj.distance>72||obj.distance< -4){transformed.push(hide(t));continue;}
      const kind=obj.kind,isStar=kind.endsWith('star'),shown=kind==='block'?piece==='block'||piece.startsWith('stripe'):kind==='bar'?piece==='bar'||piece.startsWith('post'):isStar&&piece==='star';
      if(!shown){transformed.push(hide(t));continue;}
      t.position[0]+=2.7*laneValue(obj.lane);t.position[2]-=obj.distance;
      if(isStar){const side=kind==='left_star'?-1:kind==='right_star'?1:0;
        t.position[0]+=side*.93;t.position[1]=(side?1.51:2.21)+Math.sin(ms*.003+slot*.7)*.08;t.rotation[1]=Math.sin(ms*.0025+slot)*.30;
      }
    }else if(m.id.startsWith('guide-')){
      if(guide===null){transformed.push(hide(t));continue;}t.position[0]+=guide*2.7;
    }else if(m.id.startsWith('reward-')){
      // A restrained gold sparkle is shown only for an authoritative resolved
      // success, not a tutorial pose or a merely recognized action.
      if(state.feedback!=='⭐ 太棒了！'||state.tutorialDemo===true){transformed.push(hide(t));continue;}
      const phase=Number(m.id.slice(-1));t.position[0]+=center;t.position[1]+=.035*Math.sin(ms*.003+phase);t.rotation[1]=.25*Math.sin(ms*.002+phase);
    }
    transformed.push(t);
  }
  return transformed;
}

/** The app supplies all authoritative state and rAF. No fallback or fake wins. */
export function createRailScene(canvas){
  if(!canvas||typeof canvas.getContext!=='function')throw new TypeError('A real Canvas2D element is required');
  const scene=createSceneManifest(),data=geometrySet(scene.manifest);
  const adapter=createAdapter(canvas,scene.manifest,data,1);let disposed=false;
  return {
    render(state={}){if(disposed)return;adapter.render(buildRenderTransforms(scene,state));},
    resize(scale=1){if(disposed)return;const proposed=typeof scale==='number'&&scale>0&&scale<=1?scale:1;adapter.resize(clamp(proposed,.5,1));},
    info(){return {kind:'G1b private original forest scene',geometryCounts:{...data.counts},maxObjects:MAX_OBJECTS,assumptions:'CPU true perspective, exact cached static world / approximate depth-constrained moving faces',...adapter.info()};},
    dispose(){if(disposed)return;disposed=true;adapter.dispose();}
  };
}
