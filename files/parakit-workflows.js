(() => {
  const section = document.querySelector('#workflows');
  if (!section) return;
  const panels = [...section.querySelectorAll('.workflow-comparison')];
  if (panels.length < 2) return;

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const story = document.createElement('div');
  story.className = 'workflow-story is-carousel';
  const stage = document.createElement('div');
  stage.className = 'workflow-stage';
  const header = section.querySelector('.chapter-head');
  const body = document.createElement('div');
  body.className = 'workflow-stage-body';
  const choices = document.createElement('div');
  choices.className = 'workflow-choices';
  const label = document.createElement('p');
  label.className = 'workflow-index-label';
  label.id = 'workflow-jobs-label';
  label.textContent = 'Jobs to be done';
  const index = document.createElement('div');
  index.className = 'workflow-index';
  index.setAttribute('role', 'tablist');
  index.setAttribute('aria-labelledby', label.id);
  index.setAttribute('aria-orientation', 'vertical');
  const indexWindow = document.createElement('div');
  indexWindow.className = 'workflow-index-window';
  indexWindow.append(index);
  choices.append(label, indexWindow);
  const connector = document.createElement('div');
  connector.className = 'workflow-connector';
  connector.setAttribute('aria-hidden', 'true');
  const viewport = document.createElement('div');
  viewport.className = 'workflow-window';
  const track = document.createElement('div');
  track.className = 'workflow-track';
  viewport.append(track);
  body.append(choices, connector, viewport);
  stage.append(header, body);
  panels[0].before(story);
  story.append(stage);
  section.classList.add('has-workflow-carousel');

  let active = -1;
  let pinned = true;
  let step = 1;
  let jobHeight = 1;
  let stickyTop = 0;
  let scheduled = false;
  let hasInteracted = false;

  const buttons = panels.map((panel, position) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `workflow-tab-${position + 1}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panel.id);
    const number = document.createElement('span');
    number.textContent = String(position + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    const job = document.createElement('span');
    job.textContent = panel.querySelector('.flow-origin p').textContent;
    button.append(number, job);
    index.append(button);
    track.append(panel);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    button.addEventListener('click', () => navigate(position));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowDown') next = (position + 1) % panels.length;
      if (event.key === 'ArrowUp') next = (position + panels.length - 1) % panels.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = panels.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].focus({ preventScroll: true });
      navigate(next);
    });
    return button;
  });

  function select(position) {
    if (position === active) return;
    const moveFocus = active >= 0 && panels[active].contains(document.activeElement);
    active = position;
    panels.forEach((panel, i) => {
      panel.inert = i !== active;
      panel.setAttribute('aria-hidden', String(i !== active));
      buttons[i].setAttribute('aria-selected', String(i === active));
      buttons[i].tabIndex = i === active ? 0 : -1;
    });
    if (moveFocus) buttons[active].focus({ preventScroll: true });
  }

  function render(position) {
    const progress = Math.max(0, Math.min(panels.length - 1, position));
    select(Math.min(panels.length - 1, Math.floor(progress + .00001)));
    panels.forEach((panel, i) => {
      buttons[i].style.opacity = i === active ? '1' : i < active - 1 ? '0' : '0.45';
      panel.hidden = reducedMotion.matches && i !== active;
      panel.style.opacity = i === active ? '1' : '0';
      panel.style.transform = reducedMotion.matches ? 'none' : `translate3d(0, ${Math.sign(i - active) * 36}px, 0)`;
    });
    index.style.transition = !pinned && !reducedMotion.matches ? 'transform 420ms ease-out' : 'none';
    index.style.transform = `translate3d(0, ${-(reducedMotion.matches ? active : progress) * jobHeight}px, 0)`;
    const bodyRect = body.getBoundingClientRect();
    const buttonRect = buttons[active].getBoundingClientRect();
    const targetRect = viewport.getBoundingClientRect();
    const start = buttonRect.top + buttonRect.height / 2 - bodyRect.top;
    const end = targetRect.top + 24 + 160 - bodyRect.top;
    connector.style.setProperty('--connector-top', `${Math.min(start, end)}px`);
    connector.style.setProperty('--connector-height', `${Math.abs(end - start)}px`);
    connector.classList.toggle('is-reversed', start > end);
    const stageRect = stage.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const choicesRect = choices.getBoundingClientRect();
    const bottom = Math.max(bodyRect.bottom, choicesRect.bottom);
    stage.style.setProperty('--workflow-background-top', `${headerRect.top - stageRect.top - 32}px`);
    stage.style.setProperty('--workflow-background-bottom', `${stageRect.bottom - bottom - 48}px`);
  }

  function measure() {
    stickyTop = parseFloat(getComputedStyle(stage).top) || 0;
    const available = innerHeight - stickyTop - 20;
    let tallest = 0;
    panels.forEach(panel => {
      panel.hidden = false;
      panel.style.height = 'auto';
      tallest = Math.max(tallest, panel.getBoundingClientRect().height);
    });
    const panelHeight = Math.ceil(tallest);
    story.style.setProperty('--workflow-panel-height', `${panelHeight}px`);
    panels.forEach(panel => { panel.style.removeProperty('height'); });
    jobHeight = buttons[0].getBoundingClientRect().height;
    choices.style.setProperty('--workflow-align', '0px');
    const indexTop = indexWindow.getBoundingClientRect().top;
    const flowCenter = viewport.getBoundingClientRect().top + 184;
    choices.style.setProperty('--workflow-align', `${flowCenter - indexTop - 1.5 * jobHeight}px`);
    const gap = parseFloat(getComputedStyle(stage).rowGap) || 36;
    const needed = header.getBoundingClientRect().height + body.getBoundingClientRect().height + gap;
    pinned = available >= needed;
    step = Math.max(300, innerHeight * .65);
    story.classList.toggle('is-static', !pinned);
    story.style.setProperty('--workflow-stage-height', `${Math.max(available, needed)}px`);
    story.style.height = `${pinned ? available + step * (panels.length - 1) : needed}px`;
  }

  function storyStart() {
    return story.getBoundingClientRect().top + scrollY - stickyTop;
  }

  function syncToScroll() {
    scheduled = false;
    render(pinned ? (scrollY - storyStart()) / step : Math.max(0, active));
  }

  function scheduleScroll() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(syncToScroll);
  }

  function navigate(position, fromHash = false) {
    if (pinned) {
      scrollTo({
        top: storyStart() + position * step,
        behavior: fromHash || reducedMotion.matches ? 'instant' : 'smooth',
      });
      if (fromHash || reducedMotion.matches) render(position);
    } else {
      render(position);
      if (fromHash) stage.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    if (!fromHash) history.replaceState(null, '', `#${panels[position].id}`);
  }

  function followHash() {
    const position = panels.findIndex(panel => `#${panel.id}` === location.hash);
    if (position < 0) return false;
    navigate(position, true);
    return true;
  }

  measure();
  if (!followHash()) syncToScroll();
  addEventListener('scroll', scheduleScroll, { passive: true });
  addEventListener('resize', () => { measure(); syncToScroll(); });
  addEventListener('hashchange', followHash);
  reducedMotion.addEventListener('change', () => { measure(); syncToScroll(); });
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(event => {
    addEventListener(event, () => { hasInteracted = true; }, { once: true, passive: true });
  });
  addEventListener('load', () => requestAnimationFrame(() => {
    if (!hasInteracted) followHash();
  }), { once: true });
  document.fonts?.ready.then(() => { measure(); syncToScroll(); });
})();
