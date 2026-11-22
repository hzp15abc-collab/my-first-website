/**
 * Offline MoveNet SinglePose Lightning fallback. All assets are local
 * TF.js browser builds from official Apache-2.0 releases.
 */
import { estimatePalm } from "./hand-tracking.js";
// V16_READINESS_BEGIN
import { extractStartPose } from "./start-gesture.js";
// V16_READINESS_END

const BASE = new URL("../assets/movenet/", import.meta.url).href;
const MODEL = new URL("model/model.json", BASE).href;
const HAND_CONFIDENCE = 0.45;
const scripts = new Map();
let runtimePromise = null;

// The distributed files are UMD (classic scripts), not ES modules.
function loadScript(name) {
  if (scripts.has(name)) return scripts.get(name);
  const url = new URL(name, BASE).href;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Could not load local MoveNet asset: " + name));
    };
    document.head.appendChild(script);
  });
  scripts.set(name, promise);
  promise.catch(() => scripts.delete(name));
  return promise;
}

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      // The full TF.js bundle supplies core, converter and backend
      // registration. Explicitly select WASM before creating any tensors.
      // Its bundled regenerator shim assigns this global in strict mode and
      // otherwise falls back to Function(), which a strict CSP rightly blocks.
      // Declare the global object binding without relaxing script-src.
      if (!("regeneratorRuntime" in globalThis)) globalThis.regeneratorRuntime = undefined;
      await loadScript("tf.min.js");
      await loadScript("tf-backend-wasm.min.js");
      await loadScript("pose-detection.min.js");
      const tf = globalThis.tf;
      const poseDetection = globalThis.poseDetection;
      if (!tf?.wasm?.setWasmPaths || !poseDetection?.createDetector) {
        throw new Error("Local TF.js MoveNet runtime is incomplete");
      }
      if (tf.getBackend() !== "wasm") {
        tf.wasm.setWasmPaths(BASE);
        // GitHub Pages need not supply cross-origin isolation headers;
        // TF.js automatically chooses SIMD or scalar WASM accordingly.
        const loaded = await tf.setBackend("wasm");
        if (!loaded) throw new Error("TensorFlow WASM backend failed to load");
      }
      await tf.ready();
      if (tf.getBackend() !== "wasm") throw new Error("WASM backend unavailable");
      return { tf, poseDetection };
    })();
    runtimePromise.catch(() => { runtimePromise = null; });
  }
  return runtimePromise;
}

/**
 * Convert MoveNet's original image-pixel (not mirrored) body keypoints into
 * the shared palm contract. MoveNet has no finger landmarks; its estimate
 * only uses a short bounded forearm extension when the elbow is reliable.
 */
export function extractMoveNetHands(poses, width, height) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return { left: null, right: null };
  }
  const keypoints = poses?.[0]?.keypoints || [];
  function pointAt(name, fallbackIndex) {
    const point = keypoints.find((candidate) => candidate?.name === name) ?? keypoints[fallbackIndex];
    if (!point || (point.name && point.name !== name) ||
        !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        !Number.isFinite(point.score) || point.score < HAND_CONFIDENCE ||
        point.x < 0 || point.x > width || point.y < 0 || point.y > height) return null;
    return {
      x: point.x / width,
      y: point.y / height,
      confidence: Math.min(1, Math.max(0, point.score)),
    };
  }
  function hand(side, n) {
    const other = n === 0 ? "right" : "left";
    return estimatePalm({
      wrist: pointAt(`${side}_wrist`, 9 + n), elbow: pointAt(`${side}_elbow`, 7 + n),
      shoulder: pointAt(`${side}_shoulder`, 5 + n), otherShoulder: pointAt(`${other}_shoulder`, 6 - n),
    }, width, height);
  }
  return { left: hand("left", 0), right: hand("right", 1) };
}

export async function createMoveNetDetector() {
  const { poseDetection } = await loadRuntime();
  const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    modelUrl: MODEL,
    // Use the shared adaptive filter after palm estimation instead of applying
    // two filters in series. This avoids additional phase lag on rapid swings.
    enableSmoothing: false,
  });
  let inFlight = null;
  let closed = false;
  let disposed = false;
  function dispose() {
    if (!disposed) {
      disposed = true;
      try { detector.dispose(); } catch { /* already disposed */ }
    }
  }
  return {
    async detectHandsForVideo(video, timestamp) {
      if (closed) throw new Error("MoveNet detector is closed");
      if (inFlight) throw new Error("MoveNet inference already in progress");
      // Read intrinsic dimensions before the asynchronous inference; display
      // orientation may change during it.
      const width = video.videoWidth;
      const height = video.videoHeight;
      try {
        inFlight = detector.estimatePoses(video, { flipHorizontal: false }, timestamp);
        const poses = await inFlight;
        // V16_READINESS_BEGIN
        // Prepare-only optional observer: compute the original palms first;
        // send a detached projection of this SAME inference, never the
        // mutable keypoints or an additional estimate. A failed observer
        // cannot change the original result or detector lifecycle.
        if (typeof arguments[2] === "function") {
          const originalHands = extractMoveNetHands(poses, width, height);
          try { arguments[2](extractStartPose(poses, "movenet", width, height)); }
          catch { /* readiness is optional */ }
          return originalHands;
        }
        // V16_READINESS_END
        return extractMoveNetHands(poses, width, height);
      } finally {
        inFlight = null;
        if (closed) dispose();
      }
    },
    close() {
      // Do not dispose tensors while estimatePoses() is still using them.
      closed = true;
      if (!inFlight) dispose();
    },
  };
}
