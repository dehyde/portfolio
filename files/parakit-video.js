(() => {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if (reducedMotion.matches || typeof IntersectionObserver !== 'function') return;

  const threshold = 0.5;
  const inView = new Set();
  const stopped = new WeakSet();

  const observer = new IntersectionObserver(entries => {
    for (const { target: video, intersectionRatio } of entries) {
      if (intersectionRatio < threshold) {
        if (inView.delete(video)) {
          if (video.paused) stopped.add(video);
          video.pause();
        }
        continue;
      }

      inView.add(video);
      if (reducedMotion.matches || stopped.has(video) || !video.paused || video.ended) continue;

      video.muted = true;
      void video.play().catch(error => {
        video.dispatchEvent(new CustomEvent('parakit-playback-error', { detail: error }));
      });
    }
  }, { threshold });

  document.querySelectorAll('video').forEach(video => observer.observe(video));
})();
