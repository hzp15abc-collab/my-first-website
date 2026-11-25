/** Prepare-page-only, single-model two-hand confirmation (V1.6 C3).
 * No camera acquisition, model inference, input smoothing, or gameplay here.
 * See docs/benchmarks/v1.6/gesture/ for the selected and rejected experiments.
 */
import { mapCameraPoint } from './camera-layout.js';

export const HOLD_MS = 650;
export const MAX_GAP_MS = 250;
export const MAX_AGE_MS = 250;
export const MIN_SAMPLES = 4;
const MAX_WEAK_MS = 125;
const MIN_STRONG_RATIO = .80;
const SIDES = ['left', 'right'];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const center = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const validDimension = n => Number.isFinite(n) && n > 0;
const confidence = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function copyPoint(x, y, score) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y, confidence: confidence(score) };
}

/** Read the same already-completed pose and return detached normalized values.
 * Only these 2D joints are copied; the raw model object, image, world pose,
 * and model state are never exposed or stored. This does not estimate a palm.
 */
export function extractStartPose(result, source, width, height) {
  if (!validDimension(width) || !validDimension(height)) return null;
  let get;
  if (source === 'mediapipe') {
    const landmarks = result?.landmarks?.[0];
    if (!landmarks?.length) return null;
    get = (_, mpIndex) => {
      const value = landmarks[mpIndex];
      if (!value) return null;
      // Some SDK versions omit presence; never invent a readiness confidence
      // if neither visibility nor presence was actually provided.
      const scores = [value.visibility, value.presence].filter(Number.isFinite);
      return copyPoint(value.x, value.y, scores.length ? Math.min(...scores) : 0);
    };
  } else if (source === 'movenet') {
    const keypoints = result?.[0]?.keypoints;
    if (!keypoints?.length) return null;
    get = (name, _, mvIndex) => {
      const value = keypoints.find(p => p?.name === name) ?? keypoints[mvIndex];
      return !value || (value.name && value.name !== name) ? null : copyPoint(value.x / width, value.y / height, value.score);
    };
  } else return null;
  function side(name, n) {
    return {
      shoulder: get(`${name}_shoulder`, 11 + n, 5 + n),
      elbow: get(`${name}_elbow`, 13 + n, 7 + n),
      wrist: get(`${name}_wrist`, 15 + n, 9 + n),
    };
  }
  return { source, width, height, nose: get('nose', 0, 0), left: side('left', 0), right: side('right', 1) };
}

function mapped(point, geometry, minScore) {
  if (!point || confidence(point.confidence) < minScore) return null;
  // The original mirrored cover mapper is authoritative; do not clamp a
  // cropped raw joint or filtered palm to the nearest display edge.
  return mapCameraPoint(point, geometry);
}

function layoutKey(geometry, pose) {
  if (!geometry?.visible) return '';
  const v = geometry.visible;
  return [pose?.source ?? 'hands-only', geometry.sourceWidth, geometry.sourceHeight, geometry.scale,
    geometry.left, geometry.top, geometry.width, geometry.height, v.left, v.top, v.right, v.bottom].join(':');
}

function invalid(reason, raised = { left: false, right: false }) {
  return {ok:false, raised, reason, anchor:null};
}

/** Evaluate the selected C3 guard on one actual observation. This is only a
 * conservative same-body plausibility check, not a multi-person identity
 * recognizer: the frozen SinglePose detectors have no reliable player IDs.
 */
export function evaluateStartPose({pose, hands, geometry}) {
  const v = geometry?.visible;
  if (!v || v.width < 120 || v.height < 120) return invalid('geometry');
  if (!pose || pose.width !== geometry.sourceWidth || pose.height !== geometry.sourceHeight) return invalid('pose');

  // .45 is the unchanged original palm threshold. Additional MoveNet body
  // metadata is noisier even when the old hands are valid; its readiness-only
  // floor .35 is independently validated. These values never feed the old
  // hand estimator/filter/collision path.
  const mvBody = pose.source === 'movenet';
  const bodyFloor = mvBody ? .35 : .50;
  const arms = {}, raised = {};
  for (const side of SIDES) {
    arms[side] = {
      shoulder: mapped(pose[side]?.shoulder, geometry, bodyFloor),
      elbow: mapped(pose[side]?.elbow, geometry, bodyFloor),
      wrist: mapped(pose[side]?.wrist, geometry, .45),
      palm: mapped(hands?.[side], geometry, .45),
    };
  }
  const L=arms.left, R=arms.right;
  if (!L.shoulder || !R.shoulder) return invalid('shoulders');
  const span=dist(L.shoulder,R.shoulder);
  if (!Number.isFinite(span) || span < Math.max(10, 14 * geometry.scale)) return invalid('scale');
  for (const side of SIDES) {
    const {shoulder,wrist,palm}=arms[side];
    raised[side]=Boolean(wrist&&palm&&wrist.y<=shoulder.y-.12*span&&palm.y<=shoulder.y-.12*span);
  }
  if (!raised.left || !raised.right) return invalid('raise-both', raised);
  if (!L.elbow || !R.elbow) return invalid('elbows', raised);

  const nose=mapped(pose.nose,geometry,mvBody ? .35 : .45);
  const middle=center(L.shoulder,R.shoulder);
  const orientation=Math.sign(L.shoulder.x-R.shoulder.x);
  if (!orientation || Math.abs(L.shoulder.y-R.shoulder.y)>.65*span || !nose ||
      Math.abs(nose.x-middle.x)>.95*span || nose.y>middle.y+.12*span || nose.y<middle.y-1.8*span) {
    return invalid('body-anchor', raised);
  }
  const lengths=[];
  for (const side of SIDES) {
    const {shoulder,elbow,wrist,palm}=arms[side];
    const upper=dist(shoulder,elbow)/span, fore=dist(elbow,wrist)/span;
    if (upper<.12 || upper>1.65 || fore<.10 || fore>1.65 || dist(wrist,shoulder)>2.55*span || dist(palm,wrist)>.88*span) {
      return invalid('arm-shape', raised);
    }
    lengths.push(upper,fore);
    if (Math.abs(wrist.x-middle.x)>2.35*span || Math.abs(palm.x-middle.x)>2.55*span) return invalid('body-reach', raised);
  }
  if (dist(L.wrist,R.wrist)<.23*span || dist(L.palm,R.palm)<.23*span ||
      orientation*(L.wrist.x-middle.x)<-.28*span || -orientation*(R.wrist.x-middle.x)<-.28*span) {
    return invalid('distinct-hands', raised);
  }
  for(let j=0;j<2;j++) if(Math.max(lengths[j],lengths[j+2])>1.8*Math.min(lengths[j],lengths[j+2])) return invalid('arm-proportion', raised);

  const strong=SIDES.every(side=>arms[side].wrist.confidence>=.55&&arms[side].palm.confidence>=.55);
  return {ok:true,raised,reason:strong?'valid':'weak',anchor:{middle,span,orientation},strong};
}

function coherent(anchor, origin, previous) {
  if (!origin || !previous || !anchor) return true;
  function near(a,b,move,scale) {
    return a.orientation===b.orientation&&dist(a.middle,b.middle)<=move*Math.max(a.span,b.span)&&
      Math.max(a.span,b.span)<=scale*Math.min(a.span,b.span);
  }
  return near(anchor,previous,.36,1.28)&&near(anchor,origin,.70,1.48);
}

/** One latch per prepared camera session. Only update() with real, accepted
 * fresh inference-start timestamps accumulates progress. status() is safe in
 * the renderer: staleness may invalidate, but RAF alone can never confirm.
 */
export class StartGestureGate {
  constructor() {
    // No sample admitted before an explicit prepared-page entry.
    this.begin(Infinity);
  }
  begin(now = performance.now()) {
    this.fired=false;
    this.lastTimestamp=-Infinity;
    this.notBefore=Number.isFinite(now)?now:Infinity;
    this._clear();
  }
  _clear(reason='waiting', raised={left:false,right:false}) {
    this.first=null;this.last=null;this.received=null;this.count=0;
    this.origin=null;this.previous=null;this.layout='';this.reason=reason;this.raised=raised;
    this.strongCount=0;this.strongElapsed=0;this.previousStrong=false;this.weakSince=null;
  }
  // Reset evidence, not the once-per-preparation latch. Only begin() rearms.
  invalidate(now = performance.now()) {
    this.notBefore=Math.max(this.notBefore,Number.isFinite(now)?now:-Infinity);
    this._clear();
  }
  _snapshot(triggered=false) {
    return {state:this.fired?'confirmed':this.first!==null?'holding':'idle',
      progress:this.fired?1:Math.min(.95,this.strongElapsed/HOLD_MS),triggered,
      raised:{...this.raised},reason:this.reason,samples:this.count};
  }
  status(now = performance.now()) {
    if(!this.fired && this.received!==null && (!Number.isFinite(now)||now-this.received>MAX_GAP_MS)) this._clear('stale-gap');
    return this._snapshot();
  }
  update(sample) {
    const {active,timestamp,now,geometry,pose}=sample;
    if(this.fired)return this._snapshot();
    if(active!==true){this.invalidate(now);return this._snapshot();}
    if(!Number.isFinite(timestamp)||!Number.isFinite(now)||timestamp<this.notBefore||timestamp<=this.lastTimestamp||timestamp>now+1||now-timestamp>MAX_AGE_MS){
      this._clear('stale-sample');return this._snapshot();
    }
    this.lastTimestamp=timestamp;
    const result=evaluateStartPose(sample);
    if(!result.ok){this._clear(result.reason,result.raised);return this._snapshot();}
    const key=layoutKey(geometry,pose);
    if(this.last!==null&&(timestamp-this.last>MAX_GAP_MS||now-this.received>MAX_GAP_MS||this.layout!==key||!coherent(result.anchor,this.origin,this.previous))) this._clear('new-sequence');

    // A weak but still visible bilateral observation does NOT advance time.
    // It cannot seed a hold, persist >125ms, or bridge a hard missing/low hand
    // or geometry reset. Only adjacent fresh strong samples add duration.
    if(this.weakSince!==null&&timestamp-this.weakSince>MAX_WEAK_MS)this._clear('weak-gap');
    if(!result.strong&&this.first===null){this._clear('weak',result.raised);return this._snapshot();}
    if(result.strong){
      this.strongCount++;
      if(this.previousStrong&&this.last!==null)this.strongElapsed+=timestamp-this.last;
      this.weakSince=null;
    } else if(this.weakSince===null)this.weakSince=timestamp;
    this.previousStrong=result.strong;
    if(this.first===null){this.first=timestamp;this.origin=result.anchor;this.layout=key;}
    this.last=timestamp;this.received=now;this.count++;this.previous=result.anchor;this.raised=result.raised;this.reason=result.strong?'holding':'weak';
    if(result.strong&&this.strongElapsed>=HOLD_MS&&this.strongCount>=MIN_SAMPLES&&this.strongCount/this.count>=MIN_STRONG_RATIO){
      this.fired=true;this.reason='confirmed';return this._snapshot(true);
    }
    return this._snapshot();
  }
}
