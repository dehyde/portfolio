import { getStandardizationPose, getStandardizationModalGeometry, getStandardizationFitTop } from './case-study-standardization-state.js?v=create-field-4x-20261115';

const assetRoot = new URL('assets/standardization/', import.meta.url).href;
// Reveal the text from the exported Name field without redrawing its type.
const nameRevealEdges = [0, 33, 41, 48, 51, 59, 65, 72, 79, 82, 89, 96, 103, 110, 118, 122, 132];

export const scenes = [
  {
    title: 'Select before creating',
    note: 'We inserted selection before creation, so a matching definition could go straight into the module.',
  },
  {
    title: 'Check for duplicates',
    note: 'Proposed: typing "Approved vendors" reveals similar existing fields before saving.',
  },
];

export function createVisual() {
  const element = document.createElement('div');
  element.className = 'co-visual st-visual';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', scenes[0].note);
  element.innerHTML = `
    <div class="st-fit" aria-hidden="true">
      <div class="st-board">
        <div class="st-board-heading">
          <span class="st-heading-before">THE EXISTING PATH</span>
          <span class="st-heading-after">SELECTION BEFORE CREATION</span>
        </div>
        <span class="st-link st-link-first"></span>
        <span class="st-link st-link-inserted"></span>
        <span class="st-link st-link-last"></span>
        <div class="st-note st-note-list">
          <span class="st-note-tape"></span>
          <strong>list of applied custom fields</strong>
          <img class="st-note-wireframe" src="${assetRoot}module-fields.png" width="1646" height="1044" alt="" decoding="async" draggable="false">
        </div>
        <div class="st-note st-note-select">
          <span class="st-note-tape"></span>
          <strong>Select from preexisting</strong>
          <img class="st-note-wireframe" src="${assetRoot}select-existing.png" width="1156" height="789" alt="" decoding="async" draggable="false">
        </div>
        <div class="st-note st-note-create">
          <span class="st-note-tape"></span>
          <strong>Create new field</strong>
        </div>
        <div class="st-note st-note-return">
          <span class="st-note-tape"></span>
          <strong>New field added to list</strong>
          <img class="st-note-wireframe" src="${assetRoot}module-fields.png" width="1646" height="1044" alt="" decoding="async" draggable="false">
        </div>
        <div class="st-sticker st-sticker-list">
          <img src="${assetRoot}module-fields.png" width="1646" height="1044" alt="" decoding="async" draggable="false">
          <span>Module field settings</span>
        </div>
        <div class="st-sticker st-sticker-select">
          <img src="${assetRoot}select-existing.png" width="1156" height="789" alt="" decoding="async" draggable="false">
          <span>Existing definitions</span>
        </div>
        <div class="st-sticker st-sticker-create">
          <img src="${assetRoot}create-field-empty-4x.png" width="346" height="402" alt="" decoding="async" draggable="false">
          <span>New field form</span>
        </div>
      </div>
      <div class="st-create-window">
        <img class="st-create-base" src="${assetRoot}create-field-empty-4x.png" width="346" height="402" alt="" decoding="async" draggable="false">
        <img class="st-typed-name" src="${assetRoot}create-field-typed-4x.png" width="346" height="402" alt="" decoding="async" draggable="false">
        <img class="st-suggestion" src="${assetRoot}create-field-dropdown-4x.png" width="328" height="142" alt="" decoding="async" draggable="false">
        <span class="st-concept">PROPOSED · NOT SHIPPED</span>
      </div>
      <p class="st-wireframe-note">Flow illustration based on project wireframes</p>
    </div>`;

  const find = (selector) => element.querySelector(selector);
  const nodes = {
    fit: find('.st-fit'),
    board: find('.st-board'),
    headingBefore: find('.st-heading-before'),
    headingAfter: find('.st-heading-after'),
    noteSelect: find('.st-note-select'),
    noteTape: find('.st-note-select .st-note-tape'),
    noteCreate: find('.st-note-create'),
    noteReturn: find('.st-note-return'),
    linkInserted: find('.st-link-inserted'),
    linkLast: find('.st-link-last'),
    stickerSelect: find('.st-sticker-select'),
    stickerCreate: find('.st-sticker-create'),
    createWindow: find('.st-create-window'),
    typedName: find('.st-typed-name'),
    suggestion: find('.st-suggestion'),
    concept: find('.st-concept'),
    note: find('.st-wireframe-note'),
  };
  let lastTime = 0;
  let lastScene = 0;
  let overviewStep = 220;
  let fitHeight = 0;
  let fitScale = 1;
  nodes.createWindow.querySelector('.st-create-base').addEventListener('load', () => paint(lastTime, lastScene));

  function paint(time, scene = Math.min(1, Math.floor(time))) {
    lastTime = time;
    lastScene = scene;
    const pose = getStandardizationPose(time);
    const overview = Boolean(element.closest('.co-overview'));
    const noteShift = overview ? pose.inserted * overviewStep : pose.createShift;
    if (element.dataset.scene !== String(scene)) {
      element.dataset.scene = String(scene);
      element.setAttribute('aria-label', scenes[scene].note);
    }
    nodes.board.style.opacity = pose.flowOpacity;
    nodes.board.style.transform = `translateX(${pose.flowExitX}px)`;
    nodes.headingBefore.style.opacity = pose.headingBeforeOpacity;
    nodes.headingAfter.style.opacity = pose.headingAfterOpacity;
    nodes.noteSelect.style.opacity = pose.noteOpacity;
    nodes.noteSelect.style.transform = `translate(${pose.noteEnterX}px,${pose.noteDropY}px) rotate(${pose.noteRotate}deg) scale(${.92 + .08 * pose.inserted})`;
    nodes.noteTape.style.opacity = pose.noteTapeOpacity;
    nodes.noteCreate.style.transform = `translateY(${noteShift}px) rotate(-1deg)`;
    nodes.noteReturn.style.transform = `translateY(${noteShift}px) rotate(1.5deg)`;
    nodes.linkInserted.style.opacity = pose.inserted;
    nodes.linkLast.style.transform = `translateY(${noteShift}px)`;
    nodes.stickerSelect.style.opacity = pose.selectionSticker;
    nodes.stickerSelect.style.transform = `translate(${pose.noteEnterX * .35}px,${pose.noteDropY * .32}px) rotate(3deg)`;
    nodes.stickerCreate.style.transform = `translateY(${pose.createShift}px) rotate(-3deg)`;
    if (overview) {
      const resolutionLimit = nodes.createWindow.querySelector('.st-create-base').naturalHeight / (fitScale * window.devicePixelRatio);
      const geometry = getStandardizationModalGeometry(pose, overviewStep, resolutionLimit);
      nodes.createWindow.style.transform = `translate3d(${geometry.left}px,${geometry.top}px,0) rotate(${geometry.rotation}deg) scale(${geometry.width / 346})`;
      nodes.concept.style.transform = `scale(${346 / geometry.width})`;
      nodes.createWindow.style.opacity = '1';
    } else {
      nodes.createWindow.style.opacity = pose.modalOpacity;
    }
    const fitTop = getStandardizationFitTop(pose, fitHeight, fitScale, overview);
    nodes.fit.style.transform = `translate3d(0,${fitTop}px,0) scale(${fitScale})`;
    const revealEdge = nameRevealEdges[Math.floor(pose.typing * (nameRevealEdges.length - 1))];
    nodes.typedName.style.setProperty('--st-name-reveal', `${revealEdge / 346 * 100}%`);
    nodes.suggestion.style.opacity = pose.suggestion;
    nodes.suggestion.style.transform = `translateY(${(1 - pose.suggestion) * -5}%)`;
    nodes.concept.style.opacity = pose.conceptOpacity;
    nodes.note.style.opacity = Math.max(pose.flowOpacity, pose.modalOpacity);
  }

  new ResizeObserver(([entry]) => {
    const overview = Boolean(element.closest('.co-overview'));
    const scale = entry.contentRect.width / (overview ? 1200 : 1440);
    fitHeight = entry.contentRect.height;
    fitScale = scale;
    overviewStep = overview ? entry.contentRect.height / scale / 4 : 220;
    element.style.setProperty('--st-step', `${overviewStep}px`);
    nodes.fit.style.left = overview ? `${-86 * scale}px` : '0';
    paint(lastTime, lastScene);
  }).observe(element);
  paint(0);
  return { element, paint };
}
