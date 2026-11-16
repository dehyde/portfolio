export function getCollageProgress(top, height, viewportHeight, reducedMotion = false) {
  if (reducedMotion || ![top, height, viewportHeight].every(Number.isFinite) || height <= 0 || viewportHeight <= 0) return 0;
  return Math.max(-1, Math.min(1, (viewportHeight - 2 * top - height) / (viewportHeight + height)));
}

export function createCollageController(element) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  function update() {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty('--parallax', getCollageProgress(rect.top, rect.height, innerHeight, motion.matches).toFixed(4));
  }
  motion.addEventListener('change', update);
  update();
  return { update };
}
