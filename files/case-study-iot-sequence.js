const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value * value * (3 - 2 * value);
const mix = (from, to, amount) => from + (to - from) * amount;

export function getMaintenanceSequenceState(progress) {
  const phase = Number.isFinite(progress) ? Math.max(0, progress) : 0;
  const handoff = clamp((phase - 5.4) / 1.6);
  return {
    phase,
    visible: Math.min(6, Math.floor(phase) + 1),
    active: phase < 6.2 ? Math.min(5, Math.floor(phase)) : 0,
    lines: Array.from({ length: 5 }, (_, index) => clamp(phase - index)),
    lineOpacity: 1 - ease(clamp(handoff / .25)),
    rise: ease(handoff),
    spread: ease(clamp((handoff - .18) / .55)),
    fold: ease(clamp((handoff - .52) / .48)),
    heading: 1 - ease(clamp(handoff / .4)),
    setup: ease(clamp((handoff - .15) / .2)) * (1 - ease(clamp((handoff - .55) / .25))),
    complete: phase >= 7,
  };
}

// Pin the original cards to the viewport; their list items remain the scroll track.
export function createMaintenanceSequence({ model, workflow, beats, reduceMotion }) {
  const stage = workflow.querySelector('.workflow-stage');
  const display = workflow.querySelector('.workflow-display');
  const lead = beats.find(beat => beat.dataset.focus === 'iot-tab');
  const numbered = beats.filter(beat => /^[1-6]$/.test(beat.querySelector('.workflow-number')?.textContent.trim() ?? ''));
  const slots = [...model.querySelectorAll('.journey > li')];
  if (numbered.length !== 6 || slots.length !== 6 || !lead) {
    console.warn('Maintenance sequence: retaining the static model because the six-step markup is incomplete.');
    return { update() {}, measure() {}, getActiveStep: () => null, getScreenFocus: () => null };
  }

  const cards = numbered.map(beat => beat.querySelector('.guided-card'));
  const setup = lead.querySelector('.guided-card');
  const heading = model.querySelector('.section-heading');
  const journey = model.querySelector('.journey');
  const marker = document.createComment('Maintenance model location');
  model.before(marker);
  const originalStyles = new Map([...cards, setup, lead, display, model, heading].map(element => [element, element.getAttribute('style')]));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('sequence-connections');
  svg.setAttribute('aria-hidden', 'true');
  const paths = Array.from({ length: 5 }, () => {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('pathLength', '1');
    svg.append(path);
    return path;
  });
  model.append(svg);
  numbered.forEach(beat => { beat.dataset.sequenceNumber = ''; });

  let enabled = false;
  let metrics = [];
  let width = 0;
  let height = 0;
  let state = getMaintenanceSequenceState(0);
  let restored = false;
  let revealUnit = 0;
  let handoffDistance = 0;
  const restoreStyle = element => {
    const value = originalStyles.get(element);
    if (value === null) element.removeAttribute('style');
    else element.setAttribute('style', value);
  };

  function restoreCards() {
    cards.forEach((card, index) => {
      restoreStyle(card);
      numbered[index].removeAttribute('aria-hidden');
    });
    restoreStyle(setup);
    restored = true;
  }

  function measure() {
    if (!enabled) return;
    restoreCards();
    const currentPhase = workflow.getAttribute('data-sequence-phase');
    workflow.removeAttribute('data-sequence-phase');
    metrics = cards.map((card, index) => {
      const box = card.getBoundingClientRect();
      const beat = numbered[index].getBoundingClientRect();
      const text = getComputedStyle(card.querySelector('h3'));
      return { x: box.left - beat.left, y: box.top - beat.top, width: box.width, font: parseFloat(text.fontSize) };
    });
    if (currentPhase !== null) workflow.setAttribute('data-sequence-phase', currentPhase);
    width = workflow.clientWidth;
    height = innerHeight;
    revealUnit = Math.max(150, Math.min(230, height * .24));
    handoffDistance = Math.max(400, Math.min(800, height * .85));
    lead.style.minHeight = `${revealUnit * 5.4 + handoffDistance}px`;
    restored = false;
  }

  function setEnabled(next) {
    if (enabled === next) return;
    enabled = next;
    if (next) {
      workflow.dataset.sequence = '';
      stage.prepend(model);
      journey.setAttribute('aria-hidden', 'true');
      measure();
    } else {
      restoreCards();
      [lead, display, model, heading].forEach(restoreStyle);
      marker.after(model);
      journey.removeAttribute('aria-hidden');
      heading.removeAttribute('aria-hidden');
      workflow.removeAttribute('data-sequence');
      workflow.removeAttribute('data-sequence-phase');
      workflow.style.removeProperty('--sequence-fold');
    }
  }

  function update() {
    setEnabled(!reduceMotion.matches);
    if (!enabled) return;
    if (width !== workflow.clientWidth || height !== innerHeight) measure();
    const bounds = workflow.getBoundingClientRect();
    const pinTop = parseFloat(getComputedStyle(stage).top);
    const distance = Math.max(0, pinTop - bounds.top);
    const revealDistance = revealUnit * 5.4;
    const phase = distance <= revealDistance
      ? distance / revealUnit
      : 5.4 + (distance - revealDistance) / handoffDistance * 1.6;
    state = getMaintenanceSequenceState(phase);
    workflow.dataset.sequencePhase = state.complete ? 'walkthrough' : phase < 6.2 ? 'model' : 'handoff';
    workflow.style.setProperty('--sequence-fold', state.fold);
    heading.style.opacity = state.heading;
    heading.style.transform = `translateY(${-24 * (1 - state.heading)}px)`;
    heading.setAttribute('aria-hidden', String(state.heading === 0));
    svg.style.opacity = state.lineOpacity;
    display.style.transform = `translateY(${(height + stage.offsetHeight) * (1 - state.rise)}px)`;

    if (state.complete) {
      if (!restored) restoreCards();
      return;
    }
    restored = false;
    const compact = matchMedia('(max-width: 760px)').matches;
    const modelBounds = model.getBoundingClientRect();
    const sources = slots.map(slot => slot.getBoundingClientRect());
    const destinations = numbered.map(beat => beat.getBoundingClientRect());
    cards.forEach((card, index) => {
      const source = sources[index];
      const beat = destinations[index];
      const target = metrics[index];
      const x = mix(source.left, beat.left + target.x, state.fold);
      const y = mix(source.top, beat.top + target.y, state.spread);
      Object.assign(card.style, {
        // Avoid counter-scrolling absolute cards: native scrolling can outrun rAF.
        position: 'fixed', left: '0', top: '0', transform: `translate3d(${x}px, ${y}px, 0)`,
        width: `${mix(source.width, target.width, state.fold)}px`, maxWidth: 'none',
        margin: '0', padding: `${12 * state.fold}px`,
        opacity: index < state.visible ? '1' : '0',
        visibility: index < state.visible ? 'visible' : 'hidden',
      });
      card.style.setProperty('--sequence-font', `${mix(compact ? 12 : 15, target.font, state.fold)}px`);
      numbered[index].setAttribute('aria-hidden', String(index >= state.visible));
    });
    paths.forEach((path, index) => {
      const first = sources[index], second = sources[index + 1];
      const x1 = first.left - modelBounds.left + 22, y1 = first.top - modelBounds.top + 11;
      const x2 = second.left - modelBounds.left, y2 = second.top - modelBounds.top + 11;
      path.setAttribute('d', Math.abs(y1 - y2) < 1
        ? `M ${x1} ${y1} H ${x2}`
        : `M ${x1} ${y1} H ${modelBounds.width - 2} V ${y2 - 31} H ${x2 + 11} V ${y2 - 11}`);
      path.style.strokeDashoffset = 1 - state.lines[index];
    });
    const leadBounds = lead.getBoundingClientRect();
    const stageBounds = stage.getBoundingClientRect();
    Object.assign(setup.style, {
      position: 'absolute', left: '16px', top: `${stageBounds.top + 16 - leadBounds.top + (1 - state.setup) * 24}px`,
      margin: '0', maxWidth: '90%', opacity: state.setup,
      visibility: state.setup > 0 ? 'visible' : 'hidden',
    });
  }

  return {
    update,
    measure,
    getActiveStep: () => enabled && !state.complete && workflow.getBoundingClientRect().top < innerHeight
      ? numbered[state.active] : null,
    getScreenFocus: () => enabled && !state.complete ? state.setup > .1 ? 'iot-tab' : 'overview' : null,
  };
}
