/** Whole-app Fullscreen API, with an honest usable-viewport fallback. */
const CHANGE_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'];
const ERROR_EVENTS = ['fullscreenerror', 'webkitfullscreenerror'];
const activeElement = doc => doc.fullscreenElement || doc.webkitFullscreenElement || doc.webkitCurrentFullScreenElement || null;

function selectApi(doc, app) {
  // Explicit standard API policy denial is not an invitation to try a
  // vendor-prefixed method instead. Respect the browser's limitations.
  if (typeof app.requestFullscreen === 'function') {
    return doc.fullscreenEnabled !== false && typeof doc.exitFullscreen === 'function'
      ? {request:'requestFullscreen', exit:'exitFullscreen'} : null;
  }
  if (doc.webkitFullscreenEnabled === false) return null;
  const request = ['webkitRequestFullscreen','webkitRequestFullScreen'].find(k => typeof app[k] === 'function');
  const exit = ['webkitExitFullscreen','webkitCancelFullScreen'].find(k => typeof doc[k] === 'function');
  return request && exit ? {request,exit} : null;
}

export function fullscreenState(app, doc = globalThis.document, view = globalThis.window) {
  const element = activeElement(doc);
  const active = element === app;
  const standalone = Boolean(view?.navigator?.standalone || view?.matchMedia?.('(display-mode: standalone)')?.matches);
  return {
    active,
    supported: Boolean(selectApi(doc, app)),
    otherContent: Boolean(element && !active),
    standalone,
    mode: active ? 'system-fullscreen' : standalone ? 'standalone' : 'viewport',
  };
}

/**
 * Call toggle() directly inside the user's click. Never requests fullscreen
 * for a video element: Canvas, HUD and camera must remain together.
 * A resolved promise is not proof of success (legacy iPad methods can return
 * void); the actual fullscreen element/change event is authoritative.
 */
export function createFullscreenController(app, {
  doc = globalThis.document, view = globalThis.window, onChange = () => {}, timeoutMs = 1800,
} = {}) {
  if (!app || !doc) throw new TypeError('Fullscreen requires an app element and document');
  let pending = null, disposed = false;
  const state = () => fullscreenState(app, doc, view);
  const emit = () => onChange(state());
  for (const name of CHANGE_EVENTS) doc.addEventListener(name, emit);
  const standaloneQuery = view?.matchMedia?.('(display-mode: standalone)');
  standaloneQuery?.addEventListener?.('change', emit);

  function toggle() {
    if (disposed || pending) return Promise.resolve({ok:false, reason:'busy', ...state()});
    const before=state(), pair=selectApi(doc,app);
    if (before.otherContent) return Promise.resolve({ok:false, reason:'other-content', ...before});
    if (!pair) return Promise.resolve({ok:false, reason:'unsupported', ...before});
    const entering=!before.active;
    return new Promise(resolve => {
      let finished=false, timer;
      function settle(ok,reason) {
        if (finished) return;
        finished=true;clearTimeout(timer);
        for (const name of CHANGE_EVENTS) doc.removeEventListener(name, check);
        for (const name of ERROR_EVENTS) doc.removeEventListener(name, fail);
        pending=null;emit();resolve({ok,reason,...state()});
      }
      function check() {
        const element=activeElement(doc);
        if (entering ? element===app : element===null) settle(true, entering?'entered':'exited');
      }
      function fail() { settle(false,'failed'); }
      pending=fail;
      for (const name of CHANGE_EVENTS) doc.addEventListener(name, check);
      for (const name of ERROR_EVENTS) doc.addEventListener(name, fail);
      timer=setTimeout(()=>settle(false,'unconfirmed'), timeoutMs);
      try {
        // No await, no delayed activation and no camera permission call first.
        const result=entering ? app[pair.request]() : doc[pair.exit]();
        Promise.resolve(result).then(check,fail);
        check();
      } catch { fail(); }
    });
  }
  function dispose() {
    if (disposed) return;
    disposed=true;
    for(const name of CHANGE_EVENTS)doc.removeEventListener(name,emit);
    standaloneQuery?.removeEventListener?.('change',emit);
    pending?.();
  }
  return {state,toggle,dispose};
}
