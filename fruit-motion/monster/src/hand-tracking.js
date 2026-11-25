// Model-independent hand geometry and causal speed-adaptive smoothing.
// Points stay in unmirrored, video-normalized coordinates. No interpolation
// across missing samples, no extrapolation into the future and no pixel data.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finitePoint = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
  p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 &&
  Number.isFinite(p.confidence) && p.confidence >= 0.45;

function scaleFor(width, height) {
  const shortest = Math.min(width, height);
  return shortest > 0 && Number.isFinite(shortest)
    ? { x: width / shortest, y: height / shortest } : { x: 1, y: 1 };
}

// Norms and plausibility limits must use isotropic pixels rather than treating
// a normalized x increment as the same physical distance as a y increment.
function distance(a, b, scale) {
  return Math.hypot((a.x - b.x) * scale.x, (a.y - b.y) * scale.y);
}

/** Estimate the palm rather than locating the blade on the wrist. Reliable
 * distal points are preferred; a short forearm extension is the bounded
 * fallback when the posture model cannot resolve fingers. A visible wrist
 * is always required. This does not claim to infer precise finger joints. */
export function estimatePalm({ wrist, elbow, index, pinky, shoulder, otherShoulder }, videoWidth = 1, videoHeight = 1) {
  if (!finitePoint(wrist)) return null;
  const scale = scaleFor(videoWidth, videoHeight);
  const forearm = finitePoint(elbow) ? distance(wrist, elbow, scale) : 0;
  const usableArm = forearm >= 0.025 && forearm <= 0.60 && elbow.confidence >= 0.55;
  const shoulderSpan = finitePoint(shoulder) && finitePoint(otherShoulder)
    ? distance(shoulder, otherShoulder, scale) : 0;
  const maxDistal = usableArm ? clamp(forearm * 0.72 + 0.01, 0.04, 0.19)
    : shoulderSpan > 0.025 ? clamp(shoulderSpan * 0.55, 0.045, 0.16) : 0.16;
  const armQuality = usableArm ? clamp((elbow.confidence - 0.55) / 0.20, 0, 1) : 0;
  const armOffset = usableArm ? Math.min(0.045, forearm * 0.24) * armQuality / forearm : 0;
  const fallback = {
    x: wrist.x + (usableArm ? wrist.x - elbow.x : 0) * armOffset,
    y: wrist.y + (usableArm ? wrist.y - elbow.y : 0) * armOffset,
  };

  const candidates = [index, pinky].filter(p => finitePoint(p) && p.confidence >= 0.55 &&
    distance(p, wrist, scale) <= maxDistal);
  // A single coarse Pose finger can be a stray landmark. Require corroborating
  // finger geometry or a reliable forearm before allowing it to refine a palm.
  const concordant = candidates.length === 2 && distance(candidates[0], candidates[1], scale) <= maxDistal;
  let x = fallback.x, y = fallback.y, confidence = wrist.confidence;
  if (concordant || (candidates.length === 1 && usableArm)) {
    // Continuous quality weight: avoid abrupt full-palm -> wrist jumps as
    // a finger approaches its visibility cutoff. One finger has less weight.
    const weights = candidates.map(p => clamp((p.confidence - 0.55) / 0.25, 0, 1));
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum > 1e-6) {
      const mx = candidates.reduce((a, p, i) => a + p.x * weights[i], 0) / sum;
      const my = candidates.reduce((a, p, i) => a + p.y * weights[i], 0) / sum;
      const avgConfidence = candidates.reduce((a, p, i) => a + p.confidence * weights[i], 0) / sum;
      // The second finger adds strength continuously; dropping a weak point
      // cannot abruptly move the palm back to a different spot on the arm.
      const weight = Math.min(1, sum * 0.55);
      x += ((wrist.x + mx) * 0.5 - x) * weight;
      y += ((wrist.y + my) * 0.5 - y) * weight;
      confidence = wrist.confidence + (Math.min(wrist.confidence, avgConfidence) - wrist.confidence) * weight;
    }
  }
  // Do not manufacture an in-frame palm when its inferred position was out of
  // the camera. Retain the observed in-frame wrist in that case.
  return finitePoint({ x, y, confidence }) ? { x, y, confidence } : { ...wrist };
}

function alpha(cutoff, dt) {
  const k = 2 * Math.PI * cutoff * dt;
  return k / (1 + k);
}

/** One-Euro-style causal filter. At rest, low cutoff suppresses noisy points;
 * during a real fast sweep, velocity raises cutoff so lag remains short.
 * Coordinates use shortest-video-side units for equal x/y response. */
export class HandTrackingFilter {
  constructor({ minCutoff = 1.7, beta = 7, derivativeCutoff = 1.2, maxGapMs = 250 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.derivativeCutoff = derivativeCutoff;
    this.maxGapMs = maxGapMs;
    this.reset();
  }

  reset() {
    this.points = { left: null, right: null };
    this.width = 0;
    this.height = 0;
  }

  update(hands, timestamp, width = 1, height = 1) {
    const result = { left: null, right: null };
    if (!Number.isFinite(timestamp) || !(width > 0) || !(height > 0)) {
      this.reset();
      return result;
    }
    if (width !== this.width || height !== this.height) {
      this.reset();
      this.width = width;
      this.height = height;
    }
    const scale = scaleFor(width, height);
    const left = finitePoint(hands?.left) ? hands.left : null;
    const right = finitePoint(hands?.right) ? hands.right : null;
    const previousLeft = this.points.left, previousRight = this.points.right;
    // Detect an abrupt likely left/right identity swap. Do not silently swap
    // anatomy or join trajectories. Crossing naturally through nearby points
    // is allowed, since the test requires both jumps and strong separation.
    if (left && right && previousLeft && previousRight &&
        distance(previousLeft.raw, previousRight.raw, scale) > 0.16 &&
        distance(left, previousLeft.raw, scale) > 0.13 && distance(right, previousRight.raw, scale) > 0.13 &&
        distance(left, previousRight.raw, scale) + distance(right, previousLeft.raw, scale) + 0.18 <
          distance(left, previousLeft.raw, scale) + distance(right, previousRight.raw, scale)) {
      this.points = { left: null, right: null };
      return result;
    }
    for (const [id, raw] of [['left', left], ['right', right]]) {
      const old = this.points[id];
      if (!raw) { this.points[id] = null; continue; }
      const gap = old ? timestamp - old.timestamp : Infinity;
      if (old && (!(gap > 0) || gap > this.maxGapMs)) {
        // An explicit missing point breaks consumers' stroke state. The next
        // real observation can start a new trace; no stale filter survives.
        this.points[id] = null;
        continue;
      }
      if (!old) {
        result[id] = { ...raw };
        this.points[id] = { raw, filtered: result[id], dx: 0, dy: 0, timestamp };
        continue;
      }
      const dt = gap / 1000;
      const movement = distance(raw, old.raw, scale);
      if (movement > Math.max(0.19, 4.5 * dt)) {
        this.points[id] = null;
        continue;
      }
      const ad = alpha(this.derivativeCutoff, dt);
      const dx = old.dx + ad * ((raw.x - old.raw.x) * scale.x / dt - old.dx);
      const dy = old.dy + ad * ((raw.y - old.raw.y) * scale.y / dt - old.dy);
      const a = alpha(this.minCutoff + this.beta * Math.hypot(dx, dy), dt);
      result[id] = {
        x: old.filtered.x + a * (raw.x - old.filtered.x),
        y: old.filtered.y + a * (raw.y - old.filtered.y),
        confidence: raw.confidence,
      };
      this.points[id] = { raw, filtered: result[id], dx, dy, timestamp };
    }
    return result;
  }
}
