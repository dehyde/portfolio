const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function getSceneAt(position, starts) {
  if (!Number.isFinite(position) || starts.length < 2) return { index: 0, progress: 0 };
  let index = 0;
  while (index < starts.length - 2 && position >= starts[index + 1]) index += 1;
  const distance = Math.max(1, starts[index + 1] - starts[index]);
  return { index, progress: clamp((position - starts[index]) / distance, 0, 1) };
}

export function getOverviewScene(position, cardTops, containerBottom, previewBottom, stepCount = 4, transitionFraction = .6) {
  if (!Number.isFinite(containerBottom) || !Number.isFinite(previewBottom)
    || cardTops.length !== stepCount || stepCount < 1 || !(transitionFraction > 0)
    || !cardTops.every(Number.isFinite)) return { index: 0, progress: 0 };
  const starts = cardTops.map((top) => top - previewBottom);
  starts.push(Math.max(starts[stepCount - 1] + 1, containerBottom - previewBottom));
  const scene = getSceneAt(position, starts);
  return { index: scene.index, progress: clamp(scene.progress / transitionFraction, 0, 1) };
}

export function getFocusedDecision(titleRects, viewportHeight) {
  return getDecisionPlayback(titleRects, viewportHeight).focused;
}

export function getDecisionPlayback(titleRects, viewportHeight) {
  if (!Array.isArray(titleRects) || !Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return { focused: null, index: 0, progress: 0 };
  }
  const enterLine = viewportHeight * 2 / 3;
  const exitLine = viewportHeight / 4;
  let index = 0;
  let entered = false;
  let focused = null;
  titleRects.forEach((rect, candidate) => {
    if (!Number.isFinite(rect?.top) || rect.top > enterLine) return;
    entered = true;
    index = candidate;
    if (rect.top > exitLine) focused = candidate;
  });
  if (!entered) return { focused: null, index: 0, progress: 0 };
  const nextTop = titleRects[index + 1]?.top;
  const distance = Number.isFinite(nextTop)
    ? Math.min(enterLine - exitLine, Math.max(1, nextTop - titleRects[index].top))
    : enterLine - exitLine;
  return {
    focused,
    index,
    progress: clamp((enterLine - titleRects[index].top) / distance, 0, 1),
  };
}

export function getPinnedOverviewScene(position, pinStart, nextStart, releaseEnd) {
  if (![position, pinStart, nextStart, releaseEnd].every(Number.isFinite)
    || !(pinStart < nextStart && pinStart < releaseEnd)) return { index: 0, progress: 0 };
  const latestSecondStart = pinStart + (releaseEnd - pinStart) * .65;
  return getSceneAt(position, [pinStart, Math.min(nextStart, latestSecondStart), releaseEnd]);
}

export function getStickyEntryOffset(distance, centeredOffset, travel = 240) {
  if (![distance, centeredOffset, travel].every(Number.isFinite) || distance <= 0 || centeredOffset <= 0 || travel <= 0) return 0;
  return -centeredOffset * clamp(distance / travel, 0, 1);
}

export function getFadeInsets(stage, artwork, horizontalLimit = Infinity) {
  const width = stage.right - stage.left;
  const height = stage.bottom - stage.top;
  if (!(width > 0 && height > 0) || !artwork.length) return null;
  const overflowX = Math.max(0, ...artwork.flatMap((rect) => [stage.left - rect.left, rect.right - stage.right]));
  const overflowY = Math.max(0, ...artwork.flatMap((rect) => [stage.top - rect.top, rect.bottom - stage.bottom]));
  if (overflowX <= 1 && overflowY <= 1) return null;
  return {
    x: Math.min(Math.max(width * .25, overflowX + width * .12), horizontalLimit),
    y: Math.max(height * .25, overflowY + height * .12),
  };
}

export function readDiveStep(href, dive = 'cohesion', stepCount = 4) {
  const params = new URL(href).searchParams;
  if (params.get('dive') !== dive) return null;
  const step = params.get('step');
  const number = Number(step);
  return Number.isInteger(number) && number >= 1 && number <= stepCount ? number - 1 : 0;
}

export function withDiveStep(href, index, dive = 'cohesion', stepCount = 4) {
  const url = new URL(href);
  if (index === null) {
    url.searchParams.delete('dive');
    url.searchParams.delete('step');
  } else {
    const valid = Number.isInteger(index) && index >= 0 && index < stepCount;
    url.searchParams.set('dive', dive);
    url.searchParams.set('step', String(valid ? index + 1 : 1));
  }
  return url.href;
}

export function shouldExitOnScroll({ scrollTop, scrollHeight, clientHeight, deltaY, blocked = false }) {
  if (blocked || ![scrollTop, scrollHeight, clientHeight, deltaY].every(Number.isFinite)) return false;
  return deltaY > 0 && clientHeight > 0 && scrollHeight > clientHeight
    && scrollTop >= scrollHeight - clientHeight - 1;
}

export function isScrollExitKey({ key, editable = false, activatesControl = false, modified = false }) {
  if (editable || modified || (key === ' ' && activatesControl)) return false;
  return ['ArrowDown', 'PageDown', 'End', ' '].includes(key);
}

export function getOverviewReleaseY({ containerBottom, previewHeight, stickyTop, maxScrollY }) {
  if (![containerBottom, previewHeight, stickyTop, maxScrollY].every(Number.isFinite)
    || previewHeight < 0 || maxScrollY < 0) return null;
  return clamp(containerBottom - previewHeight - stickyTop, 0, maxScrollY);
}

const mix = (a, b, p) => a + (b - a) * p;
const phase = (time, from, to) => {
  const p = clamp((time - from) / (to - from), 0, 1);
  return p * p * (3 - 2 * p);
};

export function getMotionTime(index, progress, reducedMotion = false) {
  const step = clamp(Number.isInteger(index) ? index : 0, 0, 3);
  return reducedMotion ? [.58, 1.99, 3, 3.8][step] : step + clamp(progress, 0, 1);
}

// Measurements are in Figma's 1x units, inside a 1440 x 1000 presentation stage.
export function getCohesionPose(value) {
  const t = clamp(Number.isFinite(value) ? value : 0, 0, 4);
  const lift = phase(t, .06, .55);
  const flatten = phase(t, .68, 1);
  const compact = phase(t, 1.58, 1.96);
  const detach = phase(t, 2.12, 2.42);
  const embed = phase(t, 2.4, 2.92);
  const focus = phase(t, 3.05, 3.55);
  const initialScale = .68 * .85 * .9;
  const accountCenterX = 470 + (.68 - initialScale) * 626 / Math.sqrt(2);
  const accountCenterY = 709 + (.68 - initialScale) * 14 / Math.sqrt(6);
  const baseX = mix(accountCenterX, 290, flatten) + 150 * compact;
  const baseY = mix(accountCenterY - 145 * lift, 52, flatten) + 210 * compact;
  const form = {
    x: mix(baseX, 1022.25, embed), y: mix(baseY, 262.45, embed),
    z: 75 * detach * (1 - embed),
    rx: 54.7356 * (1 - flatten), rz: -45 * (1 - flatten),
    scale: mix(mix(initialScale, 1.4, flatten), .85, embed),
    width: mix(612, 400, compact), height: mix(640, 338, compact),
  };
  const elevation = lift * (1 - flatten);
  return {
    form,
    shell: { ...form, x: baseX, y: baseY, z: 0, scale: mix(initialScale, 1.4, flatten) },
    shadowAnchors: { accountX: accountCenterX, accountY: accountCenterY, revitX: 468, revitY: 274 },
    shadow: { y: 24 + 42 * elevation, blur: 52 + 100 * elevation, spread: 12 + 40 * elevation, opacity: (.82 - .22 * elevation) * .8 },
    shellOpacity: 1 - phase(t, 2.22, 2.55), sourceOpacity: 1 - phase(t, .68, .97),
    listLift: 145 * lift, listOpacity: 1 - phase(t, .72, .97),
    cadOpacity: 1 - phase(t, 1.22, 1.56), cadOffset: 0,
    fieldWidth: mix(mix(258, 372, compact), 323, embed),
    fieldY: [0, mix(142.43, 50.8, compact), mix(377.1, 120.43, compact)],
    retainedHighlight: phase(t, 1.62, 1.9) * (1 - phase(t, 2, 2.2)),
    bodyLift: detach * (1 - embed),
    settingsOpacity: phase(t, 2.25, 2.55), settingsOffset: 0,
    cameraScale: mix(1, 1.9, focus),
    cameraX: mix(0, -1125, focus),
    cameraY: mix(0, -505, focus),
    moduleHighlight: phase(t, 3.35, 3.72),
  };
}
