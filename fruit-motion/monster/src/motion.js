/**
 * Camera / pose input adapter. The game consumes normalized, UNMIRRORED hands
 * regardless of the model implementation. Camera pixels never leave this class.
 */
import { createMoveNetDetector } from "./movenet.js";
import { estimatePalm, HandTrackingFilter } from "./hand-tracking.js";
// V16_READINESS_BEGIN
import { extractStartPose } from "./start-gesture.js";
// V16_READINESS_END

const RUNTIME_URL = new URL("../assets/vision/vision_bundle.mjs", import.meta.url).href;
const WASM_URL = new URL("../assets/vision/wasm", import.meta.url).href;
const MODEL_FULL_URL = new URL("../assets/models/pose_landmarker_full.task", import.meta.url).href;
const MODEL_LITE_URL = new URL("../assets/models/pose_landmarker_lite.task", import.meta.url).href;
const INFERENCE_INTERVAL_MS = 1000 / 20;
const MIN_STALE_TRACKING_MS = 350;
const MAX_STALE_TRACKING_MS = 900;
const HAND_CONFIDENCE = 0.45;
const NO_HANDS = () => ({ left: null, right: null });
const MOVENET_DELEGATE = "MoveNet/WASM";
const POSE_ROUTES = [
  { label: "Pose Full/GPU", delegate: "GPU", model: MODEL_FULL_URL },
  { label: "Pose Lite/GPU", delegate: "GPU", model: MODEL_LITE_URL },
  { label: "Pose Lite/CPU", delegate: "CPU", model: MODEL_LITE_URL },
];

function supportsWebGL2() {
  try {
    const probe = document.createElement("canvas");
    const context = probe.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!context) return false;
    context.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** Describe the exact rendered, centered CSS video rectangle. Adaptive fit
 * preserves all captured limbs when cover would cut away >28% of the image. */
export function cameraViewport(videoWidth, videoHeight, viewWidth, viewHeight, fit = "adaptive") {
  const dimensions = [videoWidth, videoHeight, viewWidth, viewHeight];
  if (dimensions.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  const sx = viewWidth / videoWidth, sy = viewHeight / videoHeight;
  const coverVisibleFraction = Math.min(sx, sy) / Math.max(sx, sy);
  if (fit === "adaptive") fit = coverVisibleFraction < 0.72 ? "contain" : "cover";
  if (fit !== "contain") fit = "cover";
  const scale = fit === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  const left = (viewWidth - width) / 2, top = (viewHeight - height) / 2;
  const visible = {
    left: Math.max(0, left), top: Math.max(0, top),
    right: Math.min(viewWidth, left + width), bottom: Math.min(viewHeight, top + height),
  };
  visible.width = visible.right - visible.left;
  visible.height = visible.bottom - visible.top;
  return { fit, left, top, width, height, visibleFraction: fit === "contain" ? 1 : coverVisibleFraction,
    coverVisibleFraction, visible };
}

/** Map unmirrored coordinates into the same mirrored CSS video rectangle.
 * Deliberately do not clamp out-of-view hands onto the screen edge. */
export function mapToViewport(point, videoWidth, videoHeight, viewWidth, viewHeight, fit = "cover") {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const rect = cameraViewport(videoWidth, videoHeight, viewWidth, viewHeight, fit);
  if (!rect) return null;
  return {
    ...point,
    x: (1 - point.x) * rect.width + rect.left,
    y: point.y * rect.height + rect.top,
  };
}

function stopStream(stream) {
  for (const track of stream?.getTracks?.() || []) {
    try { track.stop(); } catch { /* already ended */ }
  }
}

function closeDetector(detector) {
  try { detector?.close?.(); } catch { /* runtime already disposed */ }
}

function namedError(name, message) {
  const error = new Error(message);
  error.name = name;
  return error;
}

function errorMessage(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "摄像头未获允许。请在 Safari 网站设置中允许摄像头，然后重试。";
    case "NotFoundError":
      return "没有找到可用的摄像头，请检查设备。";
    case "NotReadableError":
    case "AbortError":
      return "摄像头暂时无法使用，可能被其他应用占用，请关闭其他应用后重试。";
    case "OverconstrainedError":
      return "摄像头不支持当前参数，请重试。";
    case "InsecureContextError":
      return "摄像头需要安全的 HTTPS 网页。请在 Safari 中直接打开游戏页面。";
    case "CameraUnavailableError":
      return "当前浏览器无法访问摄像头。请在 Safari 中直接打开游戏页面。";
    case "VideoTimeoutError":
      return "摄像头画面没有出现，请检查权限后重试。";
    case "CameraEndedError":
      return "摄像头连接已中断，请重新开启摄像头。";
    default:
      return "体感识别未能启动或已中断，请重试，或使用触屏练习模式。";
  }
}

function pointAt(landmarks, index) {
  const value = landmarks?.[index];
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  // Visibility and presence may be absent depending on the SDK version.
  const visibility = Number.isFinite(value.visibility) ? value.visibility : 1;
  const presence = Number.isFinite(value.presence) ? value.presence : 1;
  const confidence = Math.max(0, Math.min(1, visibility, presence));
  if (confidence < HAND_CONFIDENCE || value.x < 0 || value.x > 1 ||
      value.y < 0 || value.y > 1) return null;
  return { x: value.x, y: value.y, confidence };
}

function handAt(landmarks, side, width, height) {
  const n = side === "left" ? 0 : 1;
  return estimatePalm({
    wrist: pointAt(landmarks, 15 + n), elbow: pointAt(landmarks, 13 + n),
    pinky: pointAt(landmarks, 17 + n), index: pointAt(landmarks, 19 + n),
    shoulder: pointAt(landmarks, 11 + n), otherShoulder: pointAt(landmarks, 12 - n),
  }, width, height);
}

/**
 * Extract left / right (anatomical) hands from MediaPipe's 33 landmarks.
 * Exported separately to permit deterministic unit tests without a camera.
 */
export function extractHandPoints(result, videoWidth = 1, videoHeight = 1) {
  const landmarks = result?.landmarks?.[0];
  return {
    left: handAt(landmarks, "left", videoWidth, videoHeight),
    right: handAt(landmarks, "right", videoWidth, videoHeight),
  };
}

function waitForVideo(video, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    const events = ["loadedmetadata", "loadeddata", "canplay", "playing"];
    const cleanup = () => {
      clearTimeout(timer);
      for (const event of events) video.removeEventListener(event, check);
      video.removeEventListener("error", fail);
      signal.removeEventListener("abort", abort);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const check = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) finish();
    };
    const fail = () => finish(namedError("VideoTimeoutError", "Camera video failed to load"));
    const abort = () => finish(namedError("AbortError", "Camera startup cancelled"));

    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort, { once: true });
    for (const event of events) video.addEventListener(event, check);
    video.addEventListener("error", fail, { once: true });
    timer = setTimeout(fail, 10000);
    // Muted inline playback is important for Safari.
    try {
      Promise.resolve(video.play()).then(check, (error) => finish(error));
    } catch (error) {
      finish(error);
    }
    check();
  });
}

export class MotionTracker {
  constructor({ video, onHands = () => {}, onStatus = () => {}, onError = () => {} }) {
    if (!video) throw new TypeError("MotionTracker requires a video element");
    this.video = video;
    this.onHands = onHands;
    this.onStatus = onStatus;
    this.onError = onError;
    // V16_READINESS_BEGIN
    this.wantsStartPose = arguments[0]?.wantsStartPose;
    // V16_READINESS_END
    // V16_CAMERA_BEGIN
    // Optional, independently approved acquisition adapter; the original
    // front-camera fallback below stays available unchanged.
    this.cameraRequest = arguments[0]?.cameraRequest;
    this.onCaptureSettings = arguments[0]?.onCaptureSettings;
    // V16_CAMERA_END
    this.generation = 0;
    this.stream = null;
    this.detector = null;
    this.runtime = null;
    this.delegate = null;
    this.startController = null;
    this.frameTimer = null;
    this.inferencePending = null;
    this.frameEpoch = 0;
    this.paused = false;
    this.recovering = false;
    this.handFilter = new HandTrackingFilter();
    this.status = { state: "idle", message: "", tracking: false, fps: 0, inferenceMs: 0 };
    this._resetStats();
  }

  _resetStats() {
    this.handFilter.reset();
    this.lastInferenceAt = -Infinity;
    this.lastVideoTime = -1;
    this.lastTimestamp = -Infinity;
    this.lastResultAt = 0;
    this.samplePeriodMs = 0;
    this.statsSince = 0;
    this.statsCount = 0;
    this.fps = 0;
    this.inferenceMs = 0;
    this.tracking = false;
    this.performanceSince = 0;
    this.slowSince = 0;
  }

  /** Called on a display geometry/orientation reset; clear old trajectories
   * without restarting the camera or reloading model assets. */
  resetHandFilter() { this.handFilter.reset(); }

  _isCurrent(generation) {
    return this.generation === generation;
  }

  _staleAfterMs() {
    // A real inference that misses a hand clears it immediately. This grace
    // period applies ONLY to absence of a fresh frame/result. Accommodate
    // variable input rates while bounding stale tracking to at most 900 ms.
    if (!this.samplePeriodMs) return MAX_STALE_TRACKING_MS;
    return Math.min(MAX_STALE_TRACKING_MS,
      Math.max(MIN_STALE_TRACKING_MS, this.samplePeriodMs * 2.2 + this.inferenceMs));
  }

  _emitHands(hands, timestamp = performance.now()) {
    if (!hands?.left && !hands?.right) this.handFilter.reset();
    // V16_READINESS_BEGIN
    if (arguments.length > 2) {
      try { this.onHands(hands, timestamp, arguments[2]); }
      catch (error) { console.error("Motion input callback failed", error); }
      return;
    }
    // V16_READINESS_END
    try { this.onHands(hands, timestamp); }
    catch (error) { console.error("Motion input callback failed", error); }
  }

  _emitStatus(state, message, tracking = this.tracking) {
    this.status = {
      state,
      message,
      tracking,
      fps: this.fps,
      inferenceMs: this.inferenceMs,
      staleAfterMs: this._staleAfterMs(),
      delegate: this.delegate,
      videoWidth: this.video.videoWidth || 0,
      videoHeight: this.video.videoHeight || 0,
    };
    try { this.onStatus({ ...this.status }); }
    catch (error) { console.error("Motion status callback failed", error); }
  }

  _cancelFrame() {
    if (this.frameTimer !== null) clearTimeout(this.frameTimer);
    this.frameTimer = null;
  }

  _teardown() {
    this.startController?.abort();
    this.startController = null;
    this._cancelFrame();
    ++this.frameEpoch;
    this.inferencePending = null;
    closeDetector(this.detector);
    this.detector = null;
    this.runtime = null;
    this.delegate = null;
    const stream = this.stream;
    this.stream = null;
    if (stream && this.video.srcObject === stream) {
      try { this.video.pause(); } catch { /* browser may already be suspended */ }
      this.video.srcObject = null;
    }
    stopStream(stream);
    this.paused = false;
    this.recovering = false;
    this._resetStats();
  }

  async _requestCamera(generation) {
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      throw namedError("InsecureContextError", "Camera requires a secure context");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw namedError("CameraUnavailableError", "getUserMedia is unavailable");
    }
    // V16_CAMERA_BEGIN
    if (typeof this.cameraRequest === "function") {
      return this.cameraRequest(navigator.mediaDevices, {
        permissions: navigator.permissions,
        signal: this.startController?.signal,
        isCurrent: () => this._isCurrent(generation),
        onCaptureSettings: this.onCaptureSettings,
      });
    }
    // V16_CAMERA_END
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 960 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
    } catch (error) {
      // Older devices may reject combinations of resolution / frame rate.
      if (error?.name !== "OverconstrainedError" || !this._isCurrent(generation)) throw error;
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: "user" }, width: { ideal: 640 }, height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        } });
      } catch (fallbackError) {
        if (fallbackError?.name !== "OverconstrainedError" || !this._isCurrent(generation)) throw fallbackError;
        return navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user" } });
      }
    }
  }

  async _createDetector(delegate, runtime = this.runtime, model = MODEL_FULL_URL) {
    return runtime.PoseLandmarker.createFromOptions(runtime.fileset, {
      baseOptions: { modelAssetPath: model, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputSegmentationMasks: false,
    });
  }

  async _tryPoseRoutes(generation, startIndex = 0) {
    if (!this.runtime) return null;
    for (const route of POSE_ROUTES.slice(startIndex)) {
      if (!this._isCurrent(generation)) return null;
      try {
        const detector = await this._createDetector(route.delegate, this.runtime, route.model);
        if (!this._isCurrent(generation)) { closeDetector(detector); return null; }
        return { detector, delegate: route.label };
      } catch (error) {
        if (!this._isCurrent(generation)) return null;
        console.warn(`${route.label} initialization failed; trying compatibility model.`, error);
        this._emitStatus("loading", "正在切换为兼容识别模式…", false);
      }
    }
    return null;
  }

  async _createInitialDetector(generation) {
    // MediaPipe's CPU delegate still uses a WebGL image input path. A device
    // without WebGL must choose MoveNet/WASM directly rather than failing a
    // camera session after a seemingly successful CPU initialization.
    if (supportsWebGL2()) {
      try {
        const { FilesetResolver, PoseLandmarker } = await import(RUNTIME_URL);
        if (!this._isCurrent(generation)) return null;
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        if (!this._isCurrent(generation)) return null;
        const runtime = { PoseLandmarker, fileset };
        this.runtime = runtime;
        const selected = await this._tryPoseRoutes(generation);
        if (selected) return selected;
      } catch (error) {
        if (!this._isCurrent(generation)) return null;
        console.warn("MediaPipe initialization failed; using MoveNet WASM.", error);
      }
    }
    if (!this._isCurrent(generation)) return null;
    this._emitStatus("loading", "正在加载兼容体感识别模型…", false);
    return { detector: await createMoveNetDetector(), delegate: MOVENET_DELEGATE };
  }

  /**
   * Call synchronously from a real user click. Resolves true once the camera
   * and model are ready, false on cancellation/error (also reported via
   * onStatus / onError). Starting again safely supersedes the previous start.
   */
  async start() {
    const generation = ++this.generation;
    this._teardown();
    this._emitHands(NO_HANDS());
    this.startController = new AbortController();
    const signal = this.startController.signal;
    this._emitStatus("requesting", "正在开启前置摄像头…", false);

    try {
      // Request camera up front, before waiting for the model or WASM assets.
      const stream = await this._requestCamera(generation);
      if (!this._isCurrent(generation)) {
        stopStream(stream);
        return false;
      }
      this.stream = stream;
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState === "ended") {
        throw namedError("CameraEndedError", "Camera supplied no live video track");
      }
      videoTrack.addEventListener("ended", () => {
        if (this._isCurrent(generation)) {
          this._fail(namedError("CameraEndedError", "Camera stopped"), generation);
        }
      }, { once: true });
      videoTrack.addEventListener("mute", () => {
        if (this._isCurrent(generation) && this.status.state === "running") {
          ++this.frameEpoch;
          this.tracking = false;
          this._emitHands(NO_HANDS());
          this._emitStatus("running", "摄像头画面暂时中断…", false);
        }
      });

      const video = this.video;
      video.muted = true;
      video.defaultMuted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      video.srcObject = stream;
      await waitForVideo(video, signal);
      if (!this._isCurrent(generation)) return false;

      this._emitStatus("loading", "正在加载体感识别模型…", false);
      const selected = await this._createInitialDetector(generation);
      if (!selected) return false;
      const { detector, delegate } = selected;
      if (!this._isCurrent(generation)) {
        closeDetector(detector);
        return false;
      }
      this.detector = detector;
      this.delegate = delegate;
      if (delegate === MOVENET_DELEGATE) this.runtime = null;
      this.startController = null;
      this._resetStats();
      this._emitStatus("running", "请站进画面，让摄像头看到你的双手。", false);
      this._schedule(generation);
      return true;
    } catch (error) {
      if (this._isCurrent(generation)) this._fail(error, generation);
      return false;
    }
  }

  _schedule(generation) {
    if (!this._isCurrent(generation) || this.paused || this.recovering || !this.detector ||
        this.frameTimer !== null || this.inferencePending !== null) return;
    // The camera should not run at the renderer's cadence. Some browsers or
    // inactive/low-power displays throttle requestAnimationFrame even when
    // fresh camera frames are available. A relative timer allows inference
    // independently of rendering, bounded to one start per 50 ms (20 Hz).
    const remaining = this.lastInferenceAt + INFERENCE_INTERVAL_MS - performance.now();
    const delay = Number.isFinite(remaining) ? Math.ceil(Math.max(16, remaining)) : 0;
    this.frameTimer = setTimeout(() => {
      this.frameTimer = null;
      void this._tick(performance.now(), generation);
    }, delay);
  }

  async _tick(now, generation) {
    if (!this._isCurrent(generation) || this.paused || this.recovering || !this.detector ||
        this.inferencePending !== null) return;
    const video = this.video;

    if (this.tracking && now - this.lastResultAt > this._staleAfterMs()) {
      this.tracking = false;
      this._emitHands(NO_HANDS(), now);
      this._emitStatus("running", "尚未识别到双手，请站进画面。", false);
    }

    const videoTrack = this.stream?.getVideoTracks()[0];
    const shouldDetect = !videoTrack?.muted && video.readyState >= 2 && video.videoWidth > 0 &&
      video.videoHeight > 0 && video.currentTime !== this.lastVideoTime &&
      now - this.lastInferenceAt >= INFERENCE_INTERVAL_MS;
    if (!shouldDetect) {
      this._schedule(generation);
      return;
    }

    this.lastVideoTime = video.currentTime;
    this.lastInferenceAt = now;
    const inferenceStart = performance.now();
    const timestamp = Math.max(inferenceStart, this.lastTimestamp + 0.01);
    this.lastTimestamp = timestamp;
    const ticket = { epoch: this.frameEpoch, detector: this.detector,
      width: video.videoWidth, height: video.videoHeight };
    this.inferencePending = ticket;
    // V16_READINESS_BEGIN
    let readinessRequested = false, startPose = null;
    try { readinessRequested = this.wantsStartPose?.() === true; }
    catch { /* an optional UI observer cannot block inference */ }
    // V16_READINESS_END
    let hands;
    let failure;
    // A slow WASM inference cannot leave old hand coordinates active.
    const staleDelay = Math.max(0, this._staleAfterMs() - (now - this.lastResultAt));
    const staleTimer = this.tracking ? setTimeout(() => {
      if (this._isCurrent(generation) && this.inferencePending === ticket &&
          this.frameEpoch === ticket.epoch && this.tracking && !this.paused) {
        this.tracking = false;
        this._emitHands(NO_HANDS());
        this._emitStatus("running", "正在重新识别双手…", false);
      }
    }, staleDelay) : null;
    try {
      // MediaPipe's VIDEO API is synchronous; MoveNet's estimatePoses is
      // asynchronous. Never schedule a second inference until this completes.
      // V16_READINESS_BEGIN
      if (readinessRequested) {
        if (this.delegate === MOVENET_DELEGATE) {
          hands = await ticket.detector.detectHandsForVideo(video, timestamp, pose => { startPose = pose; });
        } else {
          const result = ticket.detector.detectForVideo(video, timestamp);
          hands = extractHandPoints(result, ticket.width, ticket.height);
          try { startPose = extractStartPose(result, "mediapipe", ticket.width, ticket.height); }
          catch { /* readiness is optional */ }
        }
      } else
      // V16_READINESS_END
      hands = this.delegate === MOVENET_DELEGATE
        ? await ticket.detector.detectHandsForVideo(video, timestamp)
        : extractHandPoints(ticket.detector.detectForVideo(video, timestamp), ticket.width, ticket.height);
    } catch (error) {
      failure = error;
    } finally {
      clearTimeout(staleTimer);
      if (this.inferencePending === ticket) this.inferencePending = null;
    }
    if (!this._isCurrent(generation) || this.detector !== ticket.detector) return;
    if (this.paused || ticket.epoch !== this.frameEpoch || videoTrack?.muted) {
      this._schedule(generation);
      return;
    }
    if (failure) {
      this._emitHands(NO_HANDS(), timestamp);
      this.tracking = false;
      if (this.delegate !== MOVENET_DELEGATE) {
        void this._recoverDetector(generation, failure);
      } else {
        this._fail(failure, generation);
      }
      return;
    }

    const completedAt = performance.now();
    const inferenceDuration = completedAt - inferenceStart;
    if (this.lastResultAt > 0) {
      const gap = completedAt - this.lastResultAt;
      this.samplePeriodMs = this.samplePeriodMs
        ? 0.75 * this.samplePeriodMs + 0.25 * gap
        : gap;
    }
    this.lastResultAt = completedAt;
    this.inferenceMs = this.inferenceMs
      ? this.inferenceMs * 0.8 + inferenceDuration * 0.2
      : inferenceDuration;
    if (this.statsSince === 0) this.statsSince = completedAt;
    else this.statsCount++;
    const elapsed = completedAt - this.statsSince;
    const publishStats = elapsed >= 600;
    if (publishStats) {
      this.fps = this.statsCount * 1000 / elapsed;
      this.statsSince = completedAt;
      this.statsCount = 0;
    }

    if (!this.performanceSince) this.performanceSince = completedAt;
    // Full is the quality-first path, but sustained slow inference worsens
    // fast hand tracking. Allow a more generous threshold on Lite. Warm up,
    // then require two seconds of persistent slowness; the session only falls
    // back, never oscillates or runs two detectors simultaneously.
    const poseRoute = POSE_ROUTES.findIndex(route => route.label === this.delegate);
    if (poseRoute >= 0 && completedAt - this.performanceSince > 1800) {
      const slow = this.inferenceMs > (poseRoute === 0 ? 75 : 120) ||
        (this.fps > 0 && this.fps < (poseRoute === 0 ? 12 : 8));
      if (!slow) this.slowSince = 0;
      else if (!this.slowSince) this.slowSince = completedAt;
      else if (completedAt - this.slowSince > 2000) {
        this.tracking = false;
        this._emitHands(NO_HANDS(), timestamp);
        void this._recoverDetector(generation, new Error("Pose sustained inference latency"));
        return;
      }
    }

    // Inputs are tagged with their actual inference-start time, not callback
    // completion. Long stale results and orientation changes must not slash.
    const geometryChanged = ticket.width !== video.videoWidth || ticket.height !== video.videoHeight;
    if (geometryChanged || inferenceDuration > 250) hands = NO_HANDS();
    const filtered = this.handFilter.update(hands, timestamp, ticket.width, ticket.height);
    const wasTracking = this.tracking;
    this.tracking = Boolean(filtered.left || filtered.right);
    // Never retain a disappeared landmark across frames. This prevents the
    // game from connecting two unrelated positions into a phantom slash.
    // V16_READINESS_BEGIN
    if (readinessRequested && !geometryChanged && inferenceDuration <= 250) {
      this._emitHands(filtered, timestamp, startPose);
    } else
    // V16_READINESS_END
    this._emitHands(filtered, timestamp);
    if (!this._isCurrent(generation)) return;
    if (wasTracking !== this.tracking || publishStats) {
      this._emitStatus("running",
        this.tracking ? "体感识别已就绪" : "请让头部、肩膀和双手进入画面。",
        this.tracking);
    }
    this._schedule(generation);
  }

  async _recoverDetector(generation, error) {
    if (!this._isCurrent(generation) || this.recovering) return;
    this.recovering = true;
    ++this.frameEpoch;
    this._cancelFrame();
    const previousDelegate = this.delegate;
    closeDetector(this.detector);
    this.detector = null;
    this._emitStatus("loading", "正在切换为兼容识别模式…", false);
    try {
      let selected = null;
      const routeIndex = POSE_ROUTES.findIndex(route => route.label === previousDelegate);
      if (routeIndex >= 0 && this.runtime) {
        console.warn(`${previousDelegate} inference interrupted; trying next model.`, error);
        selected = await this._tryPoseRoutes(generation, routeIndex + 1);
      }
      if (!selected) {
        if (!this._isCurrent(generation)) return;
        console.warn("MediaPipe inference failed; using MoveNet WASM.", error);
        selected = { detector: await createMoveNetDetector(), delegate: MOVENET_DELEGATE };
      }
      const { detector, delegate } = selected;
      if (!this._isCurrent(generation)) {
        closeDetector(detector);
        return;
      }
      this.detector = detector;
      this.delegate = delegate;
      if (delegate === MOVENET_DELEGATE) this.runtime = null;
      this.recovering = false;
      this._resetStats();
      if (this.paused) {
        this._emitStatus("paused", "体感识别已暂停", false);
      } else {
        this._emitStatus("running", "请让头部、肩膀和双手进入画面。", false);
        this._schedule(generation);
      }
    } catch (fallbackError) {
      if (this._isCurrent(generation)) this._fail(fallbackError, generation);
    }
  }

  _fail(error, generation) {
    if (!this._isCurrent(generation)) return;
    ++this.generation;
    this._teardown();
    this._emitHands(NO_HANDS());
    const message = errorMessage(error);
    this._emitStatus("error", message, false);
    // Preserve the original diagnostic while giving the UI a localized error.
    try { this.onError({ name: error?.name || "Error", message, cause: error }); }
    catch (callbackError) { console.error("Motion error callback failed", callbackError); }
  }

  pause() {
    if (!this.detector && !this.recovering) return;
    this.paused = true;
    ++this.frameEpoch;
    this._cancelFrame();
    this._resetStats();
    this._emitHands(NO_HANDS());
    this._emitStatus("paused", "体感识别已暂停", false);
  }

  resume() {
    if (!this.paused || !this.stream) return;
    this.paused = false;
    this._resetStats();
    const generation = this.generation;
    // Safari may pause a muted video while its page is in the background.
    if (this.video.paused) {
      try {
        Promise.resolve(this.video.play()).catch((error) => this._fail(error, generation));
      } catch (error) {
        this._fail(error, generation);
        return;
      }
    }
    if (!this.recovering) {
      this._emitStatus("running", "请让头部、肩膀和双手进入画面。", false);
      this._schedule(generation);
    }
  }

  stop() {
    ++this.generation;
    this._teardown();
    this._emitHands(NO_HANDS());
    this._emitStatus("idle", "", false);
  }
}
