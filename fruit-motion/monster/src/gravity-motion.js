import {FruitGame,pointSegmentDistance,COLLISION_HISTORY_MS} from './game.js?v=2.3-w4';
import {annotateImpact} from './v23-effects.js?v=2.3-w4';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)); const lerp=(a,b,t)=>a+(b-a)*t;
export const seeded=(seed)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
export function safeRect(game,r=game.targetRadius){const a=game.playArea,pad=r+2;return {l:Math.max(a.left+pad,game.reachZone?game.width*game.reachZone.minX:-Infinity),r:Math.min(a.right-pad,game.reachZone?game.width*game.reachZone.maxX:Infinity),t:Math.max(a.top+pad,game.reachZone?.minY!=null?game.height*game.reachZone.minY:-Infinity),b:Math.min(a.bottom-pad,game.reachZone?.maxY!=null?game.height*game.reachZone.maxY:Infinity)}}
const valid=b=>b.r-b.l>1&&b.b-b.t>1;
const zone=(x,y,b)=>clamp(Math.floor(3*(x-b.l)/(b.r-b.l)),0,2)+3*clamp(Math.floor(3*(y-b.t)/(b.b-b.t)),0,2);
// Canvas y downward; analytic constant gravity, horizontal speed constant.
export function point(p,t){const u=clamp(t,0,p.life);return {x:p.x0+p.vx*u,y:p.y0+p.vy0*u+.5*p.g*u*u,vx:p.vx,vy:p.vy0+p.g*u};}
export function operable(f){return f?.path&&f.age>=f.path.in-1e-8&&f.age<=f.path.out+1e-8;}
// W3 scoring-only: exact complete-window intervals between analytic grid crossings.
// No physics, legal windows, collisions, caps, RNG draws or candidate limits changed.
function coverageSegments(p,b){const times=[p.in,p.out];for(let i=1;i<3;i++){
  if(Math.abs(p.vx)>1e-12){const t=(b.l+(b.r-b.l)*i/3-p.x0)/p.vx;if(t>p.in&&t<p.out)times.push(t);}
  const y=b.t+(b.b-b.t)*i/3,disc=p.vy0*p.vy0-2*p.g*(p.y0-y);if(disc>0){for(const t of [(-p.vy0-Math.sqrt(disc))/p.g,(-p.vy0+Math.sqrt(disc))/p.g])if(t>p.in&&t<p.out)times.push(t);}}
  times.sort((x,y)=>x-y);const out=[];for(let i=1;i<times.length;i++){const start=times[i-1],end=times[i];if(end-start<1e-10)continue;const q=point(p,(start+end)/2),cell=zone(q.x,q.y,b);const last=out.at(-1);if(last?.cell===cell&&Math.abs(last.end-start)<1e-8)last.end=end;else out.push({start,end,cell});}return out;}
function eligibleCells(segments){const out=Array(9).fill(0);for(const v of segments)if(v.end-v.start>=.15-1e-10)out[v.cell]+=v.end-v.start;return out;}
const credit=(t)=>(t>=.15-1e-10?t:0);
function accrueObserved(cells,segments,before,after){for(const v of segments){const cap=v.end-v.start,old=clamp(before-v.start,0,cap),now=clamp(after-v.start,0,cap);cells[v.cell]+=credit(now)-credit(old);}}
function canPlace(game,p){for(const o of game.fruits){const q=o.path;const lo=Math.max(0,p.visIn,q.visIn-o.age),hi=Math.min(p.life,p.visOut,q.life-o.age,q.visOut-o.age);if(hi<lo)continue;
  const min=(p.radius+o.r)*1.08+3,dt=.02,n=Math.max(1,Math.ceil((hi-lo)/dt));
  const maxRel=Math.hypot(p.vx-q.vx,Math.max(Math.abs(p.vy0+p.g*lo-q.vy0-q.g*(o.age+lo)),Math.abs(p.vy0+p.g*hi-q.vy0-q.g*(o.age+hi))));
  const margin=maxRel*(hi-lo)/n/2;
  for(let i=0;i<=n;i++){const t=lo+(hi-lo)*i/n,a=point(p,t),b=point(q,o.age+t);if(Math.hypot(a.x-b.x,a.y-b.y)<min+margin-1e-9)return false;}
 }return true;}
function shuf(a,rng){for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export class GravityGame extends FruitGame {
  constructor(opts){super(opts);this.captureDiagnostics=opts.captureDiagnostics!==false;this.strategy=opts.strategy;this.motionRng=seeded(opts.seed);this.heroRng=seeded((opts.seed??1)^0x6b27f911);this.heroLog=[];this.heroTierBag=[];this.heroAt=Infinity;this.dispatch=[];this.pathLog=[];this.cellSeconds=Array(9).fill(0);this.apexBag=[];this.recent=[];this.bag=[];this.tierBag=[];this.centerSeconds=0;this.totalSeconds=0;this.motionTime=0;this.nextAt=0;}
  start(opts){if(opts.theme?.id!=='monster')return super.start(opts);this.motionTime=0;this.roundDuration=opts.duration;this.nextAt=0;this.bag=[];this.recent=[];this.tierBag=[];this.centerSeconds=0;this.totalSeconds=0;this.heroAt=Infinity;this.heroLog=[];this.heroTierBag=[];this.pathLog=[];this.dispatch=[];this.cellSeconds=Array(9).fill(0);this.apexBag=[];this.candidateThemePending=true;super.start(opts);this.candidateThemePending=false;this.nextAt=this.active?this.spacing():.16;}
  get narrowActive(){return this.active&&!!this.reachZone&&this.reachZone.maxX-this.reachZone.minX<.30;}
  spacing(){if(this.active&&this.reachZone&&this.reachZone.maxX-this.reachZone.minX<.30)return lerp(1.88,2.48,this.motionRng());return this.active?lerp(.88,1.53,this.motionRng()):lerp(1.08,1.69,this.motionRng());}
  spawnActiveWave(){if(this.theme?.id!=='monster')return super.spawnActiveWave();if(this.candidateThemePending){const ok=this.spawnCandidate();if(ok)this.onWave({count:1});return ok;}if(this.motionTime!=null)return this.spawnCandidate();return false;}
  // W4 lifecycle adapter: suppress the original base's immediate virtual spawn
  // during geometry refresh (it would emit an appear cue for a discarded path).
  // Non-monster behavior, calibration normalization, phase clock and score remain original.
  resetGravityGeometry(){this.fruits=[];this.halves=[];this.particles=[];this.popups=[];this.bombEffect=null;this.themeEffects=[];this.clearHands();this.frameHistory=[];this.heroAt=Infinity;this.nextAt=this.motionTime;this.cellSeconds=Array(9).fill(0);this.recent=[];this.centerSeconds=0;this.totalSeconds=0;this.apexBag=[];}
  resize(){if(this.theme?.id!=='monster'||!this.running)return super.resize();const oldw=this.width,oldh=this.height,wasRunning=this.running;this.running=false;try{super.resize();}finally{this.running=wasRunning;}if(oldw!==this.width||oldh!==this.height)this.resetGravityGeometry();}
  setCameraBounds(rect){if(this.theme?.id!=='monster'||!this.running)return super.setCameraBounds(rect);const wasRunning=this.running;let changed;this.running=false;try{changed=super.setCameraBounds(rect);}finally{this.running=wasRunning;}if(changed)this.resetGravityGeometry();return changed;}
  setReachZone(zone){const before=this.reachZone?{...this.reachZone}:null,result=super.setReachZone(zone),after=this.reachZone;
    const same=(!before&&!after)||(before&&after&&['minX','maxX','minY','maxY'].every(key=>before[key]===after[key]));
    if(!same&&this.theme?.id==='monster'&&this.running)this.resetGravityGeometry();return result;}
  stop(){super.stop();if(this.theme?.id==='monster'){this.heroAt=Infinity;this.nextAt=Infinity;}}
  addThemeEffect(fruit,kind){super.addThemeEffect(fruit,kind);if(this.theme?.id==='monster'){const effect=this.themeEffects.at(-1);if(effect)annotateImpact(effect,this.roundSerial,fruit,kind,this.elapsed,this.shouldReduceMotion);}}
  mkPath(bounds,r,opts={}){
    const area=this.playArea,H=area.height,W=area.width,rng=opts.rng??this.motionRng;
    const y0=area.bottom+r+2,yFull=area.bottom-r-2,minApex=bounds.t,maxApex=Math.min(bounds.b,yFull-1),width=bounds.r-bounds.l;
    if(minApex>=maxApex||width<=1)return null;
    let g,apex,vy0,fullLife;const tier=opts.tier;
    if(this.strategy==='A'){
      g=H*(tier===2?lerp(1.12,1.8,rng()):tier===0?lerp(.30,.88,rng()):lerp(.35,1.8,rng()));
      // Direct initial-velocity sample, conditioned only by physical peak bounds.
      const lo=Math.sqrt(2*g*(y0-maxApex)),hi=Math.sqrt(2*g*(y0-minApex));
      vy0=-lerp(lo,hi,tier===2?lerp(.62,1,rng()):tier===0?lerp(0,.48,rng()):rng());apex=y0-vy0*vy0/(2*g);
    }else{
      const fy=opts.band==null?tier===2?lerp(0,.40,rng()):tier===0?lerp(.62,.98,rng()):rng():(Math.floor(opts.band/3)+rng())/3;
      apex=lerp(minApex,maxApex,fy);const D=yFull-apex;
      const verticalCap=Math.min(2*r*6.67,H*1.5);
      const minimum=Math.max(.65,Math.sqrt(8*D/(1.8*H)),4*D/verticalCap);
      const maximum=Math.sqrt(8*D/(.30*H));if(maximum<minimum)return null;
      // Bias to a range near the shortest safe complete window for density,
      // varying true g and launch strength; no rewriting solved trajectory.
      fullLife=tier===2?lerp(minimum,Math.min(maximum,minimum*1.10+.04),rng()):tier===0?lerp(minimum,Math.min(maximum,minimum*1.85+.25),lerp(.55,1,rng())):lerp(minimum,Math.min(maximum,minimum*1.45+.18),rng());g=8*D/(fullLife*fullLife);vy0=-Math.sqrt(2*g*(y0-apex));
    }
    const D=yFull-apex;if(D<=0||g<=0||apex<minApex-1e-6||apex>maxApex+1e-6)return null;
    const a=-vy0/g,T=2*a,half=Math.sqrt(2*D/g),tin=a-half,tout=a+half;fullLife=2*half;
    if(fullLife<.65||tin<0||tout>T||T>8||this.motionTime+tin+.65>this.roundDuration+1e-8)return null;
    if(opts.deadline!==undefined&&this.motionTime+tout>opts.deadline+1e-8)return null;
    // Whole physical launch/render interval keeps x in the original safe calibrated rectangle.
    let x0=lerp(bounds.l,bounds.r,rng()),xend;
    if(tier===2){
      const vedge=g*half,linear=2*r*6.67,axis=1.5;
      if(vedge>linear||vedge/H>axis)return null;
      const speedCap=Math.min(Math.sqrt(Math.max(0,linear*linear-vedge*vedge)),W*Math.sqrt(Math.max(0,axis*axis-(vedge/H)**2)));
      const maxDrift=Math.min(width,speedCap*T),delta=lerp(.50,.97,rng())*maxDrift;
      if(rng()<.5){x0=lerp(bounds.l,bounds.r-delta,rng());xend=x0+delta;}else{x0=lerp(bounds.l+delta,bounds.r,rng());xend=x0-delta;}
    }else if(tier===0){const delta=lerp(-.15,.15,rng())*width;x0=lerp(bounds.l+Math.max(0,-delta),bounds.r-Math.max(0,delta),rng());xend=x0+delta;}
    else if(opts.band!=null&&this.strategy==='C'){
      const mid=lerp(bounds.l,bounds.r,(opts.band%3+rng())/3),delta=lerp(-1,1,rng())*Math.min(mid-bounds.l,bounds.r-mid)*2;x0=mid-delta/2;xend=mid+delta/2;
    }else if(this.strategy==='A'){
      xend=x0+lerp(-.7,.7,rng())*width;if(xend<bounds.l||xend>bounds.r)return null;
    }else{xend=lerp(bounds.l,bounds.r,rng());}
    const vx=(xend-x0)/T,vedge=g*half;
    if(Math.hypot(vx,vedge)/(2*r)>6.67+1e-8||Math.hypot(vx/W,vedge/H)>1.5+1e-8)return null;
    const hVis=Math.sqrt(2*(area.bottom+r-apex)/g),p={x0,y0,vx,vy0,g,life:T,in:tin,out:tout,visIn:a-hVis,visOut:a+hVis,apex,apexT:a,radius:r,xEnd:xend,fullLife,cell:zone(x0+vx*a,apex,bounds),dir:(xend-x0)/width};
    let speed=0,center=0;const full={l:area.left,r:area.right,t:area.top,b:area.bottom},cells=Array(9).fill(0);const N=30;
    for(let i=0;i<N;i++){const q=point(p,tin+(i+.5)*fullLife/N);speed+=Math.hypot(q.vx,q.vy)/(2*r)/N;const d=fullLife/N;cells[zone(q.x,q.y,bounds)]+=d;if(zone(q.x,q.y,full)===4)center+=d;}
    if(tier===2&&speed<2.54||tier===0&&speed>1.26||tier===1&&(speed<1.33||speed>2.47))return null;
    if(this.strategy==='C'){p.coverageSegments=coverageSegments(p,bounds);p.eligibleCells=eligibleCells(p.coverageSegments);}
    p.speed=speed;p.tier=speed<1.3?0:speed<=2.5?1:2;p.center=center;p.cells=cells;p.heightTier=clamp(Math.floor(3*(apex-bounds.t)/(bounds.b-bounds.t)),0,2);
    return p;
  }
  emitPath(p,r,bomb){const q=point(p,0),f={...q,path:p,age:0,r,g:p.g,id:this.nextId++,type:bomb?this.nextObstacleType():this.nextActiveType(),rot:0,vr:0,spawnTime:this.motionTime};this.fruits.push(f);if(this.captureDiagnostics)this.pathLog.push({id:f.id,type:f.type,bomb,spawnTime:this.motionTime,path:p});this.emitRole(f,'appear');return f;}
  spawnCandidate(){const begin=performance.now();let count=0;try{
    if(this.fruits.length>=this.maxObjects)return false;
    const positive=this.fruits.find(f=>!this.isObstacle(f.type)&&operable(f)&&f.path.out-f.age>.35);
    const canBomb=!this.narrowActive&&!!positive&&this.motionTime>=this.mode.bombGrace&&this.motionTime-this.lastBombAge>=4.5&&!this.fruits.some(f=>this.isObstacle(f.type));
    const roleRand=this.motionRng();let bomb=canBomb&&(this.motionTime-this.lastBombAge>=13||roleRand<this.mode.bombRate),bounds=safeRect(this,this.targetRadius);if(!valid(bounds))return false;
    const rng=this.motionRng;const narrow=this.reachZone&&this.reachZone.maxX-this.reachZone.minX<.30;
    // Same clock/safety for all three. Only C ranks limited candidates against real coverage.
    if(!this.tierBag.length)this.tierBag=shuf([0,0,1,1,1,1,2,2],rng);const wantedTier=this.tierBag[0];
    const select=(isBomb)=>{let r=this.targetRadius*(isBomb?.83:1),list=[];const limit=isBomb||narrow?48:(this.strategy==='C'?128:112);for(let i=0;i<limit;i++){count++;const planned=!isBomb&&!narrow&&i<limit*.78?wantedTier:undefined;
      const band=this.strategy==='C'?(i%2===0&&planned===undefined?Math.floor(rng()*9):null):null;
      const p=this.mkPath(bounds,r,{band,tier:planned,...(isBomb?{deadline:this.motionTime+positive.path.out-positive.age}:{} )});if(!p||!canPlace(this,p))continue;
      if(isBomb&&positive.path.out-positive.age-p.in<.35)continue;
      // Penalise central dwell in C; unweighted A/B remain independent baselines.
      if(this.strategy==='C'){
        if(!narrow&&(this.centerSeconds+p.center)>.215*(this.totalSeconds+p.fullLife)+.18)continue;
        // True previously observed residence; weighted general deficit from equal-grid target.
        // Candidate contribution counts only complete contiguous >=150ms intervals.
        const history=this.cellSeconds.reduce((a,b)=>a+b,0),target=1/9;let weight=0;
        for(let j=0;j<9;j++){const share=history>0?this.cellSeconds[j]/history:target;const deficit=Math.max(0,(target-share)/target);weight+=p.eligibleCells[j]*(1+4*deficit*deficit)/(1+this.cellSeconds[j]/12);}
        weight/=p.fullLife;
        if(!narrow&&this.totalSeconds>2&&(this.centerSeconds+p.center)>.25*(this.totalSeconds+p.fullLife))weight*=.18;
        list.push({...p,weight:Math.max(.001,weight)});if(list.length>=8)break;
      }else return p;
    }if(!list.length)return null;let roll=rng()*list.reduce((s,p)=>s+p.weight,0);for(const p of list){roll-=p.weight;if(roll<=0)return p;}return list.at(-1);};
    let p=select(bomb);if(!p&&bomb){bomb=false;p=select(false);}if(!p)return false;
    this.spawnSeq++;if(bomb)this.lastBombAge=this.motionTime;const f=this.emitPath(p,p.radius,bomb);if(!bomb&&!narrow){const slot=this.tierBag.indexOf(p.tier);if(slot>=0)this.tierBag.splice(slot,1);else this.tierBag.shift();}
    if(this.narrowActive&&!bomb)this.heroAt=this.motionTime+p.in+.05;
    this.totalSeconds+=p.fullLife;this.centerSeconds+=p.center;if(this.strategy!=='C')for(let j=0;j<9;j++)this.cellSeconds[j]+=p.cells[j];return true;
  }finally{if(this.captureDiagnostics)this.dispatch.push({ms:performance.now()-begin,attempts:count});}}
  spawnNarrowHero(){const begin=performance.now(),t=this.motionTime;let attempts=0;const state={time:t,positiveCount:this.fruits.filter(f=>!this.isObstacle(f.type)&&operable(f)).length,heroCount:this.fruits.filter(f=>this.isObstacle(f.type)).length,elapsedSinceHero:t-this.lastBombAge,status:'skip'};
    const finish=reason=>{state.reason=reason;state.attempts=attempts;if(this.captureDiagnostics)this.heroLog.push(state);return false;};
    try{if(!this.narrowActive)return finish('not-narrow-active');if(this.fruits.length>=this.maxObjects||state.heroCount)return finish('capacity');if(t<this.mode.bombGrace)return finish('grace');if(t-this.lastBombAge<4.5)return finish('cooldown');
      const positive=this.fruits.find(f=>!this.isObstacle(f.type)&&operable(f)&&f.path.out-f.age>.35);if(!positive)return finish('no-complete-positive');state.positiveId=positive.id;state.positiveRemaining=positive.path.out-positive.age;
      const rng=this.heroRng;if(t-this.lastBombAge<13&&rng()>=this.mode.bombRate)return finish('rate');const bounds=safeRect(this,this.targetRadius),r=this.targetRadius*.83;
      // Search only safely complete hero windows before the existing full positive ends.
      for(let i=0;i<72;i++){attempts++;const p=this.mkPath(bounds,r,{rng,deadline:t+state.positiveRemaining});if(!p||!canPlace(this,p)||state.positiveRemaining-p.in<.35)continue;
        // Hero holds slot to true bottom exit; never force or accelerate existing positive.
        this.lastBombAge=t;const h=this.emitPath(p,r,true);state.status='success';state.reason='safe-path';state.heroId=h.id;state.life=p.life;state.fullLife=p.fullLife;state.attempts=attempts;state.path=p;state.positivePath=positive.path;state.positiveAge=positive.age;if(this.captureDiagnostics)this.heroLog.push(state);return true;}
      return finish('no-safe-trajectory');
    }finally{if(this.captureDiagnostics)this.dispatch.push({ms:performance.now()-begin,attempts});}
  }
  // Actual original input path: narrow full-window eligibility, not a new blade radius or motion threshold.
  recordFrame(timestamp){const previous=this.frameHistory.at(-1);super.recordFrame(timestamp);const f=this.frameHistory.at(-1);if(f&&f!==previous&&this.theme?.id==='monster')f.motionTime=this.motionTime;}
  sliceAlong(a,b){if(this.theme?.id!=='monster')return super.sliceAlong(a,b);const all=this.fruits,eligible=all.filter(operable),allowed=new Set(eligible);this.fruits=eligible;super.sliceAlong(a,b);const remain=new Set(this.fruits);this.fruits=all.filter(f=>!allowed.has(f)||remain.has(f));}
  sliceAtSampleTime(a,b,receivedAt){if(this.theme?.id!=='monster')return super.sliceAtSampleTime(a,b,receivedAt);
    if(!this.frameHistory.length||b.t<=a.t)return;
    const start=Math.max(a.t,receivedAt-COLLISION_HISTORY_MS),end=Math.min(b.t,receivedAt);if(end<start)return;
    const bladeRadius=clamp(Math.min(this.width,this.height)*.026,8,18),handAt=t=>{const f=(t-a.t)/(b.t-a.t);return {x:lerp(a.x,b.x,f),y:lerp(a.y,b.y,f)};};
    for(const fruit of [...this.fruits]){let hit=false;for(let i=0;i<this.frameHistory.length;i++){const frame=this.frameHistory[i],after=this.frameHistory[i+1],from=frame.targets.get(fruit);if(!from)continue;const until=after?.t??receivedAt;let t0=Math.max(start,frame.t),t1=Math.min(end,until);if(t1<t0)continue;
      const known=after&&after.t-frame.t<=80&&after.targets.has(fruit)&&Number.isFinite(frame.motionTime)&&Number.isFinite(after.motionTime),to=known?after.targets.get(fruit):from;
      // Map actual recorded motion clock across the display interval; intersect true [tin,tout].
      const low=fruit.spawnTime+fruit.path.in,high=fruit.spawnTime+fruit.path.out,m0=frame.motionTime,m1=known?after.motionTime:m0;
      if(!Number.isFinite(m0))continue;if(m1>m0&&until>frame.t){t0=Math.max(t0,frame.t+(low-m0)/(m1-m0)*(until-frame.t));t1=Math.min(t1,frame.t+(high-m0)/(m1-m0)*(until-frame.t));}else if(m0<low-1e-8||m0>high+1e-8)continue;if(t1<t0)continue;
      const at=t=>{const f=until>frame.t?clamp((t-frame.t)/(until-frame.t),0,1):0;return {x:lerp(from.x,to.x,f),y:lerp(from.y,to.y,f),r:lerp(from.r,to.r,f)};};
      const p=at(t0),q=at(t1),h=handAt(t0),j=handAt(t1);if(pointSegmentDistance(0,0,h.x-p.x,h.y-p.y,j.x-q.x,j.y-q.y)<=Math.min(p.r,q.r)+bladeRadius){hit=true;break;}
    }if(hit){this.hit(fruit,a,b);if(!this.running||this.paused)break;}}
  }
  update(dt){if(this.theme?.id!=='monster')return super.update(dt);if(!this.running||this.paused||!Number.isFinite(dt)||dt<=0)return;
    const start=this.motionTime;const end=Math.min(start+dt,start+this.remaining);let cursor=start;
    const advance=(to)=>{let delta=to-cursor;if(delta<0)delta=0;for(const f of this.fruits){const oldAge=f.age;f.age+=delta;if(this.strategy==='C'&&f.path.coverageSegments)accrueObserved(this.cellSeconds,f.path.coverageSegments,oldAge,f.age);Object.assign(f,point(f.path,f.age));}this.fruits=this.fruits.filter(f=>f.age<f.path.life-1e-8);cursor=to;this.motionTime=to;};
    while(Math.min(this.nextAt,this.heroAt)<=end+1e-8){const scheduled=Math.min(this.nextAt,this.heroAt);advance(Math.min(scheduled,end));if(cursor>=end-1e-8)break;
      if(this.remaining-(cursor-start)<.65){this.nextAt=this.motionTime+this.remaining+1;this.heroAt=Infinity;break;}
      if(this.heroAt<=this.nextAt){this.heroAt=Infinity;this.spawnNarrowHero();continue;}
      const ok=this.spawnCandidate();if(ok)this.onWave({count:1});this.nextAt=cursor+(ok?this.spacing():.12);}
    advance(end);const saved=this.fruits;const orig=this.updateActiveFlight;this.fruits=[];this.updateActiveFlight=()=>{};
    // Reuse authentic R2 timer and effects, suppress only spawning/movement.
    const prevSpawn=this.spawnIn;this.spawnIn=1e9;super.update(dt);this.spawnIn=prevSpawn;this.updateActiveFlight=orig;if(this.remaining>0&&this.remaining<1e-7&&this.running){this.remaining=0;this.running=false;this.clearHands();this.bombEffect=null;this.themeEffects=[];this.onEnd({score:this.score});}
    this.fruits=this.running?saved:[];if(!this.running){this.heroAt=Infinity;this.nextAt=Infinity;}
    for(const f of this.fruits)f.themeAge=f.age;
  }
}
