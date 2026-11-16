const clamp = (value) => Math.min(1, Math.max(0, value));
const phase = (time, start, end) => clamp((time - start) / (end - start));

export function getGovernancePose(value, compact = false) {
  const time = Number.isFinite(value) ? Math.max(0, Math.min(3, value)) : 0;
  const privateOpacity = phase(time, .14, .76);
  const removalProgress = phase(time, 1.15, 1.58);
  const retainedOpacity = phase(time, 1.28, 1.76);
  const cuesOpacity = phase(time, 2.12, 2.52);
  const middleFocus = phase(time, 1, 1.8);
  const projectFocus = phase(time, 2, 2.7);

  return {
    accountOpacity: 1,
    projectOpacity: 1,
    privateOpacity,
    privateShift: 60 * (1 - privateOpacity),
    removalProgress,
    retainedOpacity,
    engineerOpacity: phase(time, 1.06, 1.45),
    cuesOpacity,
    cameraX: compact ? 0 : -22 * middleFocus + 12 * projectFocus,
    cameraY: compact ? 0 : -46 * middleFocus - 76 * projectFocus,
    cameraScale: compact ? 1 : 1 + .045 * middleFocus + .085 * projectFocus,
    accountFocus: 1 - .28 * middleFocus,
  };
}

export function getGovernanceMotionTime(index, progress, reducedMotion = false) {
  const step = Number.isInteger(index) ? Math.max(0, Math.min(2, index)) : 0;
  if (reducedMotion) return [.9, 1.9, 2.9][step];
  return step + clamp(Number.isFinite(progress) ? progress : 0);
}
