import {FruitGame} from './game.js?v=2.2-w9';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)); const lerp=(a,b,t)=>a+(b-a)*t;
export const seeded=(seed)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296};
export function safeRect(game,r=game.targetRadius){const a=game.playArea,pad=r+2;return {l:Math.max(a.left+pad,game.reachZone?game.width*game.reachZone.minX:-Infinity),r:Math.min(a.right-pad,game.reachZone?game.width*game.reachZone.maxX:Infinity),t:Math.max(a.top+pad,game.reachZone?.minY!=null?game.height*game.reachZone.minY:-Infinity),b:Math.min(a.bottom-pad,game.reachZone?.maxY!=null?game.height*game.reachZone.maxY:Infinity)}}
const valid=b=>b.r-b.l>1&&b.b-b.t>1;
const zone=(x,y,b)=>clamp(Math.floor(3*(x-b.l)/(b.r-b.l)),0,2)+3*clamp(Math.floor(3*(y-b.t)/(b.b-b.t)),0,2);
// Natural continuous elliptical arc: base x/y linear velocity + a bounded transverse bow.
// Path lies in convex control polygon (quadratic Bezier). Position and derivatives share the same clock.
export function point(p,t){const u=clamp(t/p.life,0,1),v=1-u;return{x:v*v*p.x0+2*u*v*p.cx+u*u*p.x1,y:v*v*p.y0+2*u*v*p.cy+u*u*p.y1,vx:2*(v*(p.cx-p.x0)+u*(p.x1-p.cx))/p.life,vy:2*(v*(p.cy-p.y0)+u*(p.y1-p.cy))/p.life};}
function canPlace(game,p){for(const o of game.fruits){const deadline=Math.min(p.life,o.path.life-o.age),min=(p.radius+o.r)*1.08+3;if(deadline<=0)continue;
// Conservative Lipschitz padding: requirement at checked endpoints plus worst-case movement to midpoint.
const maxSpeed=Math.max(Math.hypot(...[p.cx-p.x0,p.cy-p.y0]),Math.hypot(...[p.x1-p.cx,p.y1-p.cy]))*2/p.life+Math.max(Math.hypot(...[o.path.cx-o.path.x0,o.path.cy-o.path.y0]),Math.hypot(...[o.path.x1-o.path.cx,o.path.y1-o.path.cy]))*2/o.path.life;
const dt=.02,n=Math.ceil(deadline/dt);for(let i=0;i<=n;i++){let tau=deadline*i/n,a=point(p,tau),b=point(o.path,o.age+tau);if(Math.hypot(a.x-b.x,a.y-b.y)<min+maxSpeed*dt/2)return false;}}return true;}
function shuf(a,rng){for(let i=a.length-1;i>0;i--){let j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export class CandidateGame extends FruitGame {
  constructor(opts){super(opts);this.strategy=opts.strategy;this.motionRng=seeded(opts.seed);this.heroRng=seeded((opts.seed??1)^0x6b27f911);this.heroLog=[];this.heroTierBag=[];this.heroAt=Infinity;this.dispatch=[];this.recent=[];this.bag=[];this.tierBag=[];this.centerSeconds=0;this.totalSeconds=0;this.motionTime=0;this.nextAt=0;}
  start(opts){if(opts.theme?.id!=='monster')return super.start(opts);this.motionTime=0;this.roundDuration=opts.duration;this.nextAt=0;this.bag=[];this.recent=[];this.tierBag=[];this.centerSeconds=0;this.totalSeconds=0;this.heroAt=Infinity;this.heroLog=[];this.heroTierBag=[];this.candidateThemePending=true;super.start(opts);this.candidateThemePending=false;this.nextAt=this.active?this.spacing():.16;}
  get narrowActive(){return this.active&&!!this.reachZone&&this.reachZone.maxX-this.reachZone.minX<.30;}
  spacing(){if(this.active&&this.reachZone&&this.reachZone.maxX-this.reachZone.minX<.30)return lerp(1.88,2.48,this.motionRng());return this.active?lerp(.88,1.53,this.motionRng()):lerp(1.08,1.69,this.motionRng());}
  spawnActiveWave(){if(this.theme?.id!=='monster')return super.spawnActiveWave();if(this.candidateThemePending){const ok=this.spawnCandidate();if(ok)this.onWave({count:1});return ok;}if(this.motionTime!=null)return this.spawnCandidate();return false;}
  resize(){const oldw=this.width,oldh=this.height;super.resize();if(this.theme?.id==='monster'&&this.running&&(oldw!==this.width||oldh!==this.height)){this.fruits=[];this.nextAt=this.motionTime;this.heroAt=Infinity;}}
  setCameraBounds(rect){const changed=super.setCameraBounds(rect);if(changed&&this.theme?.id==='monster'&&this.running){this.fruits=[];this.nextAt=this.motionTime;this.heroAt=Infinity;}return changed;}
  mkPath(bounds,r,cell=null,tier=0,opts={}){let rng=opts.rng??this.motionRng;let sx=cell==null?rng():(cell%3+rng())/3,sy=cell==null?rng():(Math.floor(cell/3)+rng())/3;let x0=lerp(bounds.l,bounds.r,sx),y0=lerp(bounds.t,bounds.b,sy);
  const norm=Math.min(this.playArea.width,this.playArea.height);
  // Choose actual speed tier independently of rejection. Fast tracks are shorter in time
  // but still well beyond the required reaction window. No boundary truncation.
  const narrow=this.reachZone&&this.reachZone.maxX-this.reachZone.minX<.30;
  const targetSpeed=norm*(tier===0?lerp(.12,.26,rng()):tier===1?lerp(.33,.53,rng()):narrow?lerp(.625,.66,rng()):lerp(.63,.83,rng()));
  const life=opts.lifeBounds?lerp(...opts.lifeBounds,rng()):tier===2?(narrow?lerp(1.0,1.07,rng()):lerp(1.02,1.39,rng())):lerp(1.16,2.24,rng());
  let ang=rng()*Math.PI*2,dx=Math.cos(ang),dy=Math.sin(ang),length=targetSpeed*life;
  function available(dx,dy){return Math.min(dx>0?(bounds.r-x0)/dx:dx<0?(bounds.l-x0)/dx:Infinity,dy>0?(bounds.b-y0)/dy:dy<0?(bounds.t-y0)/dy:Infinity)}
  // Major-axis choices make fast paths physically feasible, especially in narrow calibrated lanes.
  if(tier===2&&narrow){
    // Geometry is objectively narrow; use a safe high-to-low or low-to-high
    // long axis path, with lateral variation still sampled across the reach zone.
    const down=cell==null?rng()<.5:Math.floor(cell/3)===0?true:Math.floor(cell/3)===2?false:rng()<.5;
    if(bounds.b-bounds.t<length)return null;
    y0=down?lerp(bounds.t,bounds.b-length,rng()):lerp(bounds.t+length,bounds.b,rng());
    dx=0;dy=down?1:-1;
  }else if(tier===2&&rng()<.65){ang=(bounds.r-bounds.l>bounds.b-bounds.t?0:Math.PI/2)+(rng()<.5?0:Math.PI)+lerp(-.24,.24,rng());dx=Math.cos(ang);dy=Math.sin(ang);}
  if(available(-dx,-dy)>available(dx,dy)&&available(dx,dy)<length){dx=-dx;dy=-dy;}
  if(available(dx,dy)<length)return null;
  let x1=x0+dx*length,y1=y0+dy*length;
  const bend=length*lerp(-.22,.22,rng());let cx=clamp((x0+x1)/2-dy*bend,bounds.l,bounds.r),cy=clamp((y0+y1)/2+dx*bend,bounds.t,bounds.b);
  const maxD=2*Math.max(Math.hypot(cx-x0,cy-y0),Math.hypot(x1-cx,y1-cy))/life;if(maxD>1.5*norm)return null;
  const p={x0,y0,x1,y1,cx,cy,life,radius:r,cell:zone(x0,y0,bounds)};
  // Confirm actual arc length and predict center residency using the same full camera playArea, not re-scaled bounds.
  const area=this.playArea,full={l:area.left,r:area.right,t:area.top,b:area.bottom};let arc=0,center=0,last=point(p,0);const N=40;
  for(let i=1;i<=N;i++){const t=i*life/N,q=point(p,t);arc+=Math.hypot(q.x-last.x,q.y-last.y);let mid=point(p,t-life/N/2);if(zone(mid.x,mid.y,full)===4)center+=life/N;last=q;}
  let speed=arc/(life*norm);if(tier===0?speed>=.3:tier===1?(speed<.3||speed>.6):speed<=.6)return null;
  p.center=center;p.speed=speed;p.tier=tier;return p;}
  spawnCandidate(){const begin=performance.now();let count=0;try{
    if(this.fruits.length>=this.maxObjects)return false;
    const canBomb=!this.narrowActive&&this.motionTime>=this.mode.bombGrace&&this.motionTime-this.lastBombAge>=4.5&&this.fruits.some(f=>!this.isObstacle(f.type)&&f.path.life-f.age>.35)&&!this.fruits.some(f=>this.isObstacle(f.type));
    const roleRand=this.motionRng();const bomb=canBomb&&(this.motionTime-this.lastBombAge>=13||roleRand<this.mode.bombRate),r=this.targetRadius*(bomb?.83:1),bounds=safeRect(this,this.targetRadius);if(!valid(bounds))return false;
    const rng=this.motionRng;
    if(this.motionTime>this.roundDuration-.70)return false;
    if(!this.tierBag.length)this.tierBag=shuf([0,0,0,1,1,1,1,2,2,2],rng);
    const tier=this.tierBag[0];
    const narrow=this.reachZone&&this.reachZone.maxX-this.reachZone.minX<.30;
    if(this.strategy==='B'&&!this.bag.length)this.bag=shuf([0,1,2,3,4,5,6,7,8],rng);
    const candidates=[];const limit=this.strategy==='C'?48:56;const countRecent=Array(9).fill(0);for(const h of this.recent)if(h.t>this.motionTime-30)countRecent[h.cell]++;
    for(let i=0;i<limit;i++){count++;let wanted=this.strategy==='B'&&i<2*this.bag.length?this.bag[i%this.bag.length]:this.strategy==='C'&&i%2===0?Math.floor(rng()*9):null;
      const p=this.mkPath(bounds,r,wanted,tier);if(!p)continue;
      // Center budget applies to normal full camera, not the narrowed reachable rectangle.
      if(!narrow&&(this.centerSeconds+p.center)>.215*(this.totalSeconds+p.life)+.15)continue;
      if(!canPlace(this,p))continue;
      if(this.strategy!=='C'){candidates.push(p);break;}
      // Reward underserved cells softly; randomised weighting prevents deterministic order.
      const weight=(1/(1+countRecent[p.cell]))*(.7+.6*rng())*(1.1-.6*p.center/p.life);candidates.push({...p,weight});}
    if(!candidates.length)return false;let p=candidates[0];if(this.strategy==='C'){let roll=rng()*candidates.reduce((s,p)=>s+p.weight,0);for(const c of candidates){roll-=c.weight;if(roll<=0){p=c;break;}}}
    if(this.strategy==='B'){const index=this.bag.indexOf(p.cell);if(index>=0)this.bag.splice(index,1);}
    this.tierBag.shift();this.centerSeconds+=p.center;this.totalSeconds+=p.life;this.recent.push({cell:p.cell,t:this.motionTime});this.recent=this.recent.filter(h=>h.t>this.motionTime-30);
    this.spawnSeq++;if(bomb)this.lastBombAge=this.motionTime;const q=point(p,0),f={...q,path:p,age:0,r,g:0,id:this.nextId++,type:bomb?this.nextObstacleType():this.nextActiveType(),rot:0,vr:0,spawnTime:this.motionTime};this.fruits.push(f);if(this.narrowActive&&!bomb)this.heroAt=this.motionTime+.15;this.emitRole(f,'appear');return true;
  }finally{this.dispatch.push({ms:performance.now()-begin,attempts:count});}}
  spawnNarrowHero(){
    const begin=performance.now();let attempts=0;const t=this.motionTime;
    const state={time:t,positiveCount:this.fruits.filter(f=>!this.isObstacle(f.type)).length,heroCount:this.fruits.filter(f=>this.isObstacle(f.type)).length,elapsedSinceHero:t-this.lastBombAge,attempts:0,status:'skip'};
    const finish=(reason)=>{state.reason=reason;state.attempts=attempts;this.heroLog.push(state);return false;};
    try{
      if(!this.narrowActive)return finish('not-narrow-active');
      if(t>this.roundDuration-.70)return finish('end');
      if(this.fruits.length>=this.maxObjects||state.heroCount>0)return finish('capacity');
      if(t<this.mode.bombGrace)return finish('grace');
      if(t-this.lastBombAge<4.5)return finish('cooldown');
      const area=this.playArea,bounds=safeRect(this,this.targetRadius),rng=this.heroRng;
      const positive=this.fruits.find(f=>!this.isObstacle(f.type)&&f.path.life-f.age>.35&&f.x-f.r>=area.left&&f.x+f.r<=area.right&&f.y-f.r>=area.top&&f.y+f.r<=area.bottom&&f.x>=bounds.l&&f.x<=bounds.r&&f.y>=bounds.t&&f.y<=bounds.b);
      if(!positive)return finish('no-fully-visible-positive');
      state.positiveId=positive.id;state.positiveRemaining=positive.path.life-positive.age;
      if(t-this.lastBombAge<13&&rng()>=this.mode.bombRate)return finish('rate');
      const maxLife=Math.min(positive.path.life-positive.age-.03,this.nextAt-t-.03,1.6,this.roundDuration-t);
      if(maxLife<.72)return finish('insufficient-safe-lifetime');
      if(!this.heroTierBag.length)this.heroTierBag=shuf([0,0,0,1,1,1,1,2,2,2],rng);
      const tier=this.heroTierBag[0],radius=this.targetRadius*.83;
      for(let i=0;i<72;i++){attempts++;const p=this.mkPath(bounds,radius,null,tier,{rng,lifeBounds:[.72,maxLife]});
        if(!p||!canPlace(this,p))continue;
        const q=point(p,0),f={...q,path:p,age:0,r:radius,g:0,id:this.nextId++,type:this.nextObstacleType(),rot:0,vr:0,spawnTime:t};
        this.heroTierBag.shift();this.lastBombAge=t;this.fruits.push(f);this.emitRole(f,'appear');state.status='success';state.reason='safe-path';state.heroId=f.id;state.life=p.life;state.speed=p.speed;state.attempts=attempts;state.path=p;state.positivePath=positive.path;state.positiveAge=positive.age;this.heroLog.push(state);return true;
      }
      return finish('no-safe-trajectory');
    }finally{this.dispatch.push({ms:performance.now()-begin,attempts});}
  }
  update(dt){if(this.theme?.id!=='monster')return super.update(dt);if(!this.running||this.paused||!Number.isFinite(dt)||dt<=0)return;
    const start=this.motionTime;const end=Math.min(start+dt,start+this.remaining);let cursor=start;
    const advance=(to)=>{let delta=to-cursor;if(delta<0)delta=0;for(const f of this.fruits){f.age+=delta;Object.assign(f,point(f.path,f.age));}this.fruits=this.fruits.filter(f=>f.age<f.path.life-1e-8);cursor=to;this.motionTime=to;};
    while(Math.min(this.nextAt,this.heroAt)<=end+1e-8){const scheduled=Math.min(this.nextAt,this.heroAt);advance(Math.min(scheduled,end));if(cursor>=end-1e-8)break;
      if(this.remaining-(cursor-start)<.70){this.nextAt=this.motionTime+this.remaining+1;this.heroAt=Infinity;break;}
      if(this.heroAt<=this.nextAt){this.heroAt=Infinity;this.spawnNarrowHero();continue;}
      const ok=this.spawnCandidate();if(ok)this.onWave({count:1});this.nextAt=cursor+(ok?this.spacing():.12);}
    advance(end);const saved=this.fruits;const orig=this.updateActiveFlight;this.fruits=[];this.updateActiveFlight=()=>{};
    // Reuse authentic R2 timer and effects, suppress only spawning/movement.
    const prevSpawn=this.spawnIn;this.spawnIn=1e9;super.update(dt);this.spawnIn=prevSpawn;this.updateActiveFlight=orig;if(this.remaining>0&&this.remaining<1e-7&&this.running){this.remaining=0;this.running=false;this.clearHands();this.bombEffect=null;this.themeEffects=[];this.onEnd({score:this.score});}
    this.fruits=this.running?saved:[];
    for(const f of this.fruits)f.themeAge=f.age;
  }
}
