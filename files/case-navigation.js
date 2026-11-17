(() => {
  const rail = document.querySelector('.rail');
  if (!rail) return;
  const compact = matchMedia('(max-width: 760px)');
  let active;
  const revealActive = () => {
    if (!compact.matches) return;
    const current = rail.querySelector('a[aria-current="location"]');
    if (!current || current === active) return;
    active = current;
    const bounds = rail.getBoundingClientRect();
    const item = current.getBoundingClientRect();
    if (item.left < bounds.left || item.right > bounds.right) {
      rail.scrollLeft += item.left - bounds.left - (bounds.width - item.width) / 2;
    }
  };
  new MutationObserver(revealActive).observe(rail, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  addEventListener('resize', () => { active = null; revealActive(); });
  revealActive();
})();
