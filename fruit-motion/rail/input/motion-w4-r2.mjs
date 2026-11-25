// W4-B01 R2 separately versioned anchor-recovery controller. W3/R1 retained.
// Same action thresholds and 0.35 per-required-joint confidence. The changes are
// action-specific validity, short unknown neutral handling, and front-facing
// core/one-time screen direction checks. No fixture labels or expected windows used.
import {CONFIG as BASE_CONFIG} from './motion.mjs';
export {NAMES,ACTIONS} from './motion.mjs';
export const CONFIG=Object.freeze({...BASE_CONFIG,frontShoulderToTorso:.42,frontHipToTorso:.20,maxNeutralUnknownMs:250});
const avg=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const len=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a,b,c)=>{const u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y],d=Math.hypot(...u)*Math.hypot(...v);return d>1e-6?Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/d)))*180/Math.PI:0};
const median=ns=>{const a=[...ns].sort((x,y)=>x-y);return a[Math.floor(a.length/2)]};
export function geometryW4(points,previewMirror,width=1280,height=720){
 if(!Array.isArray(points))return {coreValid:false,reason:'no-points'};
 const p=Object.fromEntries(points.map(a=>[a.name,{x:(previewMirror?1-a.x:a.x)*width,y:a.y*height,score:Number.isFinite(a.score)?a.score:0}]));
 const valid=n=>p[n]&&p[n].score>=CONFIG.confidence&&Number.isFinite(p[n].x)&&Number.isFinite(p[n].y)&&p[n].x>=0&&p[n].x<=width&&p[n].y>=0&&p[n].y<=height;
 const coreNames=['left_shoulder','right_shoulder','left_hip','right_hip'];
 if(!coreNames.every(valid))return {coreValid:false,reason:'core-confidence-or-frame'};
 const s=avg(p.left_shoulder,p.right_shoulder),h=avg(p.left_hip,p.right_hip),t=len(s,h);
 // Screen-projected bilateral width rejects near side-on/collapsed estimates;
 // keep physical torso lengths independent of normalized aspect ratio.
 const w=Math.abs(p.left_shoulder.x-p.right_shoulder.x),hw=Math.abs(p.left_hip.x-p.right_hip.x);
 if(w<CONFIG.minimumShoulderPx||t<CONFIG.minimumTorsoPx||h.y<=s.y||w/t<CONFIG.frontShoulderToTorso||hw/t<CONFIG.frontHipToTorso)return {coreValid:false,reason:'collapsed-or-nonfront-core',w,hw,t};
 const upright=Math.abs(s.x-h.x)<t*.48&&(h.y-s.y)>t*.75;
 // Sort by displayed screen x once, not semantic anatomical label. Use the
 // elbow/wrist paired with that observed shoulder; crossing limbs cannot reach
 // outward on that side. Low points are unknown, never guessed or scored.
 const ln=p.left_shoulder.x<=p.right_shoulder.x?'left':'right',rn=ln==='left'?'right':'left';
 const arm=(name,isLeft)=>{if(![name+'_elbow',name+'_wrist'].every(valid))return {valid:false};const sh=p[name+'_shoulder'],e=p[name+'_elbow'],r=p[name+'_wrist'];const side=isLeft?-1:1;return {valid:true,down:r.y>sh.y+t*.15,raised:r.y<sh.y-CONFIG.raiseTorso*t,reach:side*(r.x-sh.x)>CONFIG.reachShoulder*w&&r.y<sh.y+CONFIG.reachYTorso*t&&side*(e.x-sh.x)>=-.05*w};};
 const l=arm(ln,true),r=arm(rn,false);
 const leg=name=>{if(![name+'_knee',name+'_ankle'].every(valid)||p[name+'_ankle'].y<=p[name+'_hip'].y+8)return {valid:false};return {valid:true,angle:angle(p[name+'_hip'],p[name+'_knee'],p[name+'_ankle']),ankle:p[name+'_ankle']};};
 const legs=[leg('left'),leg('right')],knownLegs=legs.filter(x=>x.valid),feet=legs.every(x=>x.valid)?avg(legs[0].ankle,legs[1].ankle):null;
 const armKnown=l.valid&&r.valid,legKnown=knownLegs.length>0;
 const armsNeutral=armKnown?l.down&&r.down&&!l.raised&&!r.raised&&!l.reach&&!r.reach:null;
 const legNeutral=legKnown?knownLegs.every(x=>x.angle>150):null;
 // Initial neutral requires trustworthy down-arms, one reliable straight leg,
 // and upright core. The other leg can be absent briefly, but both feet are
 // required to seed lateral-step calibration before a lateral event.
 const neutral=(!upright||armsNeutral===false||legNeutral===false)?false:(armsNeutral===null||legNeutral===null?null:true);
 return {coreValid:true,s,h,t,w,hw,upright,armsNeutral,legNeutral,neutral,l,r,legs,knownLegs,feet,raised:armKnown&&l.raised&&r.raised};
}
export class MotionClassifier {
 constructor(){this.reset();}
 reset(){this.session=null;this.last=-Infinity;this.baseline=null;this.anchor=null;this.cal=[];this.active=null;this.pending=null;this.pendingAt=0;this.pendingCount=0;this.neutralSince=null;this.lastKnownNeutral=-Infinity;this.footCal=[];}
 invalidate({clearAnchor=false}={}){
  // True tracking loss pauses immediately; do not silently choose a new center.
  if(clearAnchor)this.anchor=null;else if(this.baseline)this.anchor={...this.baseline};
  this.baseline=null;this.cal=[];this.active=null;this.pending=null;this.pendingCount=0;this.neutralSince=null;this.lastKnownNeutral=-Infinity;this.footCal=[];
 }
 // Integration calls only from an explicit player/parent calibration UI action,
 // never from automatic model recovery. Keep timestamp/session stale guards.
 requestRecenter({session=this.session}={}){if(session!==this.session)return false;this.invalidate({clearAnchor:true});return true;}
 update({points,previewMirror=true,session='default',timestampMs,width=1280,height=720,enabled=true}){
  if(!Number.isFinite(timestampMs))return {status:'bad-time',event:null};
  if(session!==this.session){if(typeof session==='number'&&typeof this.session==='number'&&session<this.session)return {status:'stale-session',event:null};this.reset();this.session=session;}
  if(timestampMs<=this.last)return {status:'stale-frame',event:null};
  const gap=timestampMs-this.last;this.last=timestampMs;if(gap>450)this.invalidate();
  if(!enabled){this.invalidate();return {status:'disabled',event:null};}
  const g=geometryW4(points,previewMirror,width,height);
  // Real core loss immediately pauses and resets. Never use last predicted
  // position to award an action during core loss or stale frames.
  if(!g.coreValid){this.invalidate();return {status:'lost',event:null,diagnostics:{reason:g.reason}};}
  if(!this.baseline){
   if(g.neutral===false){this.cal=[];this.lastKnownNeutral=-Infinity;return {status:'stand-neutral',event:null};}
   if(g.neutral===null){if(timestampMs-this.lastKnownNeutral>CONFIG.maxNeutralUnknownMs)this.cal=[];return {status:'neutral-unknown',event:null};}
   if(this.anchor){
    const a=this.anchor,nearCore=Math.abs(g.h.x-a.hx)<a.w*.23&&Math.abs(g.h.y-a.hy)<a.t*.12;
    // If an established anchor included two feet, require that evidence and
    // the same original screen center, not a different upright held position.
    const nearFeet=a.ax===null||!!g.feet&&Math.abs(g.feet.x-a.ax)<a.w*.20;
    if(!nearCore||!nearFeet){this.cal=[];this.lastKnownNeutral=-Infinity;return {status:'stand-neutral-anchor',event:null,diagnostics:{dx:g.h.x-a.hx,dy:g.h.y-a.hy,footdx:g.feet&&a.ax!==null?g.feet.x-a.ax:null}};}
   }
   // Reject unstable neutral vectors rather than combining distant/body-moved
   // calibrations. No threshold lowered; 0.23w / 0.12t already serve neutral return.
   const prev=this.cal[0];if(prev&&(Math.abs(g.h.x-prev.h.x)>prev.w*.23||Math.abs(g.h.y-prev.h.y)>prev.t*.12))this.cal=[];
   this.lastKnownNeutral=timestampMs;this.cal.push({h:g.h,a:g.feet,w:g.w,t:g.t,time:timestampMs});if(this.cal.length>8)this.cal.shift();
   if(this.cal.length>=CONFIG.minimumNeutralSamples&&timestampMs-this.cal[0].time>=CONFIG.minimumNeutralMs){
    const get=k=>median(this.cal.map(k));const observedFeet=this.cal.filter(x=>x.a);
    // Recovery restores the original neutral anchor exactly. A new vector
    // is created only before first calibration or after requestRecenter.
    this.baseline=this.anchor?{...this.anchor}:{hx:get(x=>x.h.x),hy:get(x=>x.h.y),w:get(x=>x.w),t:get(x=>x.t),ax:observedFeet.length>=2?median(observedFeet.map(x=>x.a.x)):null,ay:observedFeet.length>=2?median(observedFeet.map(x=>x.a.y)):null};this.anchor={...this.baseline};this.neutralSince=timestampMs;
   }
   return {status:this.baseline?'ready':'calibrating',event:null};
  }
  const b=this.baseline,dx=g.h.x-b.hx,dy=g.h.y-b.hy;
  // If initial one-leg neutral lacked two feet, quietly seed the feet only
  // after two consistent two-foot neutral observations near the known core.
  if(b.ax===null){if(g.neutral===true&&g.feet&&Math.abs(dx)<b.w*.23&&Math.abs(dy)<b.t*.12){this.footCal.push(g.feet);if(this.footCal.length>=2){b.ax=median(this.footCal.map(a=>a.x));b.ay=median(this.footCal.map(a=>a.y));this.footCal=[];}}else this.footCal=[];}
  const footdx=g.feet&&b.ax!==null?g.feet.x-b.ax:null;
  let kind=null;
  const squat=g.knownLegs.length>0&&dy>b.t*CONFIG.squatTorso&&g.knownLegs.some(x=>x.angle<155)&&g.upright;
  const armBothReach=g.l.valid&&g.r.valid&&g.l.reach&&g.r.reach;
  if(squat)kind='squat';
  else if(g.raised)kind='arms_up';
  // When the opposite arm is unobserved, don't guess single-arm reach versus
  // two-arm extension. A reach needs the outward arm and reliable opposite
  // wrist/elbow evidence that it isn't also outward; irrelevant legs may lapse.
  else if(!armBothReach&&g.l.valid&&g.r.valid&&g.l.reach!==g.r.reach)kind=g.l.reach?'reach_left':'reach_right';
  else if(footdx!==null&&Math.abs(dx)>b.w*CONFIG.stepShoulder&&Math.abs(footdx)>b.w*CONFIG.stepFootShoulder&&Math.sign(dx)===Math.sign(footdx)&&g.upright)kind=dx<0?'left_step':'right_step';
  // Rearm is action-specific. Unrelated limbs don't wipe the core calibration,
  // but a held action cannot be re-credited without actual relevant neutral.
  const coreNeutral=g.upright&&Math.abs(dx)<b.w*.23&&Math.abs(dy)<b.t*.12;
  const feetNeutral=footdx!==null&&Math.abs(footdx)<b.w*.20;
  let atNeutral=coreNeutral;
  if(this.active?.includes('step'))atNeutral=atNeutral&&feetNeutral&&g.legNeutral===true;
  else if(this.active==='squat')atNeutral=atNeutral&&g.legNeutral===true;
  else if(this.active)atNeutral=atNeutral&&g.armsNeutral===true;
  else atNeutral=atNeutral&&(g.armsNeutral!==false)&&(g.legNeutral!==false);
  if(!kind){
   this.pending=null;this.pendingCount=0;
   if(atNeutral){this.neutralSince??=timestampMs;if(timestampMs-this.neutralSince>=CONFIG.releaseMs)this.active=null;}else this.neutralSince=null;
   const unknown=!g.l.valid||!g.r.valid||!g.feet||!g.knownLegs.length;
   return {status:unknown?'ready-partial':'ready',event:null,diagnostics:{dx,dy,footdx}};
  }
  this.neutralSince=null;
  if(this.active)return {status:'active-held',event:null,diagnostics:{kind,dx,dy,footdx}};
  if(this.pending!==kind){this.pending=kind;this.pendingAt=timestampMs;this.pendingCount=1;}else this.pendingCount++;
  if(this.pendingCount<CONFIG.actionSamples||timestampMs-this.pendingAt<CONFIG.actionMinMs)return {status:'pending',event:null,diagnostics:{kind}};
  this.active=kind;this.pending=null;this.pendingCount=0;
  return {status:'event',event:{action:kind,session,timestampMs},diagnostics:{kind,dx,dy,footdx}};
 }
}
