const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const phase = (time, from, to) => {
  const progress = clamp((time - from) / (to - from), 0, 1);
  return progress * progress * (3 - 2 * progress);
};
const mix = (start, end, progress) => start + (end - start) * progress;
const modalAspect = 346 / 402;

export function getStandardizationMotionTime(index, progress, reducedMotion = false) {
  const step = clamp(Number.isInteger(index) ? index : 0, 0, 1);
  if (reducedMotion) return [.92, 1.9][step];
  const position = clamp(Number.isFinite(progress) ? progress : 0, 0, 1);
  return step === 0 ? position * 1.16 : 1.16 + position * .84;
}

export function getStandardizationPose(value) {
  const time = clamp(Number.isFinite(value) ? value : 0, 0, 2);
  const inserted = phase(time, .34, .7);
  const noteExit = phase(time, .98, 1.16);
  const modalOpacity = phase(time, 1.02, 1.16);
  const modalTravel = phase(time, .93, 1.25);

  return {
    flowOpacity: 1 - noteExit,
    inserted,
    noteOpacity: phase(time, .35, .5),
    headingBeforeOpacity: 1 - phase(time, .28, .44),
    headingAfterOpacity: phase(time, .62, .78),
    createShift: 220 * inserted,
    noteDropY: -45 * (1 - inserted),
    noteEnterX: 560 * (1 - inserted),
    noteRotate: -10 + 12 * inserted,
    noteTapeOpacity: phase(time, .57, .76),
    selectionSticker: phase(time, .57, .79),
    flowExitX: -115 * noteExit,
    modalOpacity,
    modalTravel,
    typing: clamp((time - 1.23) / .25, 0, 1),
    conceptOpacity: phase(time, 1.17, 1.25),
    suggestion: phase(time, 1.50, 1.64),
  };
}

export function getStandardizationModalGeometry(pose, overviewStep, resolutionLimit = Infinity) {
  const step = Number.isFinite(overviewStep) && overviewStep > 0 ? overviewStep : 220;
  const travel = clamp(pose.modalTravel, 0, 1);
  const sourceTop = step + 139 + step * pose.inserted;
  const sourceHeight = Math.min(460 / modalAspect, Math.max(170, step - 130));
  const limit = Number.isFinite(resolutionLimit) && resolutionLimit > 0 ? resolutionLimit : Infinity;
  const targetHeight = Math.min(1000, limit, Math.max(1, step * 4 - 96));
  const height = mix(sourceHeight, targetHeight, travel);
  return {
    left: mix(450, 686 - targetHeight * modalAspect / 2, travel),
    top: mix(sourceTop, (1000 - targetHeight) / 2, travel),
    width: height * modalAspect,
    height,
    rotation: .5 * (1 - travel),
  };
}

export function getStandardizationFitTop(pose, height, scale, overview) {
  if (![height, scale].every(Number.isFinite) || height <= 0 || scale <= 0) return 0;
  const centered = (height - 1000 * scale) / 2;
  return overview ? centered * clamp(pose.modalTravel, 0, 1) : Math.max(0, centered);
}
