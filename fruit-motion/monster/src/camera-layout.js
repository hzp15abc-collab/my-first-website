/**
 * Front-camera composition in CSS pixels. This is shared by the camera
 * preview, normalized unmirrored model landmarks, the blade and fruit area.
 * Intrinsic source size is independent of the canvas backing-store DPR.
 */
export function coverCameraLayout(sourceWidth, sourceHeight, videoBounds, canvasBounds) {
  const dimensions = [sourceWidth, sourceHeight, videoBounds?.width, videoBounds?.height,
    canvasBounds?.width, canvasBounds?.height];
  const origins = [videoBounds?.left, videoBounds?.top, canvasBounds?.left, canvasBounds?.top];
  if (dimensions.some(n => !Number.isFinite(n) || n <= 0) || origins.some(n => !Number.isFinite(n))) return null;

  const vx = videoBounds.left - canvasBounds.left, vy = videoBounds.top - canvasBounds.top;
  const sx = videoBounds.width / sourceWidth, sy = videoBounds.height / sourceHeight;
  const scale = Math.max(sx, sy);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  // object-fit: cover, object-position: center, mirrored around the center
  // of the video element. The element and game canvas can share any origin.
  const left = vx + (videoBounds.width - width) / 2;
  const top = vy + (videoBounds.height - height) / 2;
  const visible = {
    left: Math.max(0, vx), top: Math.max(0, vy),
    right: Math.min(canvasBounds.width, vx + videoBounds.width),
    bottom: Math.min(canvasBounds.height, vy + videoBounds.height),
  };
  visible.width = visible.right - visible.left;
  visible.height = visible.bottom - visible.top;
  if (visible.width <= 0 || visible.height <= 0) return null;
  return {
    fit: 'cover', sourceWidth, sourceHeight, scale, left, top, width, height, visible,
    coverVisibleFraction: Math.min(sx, sy) / scale,
    visibleFraction: visible.width * visible.height / (width * height),
  };
}

/** Mirror exactly once; a hand in the cropped region has no playable point. */
export function mapCameraPoint(point, layout) {
  if (!layout || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return null;
  const x = layout.left + (1 - point.x) * layout.width;
  const y = layout.top + point.y * layout.height;
  const { left, right, top, bottom } = layout.visible;
  // Permit floating point roundoff at the exact natural boundary, never
  // project a truly out-of-view hand onto a screen edge.
  const tolerance = 1e-7;
  if (x < left - tolerance || x > right + tolerance || y < top - tolerance || y > bottom + tolerance) return null;
  return { ...point, x, y };
}

/** Inference was started within the current composition. This guard is only
 * for in-flight work crossing a geometry change; not an inference-age limit. */
export function belongsToCameraLayout(timestamp, layoutChangedAt = -Infinity) {
  return Number.isFinite(timestamp) && timestamp >= layoutChangedAt;
}
