(() => {
  const art = document.querySelector('.hero-art');
  const toggle = art.querySelector('.hero-motion-toggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let player = null;
  let timeline = null;
  let paused = false;

  function updateControl() {
    const label = paused ? 'Play illustration' : 'Pause illustration';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.toggleAttribute('data-paused', paused);
  }

  function showPoster() {
    art.removeAttribute('data-ready');
    toggle.hidden = true;
    timeline = null;
    player?.remove();
    player = null;
  }

  function applyMotionPreference() {
    if (reducedMotion.matches) {
      showPoster();
      return;
    }
    if (player) return;

    const object = document.createElement('object');
    player = object;
    object.type = 'image/svg+xml';
    object.tabIndex = -1;
    object.setAttribute('aria-hidden', 'true');
    object.addEventListener('load', () => {
      if (player !== object) return;
      const svg = object.contentDocument?.documentElement;
      if (typeof svg?.pauseAnimations !== 'function') {
        showPoster();
        return;
      }
      timeline = svg;
      if (paused) svg.pauseAnimations();
      art.setAttribute('data-ready', '');
      updateControl();
      toggle.hidden = false;
    }, { once: true });
    object.addEventListener('error', () => {
      if (player === object) showPoster();
    }, { once: true });
    object.data = art.dataset.animation;
    art.insertBefore(object, toggle);
  }

  toggle.addEventListener('click', () => {
    if (!timeline) return;
    paused = !paused;
    if (paused) timeline.pauseAnimations();
    else timeline.unpauseAnimations();
    updateControl();
  });

  reducedMotion.addEventListener('change', applyMotionPreference);
  applyMotionPreference();
})();
