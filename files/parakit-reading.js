(() => {
  const rail = document.querySelector('.rail');
  const main = document.querySelector('main');
  const topbar = document.querySelector('.topbar');
  const progress = document.querySelector('.progress span');
  const chapters = [...main.querySelectorAll('.chapter')];
  const links = new Map([...rail.querySelectorAll('a')].map(link => [link.hash, link]));
  const compact = matchMedia('(max-width: 850px)');
  let activeLink = rail.querySelector('[aria-current]');
  let scheduled = false;

  function update() {
    scheduled = false;
    const maxScroll = document.documentElement.scrollHeight - innerHeight;
    const fraction = maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 1;
    progress.style.transform = `scaleX(${fraction})`;

    const readingLine = topbar.offsetHeight + Math.min(innerHeight * .24, 220);
    let activeIndex = 0;
    chapters.forEach((chapter, index) => {
      if (chapter.getBoundingClientRect().top <= readingLine) activeIndex = index;
    });
    if (fraction === 1) activeIndex = chapters.length - 1;
    chapters.forEach((chapter, index) => {
      links.get(`#${chapter.id}`)?.classList.toggle('read', index < activeIndex);
    });
    const link = links.get(`#${chapters[activeIndex].id}`);
    if (!link || link === activeLink) return;

    activeLink?.removeAttribute('aria-current');
    link.setAttribute('aria-current', 'location');
    activeLink = link;

    if (compact.matches) {
      const railBounds = rail.getBoundingClientRect();
      const linkBounds = link.getBoundingClientRect();
      rail.scrollLeft += linkBounds.left - railBounds.left - (railBounds.width - linkBounds.width) / 2;
    }
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(update);
  }

  addEventListener('scroll', scheduleUpdate, { passive: true });
  addEventListener('resize', scheduleUpdate);
  addEventListener('hashchange', scheduleUpdate);
  document.fonts?.ready.then(scheduleUpdate);
  scheduleUpdate();
})();
