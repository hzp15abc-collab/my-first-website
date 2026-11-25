/** Original A-R1 forest validation game. No camera/model handling or persistence here. */
export const ACTIONS = Object.freeze([
  {id:'left_step',icon:'←',label:'向左小步',hint:'自然向左小步，再回到中间站稳。'},
  {id:'right_step',icon:'→',label:'向右小步',hint:'自然向右小步，再回到中间站稳。'},
  {id:'squat',icon:'↓',label:'轻轻下蹲',hint:'轻轻弯膝就好，不用蹲得很低。'},
  {id:'arms_up',icon:'↑',label:'双手举高',hint:'举起双手，舒服就好。'},
  {id:'reach_left',icon:'↖',label:'左手伸展',hint:'向画面左侧轻轻伸手。'},
  {id:'reach_right',icon:'↗',label:'右手伸展',hint:'向画面右侧轻轻伸手。'},
]);
const byId = Object.fromEntries(ACTIONS.map(a=>[a.id,a]));
export const DURATION = 72000;
export const WARNING = 3400;
export const MAX_GAP = 500;
export const TUTORIAL_FEEDBACK = 700;
export const COURSE = Object.freeze([
  [5000,'left_step'],[10000,'arms_up'],[15000,'squat'],[20000,'right_step'],
  [28000,'reach_left'],[33000,'squat'],[38000,'right_step'],[43000,'reach_right'],
  [51000,'left_step'],[56000,'arms_up'],[61000,'reach_left'],[66000,'reach_right'],
].map(([at,action],id)=>Object.freeze({id,at,action})));
export const STAGES = ['阳光森林','蘑菇小径','星星山谷'];
const clampLane=n=>Math.max(-1,Math.min(1,n));
const kindFor=action=>action==='squat'?'bar':action==='arms_up'?'star':action==='reach_left'?'left_star':action==='reach_right'?'right_star':'block';

export class RailGame {
  constructor(){ this.reset(); }
  reset(){
    this.mode=null; this.phase='home'; this.ready=false; this.hold=''; this.elapsedMs=0; this.tutorialIndex=0; this.tutorialRemaining=0;
    this.lane=0; this.pose='neutral'; this.poseRemaining=0; this.points=0; this.resolved=[]; this.nextIndex=0; this.active=null;
    this.feedback=''; this.feedbackRemaining=0; this.events=[];
  }
  start(mode){
    if(!['camera','touch'].includes(mode)) return false;
    this.reset(); this.mode=mode; this.phase='tutorial'; this.ready=mode==='touch'; this.events.push({type:'start'}); return true;
  }
  setReady(value){this.ready=this.mode==='touch'||Boolean(value);if(!this.ready){this.pose='neutral';this.poseRemaining=0;}}
  canAdvance(){return (this.phase==='tutorial'||this.phase==='running')&&this.ready&&!this.hold;}
  pause(reason='manual') { if(this.phase!=='tutorial'&&this.phase!=='running') return false; this.hold=reason; this.pose='neutral'; this.poseRemaining=0;return true; }
  resume(){if(this.phase!=='tutorial'&&this.phase!=='running')return false;this.hold='';return true;}
  exit(){this.reset();}
  drain(){return this.events.splice(0);}
  get tutorialAction(){return ACTIONS[this.tutorialIndex]||null;}
  _beginRunning(){this.phase='running';this.lane=0;this.pose='neutral';this.poseRemaining=0;this.elapsedMs=0;this.feedback='出发啦！看清提示，慢慢做。';this.feedbackRemaining=1800;this.events.push({type:'depart'});}
  _setPose(action){this.pose=action;this.poseRemaining=950;}
  _flash(str,ms=1800){this.feedback=str;this.feedbackRemaining=ms;}
  action(action){
    if(!byId[action]||!this.canAdvance())return false;
    if(this.phase==='tutorial'){
      if(this.tutorialRemaining||action!==this.tutorialAction?.id)return false;
      this._setPose(action);
      if(action==='left_step'||action==='right_step')this.lane=clampLane(this.lane+(action==='left_step'?-1:1));
      this.tutorialRemaining=TUTORIAL_FEEDBACK;this._flash('做得好！',TUTORIAL_FEEDBACK);this.events.push({type:'success',tutorial:true,action});return true;
    }
    this._setPose(action);
    if(action==='left_step'||action==='right_step'){
      this.lane=clampLane(this.lane+(action==='left_step'?-1:1));this.events.push({type:'step',action});
    }
    const a=this.active;
    if(a&&a.action===action&&!a.performed){
      a.performed=true;this._flash('动作收到！');
    }
    return true;
  }
  _activate(e){const block=kindFor(e.action)==='block';let action=e.action;
    if(block&&((this.lane===-1&&action==='left_step')||(this.lane===1&&action==='right_step')))action=action==='left_step'?'right_step':'left_step';
    const safeLane=block?clampLane(this.lane+(action==='left_step'?-1:1)):null;
    this.active={...e,action,kind:kindFor(action),safeLane,lane:this.lane,performed:false};
    this.events.push({type:'cue',action});
  }
  _resolve(){const a=this.active;if(!a)return;
    const success=a.kind==='block'?a.performed&&this.lane===a.safeLane:a.performed;
    if(success){this.points++;this._flash('⭐ 太棒了！');this.events.push({type:'success',action:a.action,id:a.id});}
    else{this._flash('没关系，我们继续！');this.events.push({type:'miss',action:a.action,id:a.id});}
    this.resolved.push({id:a.id,action:a.action,success});this.active=null;this.nextIndex++;
  }
  tick(delta){
    if(!Number.isFinite(delta)||delta<0||!this.canAdvance())return 0;
    if(delta>MAX_GAP){this.pause('slow');return 0;}
    const dt=Math.min(delta,100);if(dt===0)return 0;
    if(this.poseRemaining>0){this.poseRemaining=Math.max(0,this.poseRemaining-dt);if(!this.poseRemaining)this.pose='neutral';}
    if(this.feedbackRemaining>0){this.feedbackRemaining=Math.max(0,this.feedbackRemaining-dt);if(!this.feedbackRemaining)this.feedback='';}
    if(this.phase==='tutorial'){
      if(this.tutorialRemaining){this.tutorialRemaining=Math.max(0,this.tutorialRemaining-dt);if(!this.tutorialRemaining){this.pose="neutral";this.poseRemaining=0;this.tutorialIndex++;if(this.tutorialIndex>=ACTIONS.length)this._beginRunning();}}
      return dt;
    }
    this.elapsedMs=Math.min(DURATION,this.elapsedMs+dt);
    if(!this.active&&COURSE[this.nextIndex]&&this.elapsedMs>=COURSE[this.nextIndex].at-WARNING)this._activate(COURSE[this.nextIndex]);
    if(this.active&&this.elapsedMs>=this.active.at)this._resolve();
    if(this.elapsedMs>=DURATION){this.phase='finished';this.pose='neutral';this.feedback='探险完成！';this.events.push({type:'finish',points:this.points});}
    return dt;
  }
  get stage(){return Math.min(3,Math.floor(this.elapsedMs/24000)+1);}
  get prompt(){
    if(this.phase==='tutorial')return this.tutorialRemaining?{icon:'✓',label:'做得好！',hint:'保持舒服，准备下一个动作。'}:this.tutorialAction;
    if(this.phase==='running'&&this.active){const a=this.active; const p=byId[a.action];
      if(a.kind==='block'&&a.safeLane===this.lane)return{icon:'✓',label:a.safeLane<0?'保持左道':a.safeLane>0?'保持右道':'保持中道',hint:'安全路线，等待通过。'};
      if(a.kind!=='block'&&a.performed)return{icon:'✓',label:'动作收到！',hint:'回到自然姿势，等待通过。'};
      return p;
    }
    return{icon:'✦',label:'森林探险',hint:'放松站好，留意下一个提示。'};
  }
  sceneState(){
    const a=this.active;let objects=[];
    if(a){const distance=Math.max(0,(a.at-this.elapsedMs)/WARNING*50);
      if(a.kind==='block')objects=[-1,0,1].filter(l=>l!==a.safeLane).map(l=>({kind:'block',lane:l,distance,active:true}));
      else if(a.kind==='bar')objects=[{kind:'bar',lane:this.lane,distance,active:true}];
      else if(!a.performed)objects=[{kind:a.kind,lane:this.lane,distance,active:true}];
    }
    const demo=this.phase==='tutorial'&&!this.hold&&!this.poseRemaining&&!this.tutorialRemaining&&this.ready;
    return {elapsedMs:this.elapsedMs,lane:this.lane,pose:demo?(this.tutorialAction?.id||'neutral'):this.pose,objects,activeLane:a?.safeLane??undefined,stage:this.stage,feedback:this.feedback,tutorialDemo:demo};
  }
}
