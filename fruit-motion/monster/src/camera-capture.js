// V1.6 G1c-E2 approved capture helper. No browser permissions are acquired
// beyond the legacy front-camera path. See docs/benchmarks/v1.6/camera/.
const PRIMARY = () => ({ facingMode: { ideal: 'user' }, width: { ideal: 960 },
  height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } });
const COMPAT = () => ({ facingMode: { ideal: 'user' }, width: { ideal: 640 },
  height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } });
const MINIMAL = () => ({ facingMode: 'user' });
export const baselineConstraints = [PRIMARY, COMPAT, MINIMAL];

function namedError(name, message) {
  return Object.assign(new Error(message), { name });
}

function stopStream(stream) {
  for (const track of stream?.getTracks?.() || []) {
    try { track.stop(); } catch { /* already ended */ }
  }
}

function safeRead(track, method) {
  try { return track?.[method]?.() || {}; }
  catch { return {}; }
}

const finitePositive = value => Number.isFinite(value) && value > 0;
const observedSize = settings => finitePositive(settings.width) &&
  finitePositive(settings.height) && finitePositive(settings.frameRate);
const knownNonFront = settings => typeof settings.facingMode === 'string' &&
  !!settings.facingMode && settings.facingMode !== 'user';

function sameCamera(before, after) {
  return after.facingMode === 'user' && (!before.deviceId || after.deviceId === before.deviceId);
}

function withinBudget(before, after) {
  if (!observedSize(before) || !observedSize(after)) return false;
  const pixelRatio = after.width * after.height / (before.width * before.height);
  // Native 16:9 modes like 960x540 / 1280x720 remain eligible relative to
  // 960x720. Avoid unknown/majorly degraded sampling or excessive new load.
  return pixelRatio >= .75 && pixelRatio <= 1.5 &&
    after.frameRate >= before.frameRate - 1 && after.frameRate <= 30.001;
}

function unchanged(before, after) {
  return ['facingMode', 'deviceId', 'width', 'height', 'frameRate', 'resizeMode', 'zoom']
    .every(key => before[key] === undefined || before[key] === after[key]);
}

function minimumZoom(capabilities, settings) {
  const zoom = capabilities.zoom;
  if (!finitePositive(zoom?.min) || !finitePositive(zoom?.max) ||
      zoom.max < zoom.min || !finitePositive(settings.zoom) ||
      settings.zoom > zoom.max || settings.zoom <= zoom.min + 1e-6) return null;
  return zoom.min;
}

function captureMetadata(track, settings) {
  const resizeMode = ['none', 'crop-and-scale'].includes(settings.resizeMode) ? settings.resizeMode : null;
  const range = safeRead(track, 'getCapabilities').zoom;
  const canReportZoom = finitePositive(range?.min) && finitePositive(range?.max) &&
    range.max >= range.min && finitePositive(settings.zoom) &&
    settings.zoom >= range.min - 1e-6 && settings.zoom <= range.max;
  return {
    width: finitePositive(settings.width) ? settings.width : null,
    height: finitePositive(settings.height) ? settings.height : null,
    frameRate: finitePositive(settings.frameRate) ? settings.frameRate : null,
    resizeMode,
    nativeResizeState: resizeMode === 'none' ? 'no-UA-crop-reported' :
      resizeMode === 'crop-and-scale' ? 'UA-crop-reported' : 'not-reported',
    zoomState: !canReportZoom ? 'not-reported' :
      Math.abs(settings.zoom - range.min) < 1e-6 ? 'at-device-minimum' : 'not-at-device-minimum',
  };
}

/** Race only optional capability operations, not the original permission
 * prompt. Late fulfillment/rejection is always consumed; caller stops an
 * uncertain old stream before restoring the unchanged legacy acquisition. */
function optionalOperation(operation, { signal, current, timeoutMs }) {
  return new Promise(resolve => {
    let done = false, timer;
    const finish = result => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      resolve(result);
    };
    const cancel = () => finish({ state: 'cancelled' });
    if (!current()) return cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => finish({ state: 'timeout' }), timeoutMs);
    // No async work escapes the guarded Promise, including sync exceptions.
    try {
      Promise.resolve(operation()).then(value => finish({ state: 'ok', value }),
        error => finish({ state: 'rejected', error }));
    } catch (error) { finish({ state: 'rejected', error }); }
  });
}

/** Wide preference is based exclusively on a real, already-authorized front
 * track's capabilities & actual settings. Inferred physical FOV is NEVER
 * reported; no device enumeration, device IDs emitted, or PTZ permission request.
 * Returns the original kind of MediaStream expected by MotionTracker. */
export async function requestFrontCamera(mediaDevices, {
  permissions, signal, isCurrent = () => true, tuneTimeoutMs = 750, onCaptureSettings,
} = {}) {
  const current = () => !signal?.aborted && isCurrent();
  const abort = () => namedError('AbortError', 'Camera acquisition superseded');
  const checkCurrent = () => { if (!current()) throw abort(); };
  let stream;

  async function requestBaseline() {
    for (let i = 0; i < baselineConstraints.length; i++) {
      checkCurrent();
      const video = baselineConstraints[i]();
      let acquired;
      try { acquired = await mediaDevices.getUserMedia({ audio: false, video }); }
      catch (error) {
        if (error?.name !== 'OverconstrainedError' || i === baselineConstraints.length - 1 || !current()) throw error;
        continue;
      }
      // Native permission prompts may resolve after stop/supersession.
      if (!current()) { stopStream(acquired); throw abort(); }
      return { stream: acquired, constraints: video, depth: i };
    }
  }

  const front = acquired => {
    const track = acquired?.getVideoTracks?.()[0];
    const settings = safeRead(track, 'getSettings');
    // Never use a track explicitly reporting a non-front camera. Old engines
    // unable to report facingMode retain only the existing front preference.
    if (knownNonFront(settings)) throw namedError('CameraUnavailableError', 'The requested front camera is unavailable');
    return { track, settings };
  };
  const finish = acquired => {
    checkCurrent();
    const { track, settings } = front(acquired);
    if (typeof onCaptureSettings === 'function') {
      // Opt-in QA/status only; never the actual geometry or physical lens FoV.
      try { onCaptureSettings(captureMetadata(track, settings)); }
      catch { /* a diagnostics callback cannot break camera startup */ }
    }
    checkCurrent();
    return acquired;
  };

  try {
    let baseline = await requestBaseline();
    stream = baseline.stream;
    let { track, settings } = front(stream);
    const initial = settings;
    if (baseline.depth === 2 || !track || track.readyState === 'ended' ||
        settings.facingMode !== 'user' || !observedSize(settings) ||
        typeof track.applyConstraints !== 'function') return finish(stream);
    let constraints = baseline.constraints;
    const guard = { signal, current, timeoutMs: tuneTimeoutMs };

    // Recover exactly once without tuning, only if the optional operation
    // might mutate the track unexpectedly. Never attach an uncertain stream.
    const recoverBaseline = async () => {
      stopStream(stream);
      stream = null;
      checkCurrent();
      baseline = await requestBaseline();
      stream = baseline.stream;
      return finish(stream);
    };

    const apply = async (extra, accepted) => {
      const before = settings;
      const next = { ...constraints, ...extra };
      const result = await optionalOperation(() => track.applyConstraints(next), guard);
      checkCurrent();
      const after = safeRead(track, 'getSettings');
      if (track.readyState === 'ended' || result.state === 'timeout') return false;
      if (result.state === 'rejected') {
        // Standard constraint rejection leaves the existing constraints in
        // effect; verify all previously observable settings before keeping it.
        if (!unchanged(before, after)) return false;
        return true;
      }
      if (result.state !== 'ok' || !sameCamera(initial, after) ||
          !withinBudget(initial, after) || !accepted(after)) return false;
      constraints = next;
      settings = after;
      return true;
    };

    // A width/height or aspect-ratio constraint alone cannot prove that the
    // camera captures more of the room. Remove browser crop/scale only when the
    // current track explicitly reports it and advertises native/no-crop mode.
    let capabilities = safeRead(track, 'getCapabilities');
    if (settings.resizeMode === 'crop-and-scale' &&
        Array.isArray(capabilities.resizeMode) && capabilities.resizeMode.includes('none')) {
      if (!await apply({ resizeMode: { exact: 'none' } }, after =>
        after.resizeMode === 'none' &&
        // Avoid an unexpected zoom-in while asking for no browser crop.
        (!finitePositive(settings.zoom) || (finitePositive(after.zoom) && after.zoom <= settings.zoom + 1e-6)))) {
        return await recoverBaseline();
      }
    }

    // Query (never request) the stronger, existing PTZ grant. Browsers that
    // don't expose it, already at min, or lacking a bona fide range skip zoom.
    capabilities = safeRead(track, 'getCapabilities');
    const min = minimumZoom(capabilities, settings);
    if (min !== null && typeof permissions?.query === 'function') {
      const permission = await optionalOperation(() => permissions.query({ name: 'camera', panTiltZoom: true }), guard);
      checkCurrent();
      if (permission.state === 'ok' && permission.value?.state === 'granted') {
        if (!await apply({ zoom: { exact: min } }, after =>
          finitePositive(after.zoom) && Math.abs(after.zoom - min) < 1e-6 &&
          (settings.resizeMode !== 'none' || after.resizeMode === 'none'))) {
          return await recoverBaseline();
        }
      }
    }
    return finish(stream);
  } catch (error) {
    stopStream(stream);
    throw error;
  }
}
