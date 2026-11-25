// B01 experimental, independently authored common model -> game action mapping.
// All coordinates are raw normalized camera image; map once to displayed view.
// The same classifier receives fixture points or either real model's predicted points.
export const NAMES = ['nose','left_eye','right_eye','left_ear','right_ear','left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist','left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle'];
export const ACTIONS = ['left_step','right_step','squat','arms_up','reach_left','reach_right'];
export const CONFIG=Object.freeze({confidence:.35,minimumShoulderPx:16,minimumTorsoPx:18,minimumNeutralSamples:4,minimumNeutralMs:95,actionSamples:2,actionMinMs:50,releaseMs:90,stepShoulder:.36,stepFootShoulder:.23,squatTorso:.16,raiseTorso:.20,reachShoulder:.45,reachYTorso:.5});
const LEGS=['left_hip','right_hip','left_knee','right_knee','left_ankle','right_ankle'];
const ESSENTIAL=['left_shoulder','right_shoulder','left_elbow','right_elbow','left_wrist','right_wrist',...LEGS];
const avg=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const len=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a,b,c)=>{let u=[a.x-b.x,a.y-b.y],v=[c.x-b.x,c.y-b.y],d=Math.hypot(...u)*Math.hypot(...v);return d>1e-6?Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/d)))*180/Math.PI:0};
export function geometry(points,previewMirror,width=1280,height=720){
 if(!Array.isArray(points))return null;
 const p=Object.fromEntries(points.map(a=>[a.name,{x:(previewMirror?1-a.x:a.x)*width,y:a.y*height,score:Number.isFinite(a.score)?a.score:0}]));
 if(ESSENTIAL.some(n=>!p[n]||!Number.isFinite(p[n].x)||!Number.isFinite(p[n].y)||p[n].score<CONFIG.confidence||p[n].x<0||p[n].x>width||p[n].y<0||p[n].y>height))return null;
 const s=avg(p.left_shoulder,p.right_shoulder),h=avg(p.left_hip,p.right_hip),a=avg(p.left_ankle,p.right_ankle),w=len(p.left_shoulder,p.right_shoulder),t=len(s,h);
 if(w<CONFIG.minimumShoulderPx||t<CONFIG.minimumTorsoPx||h.y<s.y-2||a.y<h.y+8)return null;
 const leftName=p.left_shoulder.x<=p.right_shoulder.x?'left':'right';
 const rightName=leftName==='left'?'right':'left';
 const ls=p[leftName+'_shoulder'],rs=p[rightName+'_shoulder'],lw=p[leftName+'_wrist'],rw=p[rightName+'_wrist'];
 const le=p[leftName+'_elbow'],re=p[rightName+'_elbow'];
 const reachL = lw.x < ls.x-CONFIG.reachShoulder*w && lw.y < ls.y+CONFIG.reachYTorso*t && le.x<=ls.x+0.05*w;
 const reachR = rw.x > rs.x+CONFIG.reachShoulder*w && rw.y < rs.y+CONFIG.reachYTorso*t && re.x>=rs.x-0.05*w;
 const raised= lw.y < ls.y-CONFIG.raiseTorso*t && rw.y < rs.y-CONFIG.raiseTorso*t;
 const kL=angle(p.left_hip,p.left_knee,p.left_ankle),kR=angle(p.right_hip,p.right_knee,p.right_ankle);
 const upright=Math.abs(s.x-h.x)<t*.48 && (h.y-s.y)>t*.75;
 const neutral = upright && Math.min(kL,kR)>150 && !raised && !reachL && !reachR && lw.y>ls.y+t*.15 && rw.y>rs.y+t*.15;
 return {s,h,a,w,t,kL,kR,upright,neutral,reachL,reachR,raised,minScore:Math.min(...ESSENTIAL.map(n=>p[n].score))};
}
export class MotionClassifier {
 constructor(){this.reset();}
 reset(){this.session=null;this.last=-Infinity;this.baseline=null;this.cal=[];this.active=null;this.pending=null;this.pendingAt=0;this.pendingCount=0;this.neutralSince=null;this.inactive=false;this.sampleCount=0;}
 invalidate(){this.baseline=null;this.cal=[];this.active=null;this.pending=null;this.pendingCount=0;this.neutralSince=null;}
 update({points,previewMirror=true,session='default',timestampMs,width=1280,height=720,enabled=true}){
  if(!Number.isFinite(timestampMs))return {status:'bad-time',event:null};
  if(session!==this.session){
   // Numeric session IDs are monotonic generation tokens. Reject results from an old generation.
   if(typeof session==='number'&&typeof this.session==='number'&&session<this.session)return {status:'stale-session',event:null};
   this.reset();this.session=session;
  }
  // Stale/same frame cannot trigger. A restarted session requires new neutral calibration.
  if(timestampMs<=this.last)return {status:'stale-frame',event:null};
  const gap=timestampMs-this.last;this.last=timestampMs;this.sampleCount++;
  if(gap>450)this.invalidate();
  if(!enabled){this.invalidate();return {status:'disabled',event:null};}
  const g=geometry(points,previewMirror,width,height);
  if(!g){this.invalidate();return {status:'lost',event:null};}
  if(!this.baseline){
   if(!g.neutral){this.cal=[];return {status:'stand-neutral',event:null};}
   this.cal.push({h:g.h,a:g.a,w:g.w,t:g.t,time:timestampMs});
   if(this.cal.length>8)this.cal.shift();
   if(this.cal.length>=CONFIG.minimumNeutralSamples&&timestampMs-this.cal[0].time>=CONFIG.minimumNeutralMs){
    const median=k=>{const sorted=this.cal.map(k).sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
    this.baseline={hx:median(x=>x.h.x),hy:median(x=>x.h.y),ax:median(x=>x.a.x),ay:median(x=>x.a.y),w:median(x=>x.w),t:median(x=>x.t)};
    this.neutralSince=timestampMs;
   }
   return {status:this.baseline?'ready':'calibrating',event:null};
  }
  const b=this.baseline,dx=g.h.x-b.hx,footdx=g.a.x-b.ax,dy=g.h.y-b.hy;
  let kind=null;
  if(dy>b.t*CONFIG.squatTorso && Math.min(g.kL,g.kR)<155 && g.upright)kind='squat';
  else if(g.raised)kind='arms_up';
  else if(g.reachL!==g.reachR)kind=g.reachL?'reach_left':'reach_right';
  else if(Math.abs(dx)>b.w*CONFIG.stepShoulder&&Math.abs(footdx)>b.w*CONFIG.stepFootShoulder&&Math.sign(dx)===Math.sign(footdx)&&g.upright)kind=dx<0?'left_step':'right_step';
  const atNeutral=g.neutral && Math.abs(dx)<b.w*.23 && Math.abs(footdx)<b.w*.20 && Math.abs(dy)<b.t*.12;
  if(!kind){
   this.pending=null; this.pendingCount=0;
   if(atNeutral){this.neutralSince??=timestampMs;if(timestampMs-this.neutralSince>=CONFIG.releaseMs)this.active=null;}
   else this.neutralSince=null;
   return {status:'ready',event:null,diagnostics:{dx,footdx,dy}};
  }
  this.neutralSince=null;
  if(this.active)return {status:'active-held',event:null,diagnostics:{kind,dx,footdx,dy}};
  if(this.pending!==kind){this.pending=kind;this.pendingAt=timestampMs;this.pendingCount=1;}
  else this.pendingCount++;
  if(this.pendingCount<CONFIG.actionSamples||timestampMs-this.pendingAt<CONFIG.actionMinMs)return {status:'pending',event:null,diagnostics:{kind}};
  this.active=kind; this.pending=null;this.pendingCount=0;
  return {status:'event',event:{action:kind,session,timestampMs},diagnostics:{kind,dx,footdx,dy}};
 }
}
