import { getSceneAt, getDecisionPlayback, getStickyEntryOffset, getMotionTime, readDiveStep, withDiveStep, shouldExitOnScroll, isScrollExitKey, getOverviewReleaseY } from './case-study-cohesion-state.js?v=preview-light-shadow-20261115';
import { createVisual as createCohesionVisual, scenes as cohesionScenes } from './case-study-cohesion-visuals.js?v=preview-light-shadow-20261115';

const stateObject = () => history.state && typeof history.state === 'object' ? history.state : {};
const deepDiveEnabled = false;
const createElement = (tag, className, html = '') => {
  const element = document.createElement(tag);
  element.className = className;
  element.innerHTML = html;
  return element;
};

function createMotionPlayer(visual) {
  let rendered = 0;
  let target = 0;
  let scene = 0;
  let frame = 0;
  let previousTimestamp = 0;

  function render(timestamp) {
    frame = 0;
    const elapsed = previousTimestamp ? Math.min(64, timestamp - previousTimestamp) : 16;
    previousTimestamp = timestamp;
    rendered += (target - rendered) * (1 - Math.exp(-elapsed / 65));
    if (Math.abs(target - rendered) < .0005) rendered = target;
    visual.paint(rendered, scene);
    if (rendered !== target) frame = requestAnimationFrame(render);
  }

  return {
    seek(time, index, immediate = false) {
      target = time;
      scene = index;
      if (immediate) {
        cancelAnimationFrame(frame);
        frame = 0;
        rendered = target;
        visual.paint(rendered, scene);
      } else if (!frame) {
        previousTimestamp = 0;
        frame = requestAnimationFrame(render);
      }
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTimestamp = 0;
    },
  };
}

export function createCaseStudyProcessController(frame, onNavigationChange, {
  id, title, scenes, createVisual, motionTime = getMotionTime,
  sourceLinksByStep = [], nextLinks = [], centerOverviewOnPin = false,
}) {
  const article = frame.querySelector('[data-goal-takeover]');
  const steps = [...article.querySelectorAll('.goal-decision')];
  const cards = [...frame.querySelectorAll('.goal-decision-card')];
  if (steps.length !== scenes.length || cards.length !== scenes.length) {
    throw new Error(`${title} needs one scene, card, and decision section per step.`);
  }
  const historyKey = `caseStudy${id[0].toUpperCase()}${id.slice(1)}`;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 900px)');
  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let currentStep = 0;
  let savedPage = null;
  let savedEditor = null;
  let returnFocus = null;
  let pendingNext = null;
  let awaitingBack = false;
  let closePromise = null;
  let transition = null;
  let transitionVersion = 0;
  let anchors = [];
  let scrollFrame = 0;
  let scrollExit = null;
  let touchPoint = null;

  frame.classList.add('co-frame');
  const overview = createElement('div', 'co-overview');
  const preview = createVisual({ horizontalBleedLimit: 48 });
  const previewPlayer = createMotionPlayer(preview);
  overview.append(preview.element);
  const overviewGrid = frame.querySelector('.goal-overview-grid');
  overviewGrid.querySelector('.goal-overview-visual').remove();
  overviewGrid.prepend(overview);

  const dialog = createElement('dialog', `co-reader co-reader-${id}`);
  dialog.setAttribute('aria-labelledby', `${id}-reader-title`);
  const header = createElement('header', 'co-reader-header', `
    <div class="co-reader-top"><h2 class="co-reader-title" id="${id}-reader-title">${title} / Inside the decisions</h2><button class="co-return" type="button" data-co-close autofocus>&larr; Back to overview</button></div>
    <nav class="co-step-nav" aria-label="${title} steps">${scenes.map((scene, index) => `<button type="button" data-step="${index}">${index + 1} ${scene.title}</button>`).join('')}</nav>
    <span class="co-reader-progress" aria-hidden="true"></span>`);
  const viewport = createElement('div', 'co-reading-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', `Scroll to explore the ${title} decisions`);
  const grid = createElement('div', 'co-reading-grid');
  const stage = createElement('div', 'co-motion-stage');
  const stageLabel = createElement('p', 'co-stage-eyebrow', `1 / ${scenes[0].title}`);
  const visual = createVisual();
  const readerPlayer = createMotionPlayer(visual);
  stage.append(stageLabel, visual.element);
  article.before(dialog);
  article.removeAttribute('aria-hidden');
  grid.append(stage, article);
  viewport.append(grid);
  dialog.append(header, viewport);

  steps.forEach((step, index) => {
    step.prepend(createElement('span', 'co-step-number', `${index + 1} / ${scenes[index].title}`));
    step.querySelectorAll('.case-figure').forEach((figure) => {
      const evidence = createElement('details', 'co-source-evidence', '<summary>View the original project illustration</summary>');
      figure.before(evidence);
      evidence.append(figure);
      evidence.addEventListener('toggle', scheduleScrollUpdate);
    });
    const references = sourceLinksByStep[index] || [];
    if (references.length) {
      const sourceLinks = createElement('div', 'co-source-links');
      references.forEach(([file, label]) => {
        const link = document.createElement('a');
        link.href = new URL(file, import.meta.url).href;
        link.textContent = `${label} (2x)`;
        link.target = '_blank';
        link.rel = 'noopener';
        sourceLinks.append(link);
      });
      step.querySelector('.subsection-content').append(sourceLinks);
    }
  });
  const ending = createElement('section', 'co-end', `<h3>Where to next?</h3><p>Keep scrolling to continue from the end of ${title}'s overview, or choose another part of the project.</p><button type="button" data-co-close>Return to overview &rarr;</button>${nextLinks.map(([target, label]) => `<a href="#${target}">${label} &rarr;</a>`).join('')}`);
  article.append(ending);

  cards.forEach((card) => {
    const button = card.querySelector('button[data-goal-target]');
    const staticCard = createElement('div', 'goal-decision-static');
    staticCard.replaceChildren(...button.childNodes);
    button.replaceWith(staticCard);
  });
  const titles = cards.map((card) => card.querySelector('.goal-decision-copy > .type-detail'));

  function syncOverview() {
    if (dialog.open) return;
    const editing = document.documentElement.dataset.copyEditing === 'true';
    const playback = getDecisionPlayback(titles.map((title) => ({ top: title.getBoundingClientRect().top })), window.innerHeight);
    cards.forEach((card, index) => { card.dataset.current = String(!editing && index === playback.focused); });
    if (editing) return;
    const top = Number.parseFloat(getComputedStyle(overview).top) || 0;
    const gridTop = overviewGrid.getBoundingClientRect().top;
    if (centerOverviewOnPin) {
      const visualRect = preview.element.getBoundingClientRect();
      const centeredOffset = Math.max(0, (visualRect.height - visualRect.width * 1000 / 1440) / 2);
      overview.style.transform = `translateY(${getStickyEntryOffset(gridTop - top, centeredOffset)}px)`;
    }
    const { index, progress } = playback;
    const time = index === 0 && progress <= 0 ? 0 : motionTime(index, progress, reducedMotion.matches);
    previewPlayer.seek(time, index, true);
  }

  function measure() {
    if (!dialog.open) return;
    const top = viewport.getBoundingClientRect().top;
    const inset = mobile.matches ? stage.getBoundingClientRect().height : 0;
    anchors = [...steps, ending].map((step) => step.getBoundingClientRect().top - top + viewport.scrollTop - inset);
    dialog.style.setProperty('--co-header', `${header.getBoundingClientRect().height}px`);
  }

  function selectStep(index) {
    currentStep = index;
    header.querySelectorAll('[data-step]').forEach((button, i) => {
      if (i === index) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    stageLabel.textContent = `${index + 1} / ${scenes[index].title}`;
    if (readDiveStep(location.href, id, scenes.length) !== index) history.replaceState(stateObject(), '', withDiveStep(location.href, index, id, scenes.length));
    onNavigationChange();
  }

  function syncScroll(immediate = false) {
    if (!dialog.open || closePromise || awaitingBack || document.documentElement.dataset.copyEditing === 'true') return;
    measure();
    const { index, progress } = getSceneAt(viewport.scrollTop, anchors);
    if (index !== currentStep) selectStep(index);
    const targetTime = motionTime(index, progress, reducedMotion.matches);
    header.style.setProperty('--co-progress', String((index + progress) / scenes.length));
    readerPlayer.seek(targetTime, index, immediate || reducedMotion.matches);
  }

  function scheduleScrollUpdate() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      syncScroll();
    });
  }

  function jumpToStep(index) {
    measure();
    viewport.scrollTo({ top: Math.max(0, Math.ceil(anchors[index])), behavior: 'instant' });
    selectStep(index);
    readerPlayer.seek(motionTime(index, 0, reducedMotion.matches), index, true);
    syncScroll(true);
  }

  function lockPage() {
    savedPage = {
      x: scrollX, y: scrollY, restoration: history.scrollRestoration,
      scrollBehavior: document.documentElement.style.scrollBehavior,
      body: Object.fromEntries(['position', 'top', 'left', 'width'].map((key) => [key, document.body.style[key]])),
    };
    history.scrollRestoration = 'manual';
    document.documentElement.style.scrollBehavior = 'auto';
    document.documentElement.classList.add('co-reading');
    Object.assign(document.body.style, { position: 'fixed', top: `${-savedPage.y}px`, left: `${-savedPage.x}px`, width: '100%' });
    const editor = document.querySelector('[data-copy-edit-panel]');
    if (editor) {
      savedEditor = { editor, parent: editor.parentNode, next: editor.nextSibling };
      dialog.append(editor);
    }
  }

  function unlockPage() {
    if (savedEditor) {
      savedEditor.parent.insertBefore(savedEditor.editor, savedEditor.next);
      savedEditor = null;
    }
    document.documentElement.classList.remove('co-reading');
    Object.assign(document.body.style, savedPage.body);
    window.scrollTo({ left: savedPage.x, top: scrollExit ? scrollExit.y : savedPage.y, behavior: 'instant' });
    document.documentElement.style.scrollBehavior = savedPage.scrollBehavior;
    history.scrollRestoration = savedPage.restoration;
    if (scrollExit) {
      // Keep keyboard scrolling on the page, rather than focusing a button that reopens the dive.
      frame.tabIndex = -1;
      frame.focus({ preventScroll: true });
      scrollExit = null;
    } else returnFocus?.focus({ preventScroll: true });
    if (pendingNext) {
      const destination = document.getElementById(pendingNext);
      const url = new URL(location.href);
      url.hash = pendingNext;
      history.replaceState(stateObject(), '', url);
      destination?.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
      pendingNext = null;
    }
    savedPage = null;
    onNavigationChange();
    syncOverview();
  }

  function open(targetId, fromHistory = false) {
    if (!deepDiveEnabled) return;
    const index = Math.max(0, steps.findIndex((step) => step.id === targetId));
    const wasOpen = dialog.open;
    transitionVersion += 1;
    transition?.cancel();
    if (scrollExit && savedPage) document.body.style.top = `${-savedPage.y}px`;
    scrollExit = null;
    touchPoint = null;
    closePromise = null;
    awaitingBack = false;
    if (!dialog.open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : cards[index].querySelector('button');
      lockPage();
      if (!fromHistory) history.pushState({ ...stateObject(), [historyKey]: sessionId }, '', withDiveStep(location.href, index, id, scenes.length));
      frame.dataset.expanded = 'true';
      frame.dataset.state = 'open';
      dialog.showModal();
      if (!reducedMotion.matches) transition = dialog.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: 480, easing: 'cubic-bezier(.22,.8,.22,1)' });
    }
    jumpToStep(index);
    if (!wasOpen) viewport.focus({ preventScroll: true });
  }

  function closeView() {
    if (!dialog.open) return Promise.resolve();
    if (closePromise) return closePromise;
    const version = ++transitionVersion;
    transition?.cancel();
    readerPlayer.stop();
    closePromise = (async () => {
      if (!reducedMotion.matches) {
        transition = dialog.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }], { duration: 320, easing: 'cubic-bezier(.4,0,.8,.3)', fill: 'forwards' });
        try { await transition.finished; } catch (error) { if (error.name !== 'AbortError') throw error; }
      }
      if (version !== transitionVersion) return;
      dialog.close();
      transition?.cancel();
      frame.dataset.expanded = 'false';
      frame.dataset.state = 'closed';
      unlockPage();
      closePromise = null;
      awaitingBack = false;
    })();
    return closePromise;
  }

  function close(next = null) {
    if (!dialog.open || awaitingBack || closePromise) return;
    pendingNext = next;
    if (stateObject()[historyKey] === sessionId && history.length > 1) {
      awaitingBack = true;
      history.back();
    } else {
      history.replaceState(stateObject(), '', withDiveStep(location.href, null, id, scenes.length));
      void closeView();
    }
  }

  function exitWithScroll(event, deltaY) {
    if (!dialog.open || !savedPage || event.defaultPrevented || !Number.isFinite(deltaY)
      || document.documentElement.dataset.copyEditing === 'true') return;
    if (scrollExit) {
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (!shouldExitOnScroll({
      scrollTop: viewport.scrollTop, scrollHeight: viewport.scrollHeight,
      clientHeight: viewport.clientHeight, deltaY, blocked: awaitingBack || Boolean(closePromise),
    })) return;
    const previewStyle = getComputedStyle(overview);
    const sticky = previewStyle.display !== 'none' && previewStyle.position === 'sticky';
    const y = getOverviewReleaseY({
      containerBottom: overviewGrid.getBoundingClientRect().bottom + savedPage.y,
      previewHeight: sticky ? overview.getBoundingClientRect().height : window.innerHeight,
      stickyTop: sticky ? Number.parseFloat(previewStyle.top) : 0,
      maxScrollY: Math.max(0, document.body.scrollHeight - window.innerHeight),
    });
    if (y === null) {
      console.error(`${title} scroll exit could not measure the overview. Use Back to overview.`);
      return;
    }
    if (event.cancelable) event.preventDefault();
    scrollExit = { y };
    previewPlayer.seek(scenes.length, scenes.length - 1, true);
    // Position the still-locked page underneath the dialog before revealing it.
    document.body.style.top = `${-y}px`;
    close();
  }

  header.querySelectorAll('[data-step]').forEach((button, index) => button.addEventListener('click', () => jumpToStep(index)));
  dialog.querySelectorAll('[data-co-close]').forEach((button) => button.addEventListener('click', () => close()));
  ending.querySelectorAll('a').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    close(link.hash.slice(1));
  }));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  viewport.addEventListener('wheel', (event) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
    exitWithScroll(event, event.deltaY * unit);
  }, { passive: false });
  viewport.addEventListener('touchstart', (event) => {
    touchPoint = event.touches.length === 1 ? event.touches[0] : null;
  }, { passive: true });
  viewport.addEventListener('touchmove', (event) => {
    const previous = touchPoint;
    touchPoint = event.touches.length === 1 ? event.touches[0] : null;
    if (!previous || !touchPoint) return;
    const deltaY = previous.clientY - touchPoint.clientY;
    if (Math.abs(previous.clientX - touchPoint.clientX) <= Math.abs(deltaY)) exitWithScroll(event, deltaY);
  }, { passive: false });
  viewport.addEventListener('touchend', () => { touchPoint = null; }, { passive: true });
  viewport.addEventListener('touchcancel', () => { touchPoint = null; }, { passive: true });
  viewport.addEventListener('keydown', (event) => {
    if (isScrollExitKey({
      key: event.key,
      modified: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
      editable: Boolean(event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')),
      activatesControl: Boolean(event.target.closest('button, summary, [role="button"]')),
    })) exitWithScroll(event, 1);
  });
  viewport.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
  const resize = new ResizeObserver(scheduleScrollUpdate);
  resize.observe(article);
  resize.observe(stage);
  reducedMotion.addEventListener('change', () => { syncScroll(true); syncOverview(); });
  mobile.addEventListener('change', () => { if (dialog.open) jumpToStep(currentStep); else syncOverview(); });
  new MutationObserver(() => { syncScroll(true); syncOverview(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-copy-editing'] });
  window.addEventListener('popstate', () => {
    const index = readDiveStep(location.href, id, scenes.length);
    if (!deepDiveEnabled) {
      if (index !== null) history.replaceState(stateObject(), '', withDiveStep(location.href, null, id, scenes.length));
      return;
    }
    if (index === null) void closeView();
    else {
      if (!dialog.open) frame.closest('[data-chapter]')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      open(steps[index].id, true);
    }
  });
  window.addEventListener('scroll', () => {
    if (!dialog.open) syncOverview();
  }, { passive: true });
  window.addEventListener('resize', syncOverview, { passive: true });
  const overviewResize = new ResizeObserver(syncOverview);
  overviewResize.observe(overviewGrid);
  overviewResize.observe(overview);
  cards.forEach((card) => overviewResize.observe(card));

  frame.addEventListener('error', (event) => {
    if (!(event.target instanceof HTMLImageElement) || !event.target.closest('.co-visual') || frame.querySelector('.co-reader-error')) return;
    const error = createElement('p', 'co-reader-error', 'A source image could not load. The original project illustrations are available below each decision.');
    error.setAttribute('role', 'alert');
    stage.prepend(error);
  }, true);

  // Run after the existing copy editor has captured its stable document-order keys.
  requestAnimationFrame(() => {
    const index = readDiveStep(location.href, id, scenes.length);
    if (!deepDiveEnabled) {
      if (index !== null) history.replaceState(stateObject(), '', withDiveStep(location.href, null, id, scenes.length));
      syncOverview();
      return;
    }
    if (index !== null) frame.closest('[data-chapter]')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    syncOverview();
    if (index !== null) open(steps[index].id, true);
  });
  return { open, close };
}

export function createCohesionController(frame, onNavigationChange) {
  return createCaseStudyProcessController(frame, onNavigationChange, {
    id: 'cohesion',
    title: 'Cohesion',
    scenes: cohesionScenes,
    createVisual: createCohesionVisual,
    centerOverviewOnPin: true,
    sourceLinksByStep: [
      [['assets/cohesion/parameter-list.png', 'Original parameter list'], ['assets/cohesion/parameter-modal.png', 'Original creation modal']],
      [['assets/cohesion/create-original.png', 'Before adaptation'], ['assets/cohesion/create-adapted.png', 'After adaptation']],
      [['assets/cohesion/acc-settings.png', 'ACC settings and side panel']],
      [['assets/cohesion/acc-settings.png', 'Full side-panel source']],
    ],
    nextLinks: [['reuse-before-creation', 'Data standardization'], ['standards-governance', 'Governance']],
  });
}
