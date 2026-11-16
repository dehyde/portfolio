import { getCohesionPose, getFadeInsets } from './case-study-cohesion-state.js?v=preview-light-shadow-20261115';

export const scenes = [
  { title: 'Reuse', note: 'Platform components, lifted from their original contexts.' },
  { title: 'Adapt', note: 'Name, Data type, Description. The shared core remains.' },
  { title: 'Embed', note: 'The same form body, embedded in the familiar ACC side panel.' },
  { title: 'Extend', note: 'A dedicated area for each module\'s own controls.' },
];

const assetRoot = new URL('assets/cohesion/', import.meta.url).href;
const sprite = (x, y, width, height, className = '') => `<span class="co-sprite ${className}" style="width:${width}px;height:${height}px;background-position:-${x + 8}px -${y + 8}px"></span>`;
const image = (name, width, height, className) => `<img class="${className}" src="${assetRoot}${name}" width="${width}" height="${height}" alt="" decoding="async" draggable="false">`;
const transform = (p) => `translate3d(${p.x}px,${p.y}px,${p.z}px) rotateX(${p.rx}deg) rotateZ(${p.rz}deg) scale(${p.scale})`;

export function createVisual({ horizontalBleedLimit = Infinity } = {}) {
  const element = document.createElement('div');
  element.className = 'co-visual';
  element.dataset.bleedLimited = String(Number.isFinite(horizontalBleedLimit));
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', scenes[0].note);
  element.innerHTML = `<div class="co-matte" aria-hidden="true"><div class="co-fit"><div class="co-camera">
    <div class="co-sources">
      ${image('revit.png', 937, 528, 'co-source co-source-revit')}
      ${image('account.png', 882, 536, 'co-source co-source-account')}
      <span class="co-origin co-origin-revit">Revit</span><span class="co-origin co-origin-account">Account data management</span>
    <svg class="co-ground-shadows" viewBox="0 0 1440 1000" aria-hidden="true"><defs><clipPath id="co-revit-clip"><path d="M388 324 L878 41 L1154 201 L664 484 Z"/></clipPath><clipPath id="co-account-clip"><path d="M400 765 L861 499 L1141 661 L680 927 Z"/></clipPath></defs><g clip-path="url(#co-revit-clip)"><path class="co-ground-shadow co-ground-shadow-revit" d="M468 290 L813 91 L1023 212 L678 411 Z"/></g><g clip-path="url(#co-account-clip)"><path class="co-ground-shadow co-ground-shadow-account" d="M541 733 L766 603 L1001 739 L776 869 Z"/></g></svg>
    </div>
    ${image('parameter-list.png', 668, 406, 'co-list')}
    <div class="co-settings">
      <div class="co-settings-crop">${image('acc-settings.png', 3084, 2041, 'co-settings-image')}</div>
      <div class="co-body-mask"></div>
      <div class="co-module-region"><span>Module-specific controls</span></div>
      <div class="co-shared-label">Shared definition</div>
    </div>
    <div class="co-shell-rig">
      <div class="co-shell">
        <div class="co-modal-header">${sprite(16, 8.66, 131, 26.67, 'co-modal-title')}${sprite(572, 8.66, 24, 24, 'co-modal-x')}</div>
        <div class="co-cad co-categories">${sprite(314, 61, 282, 506)}</div>
        <div class="co-cad co-discipline">${sprite(16, 122.8, 258, 59.63)}</div>
        <div class="co-cad co-type-instance">${sprite(16, 284.06, 258, 52.42)}</div>
        <div class="co-cad co-palette">${sprite(16, 357.48, 258, 59.62)}</div>
        <div class="co-cad co-readonly">${sprite(16, 540.79, 258, 26.21)}</div>
        <div class="co-modal-footer">${sprite(16, 600, 290, 24, 'co-create-another')}${sprite(478, 600, 118, 24, 'co-modal-buttons')}</div>
      </div>
    </div>
    <div class="co-body-rig"><div class="co-form-body">
      <div class="co-field co-name" data-field="name">${sprite(16, 61, 258, 16.8, 'co-field-label')}<span class="co-input co-name-input"></span></div>
      <div class="co-field co-data-type" data-field="data-type">${sprite(16, 203.43, 258, 26.21, 'co-field-label')}<span class="co-input co-select-input">${sprite(24, 232.39, 45, 17, 'co-value')}${sprite(259, 239.64, 7, 4, 'co-chevron')}</span></div>
      <div class="co-field co-description" data-field="description">${sprite(16, 438.1, 258, 26.21, 'co-field-label')}<span class="co-input co-description-input"></span></div>
    </div></div>
  </div></div></div>`;
  const find = (selector) => element.querySelector(selector);
  const nodes = {
    matte: find('.co-matte'), fit: find('.co-fit'),
    camera: find('.co-camera'), sources: find('.co-sources'), list: find('.co-list'),
    revitShadow: find('.co-ground-shadow-revit'), accountShadow: find('.co-ground-shadow-account'),
    settings: find('.co-settings'), shellRig: find('.co-shell-rig'), shell: find('.co-shell'),
    bodyRig: find('.co-body-rig'), body: find('.co-form-body'),
    cad: [...element.querySelectorAll('.co-cad')], fields: [...element.querySelectorAll('.co-field')],
    createAnother: find('.co-create-another'), module: find('.co-module-region'), sharedLabel: find('.co-shared-label'),
  };
  let lastTime = 0;
  let lastScene = 0;
  let fitTop = 0;

  function updateFade(p) {
    const artwork = [nodes.body.getBoundingClientRect()];
    if (p.sourceOpacity > .02) artwork.push(...[...nodes.sources.children].map((node) => node.getBoundingClientRect()));
    if (p.listOpacity > .02) artwork.push(nodes.list.getBoundingClientRect());
    if (p.shellOpacity > .02) artwork.push(nodes.shell.getBoundingClientRect());
    if (p.settingsOpacity > .02) artwork.push(nodes.settings.getBoundingClientRect());
    const fade = getFadeInsets(element.getBoundingClientRect(), artwork, horizontalBleedLimit);
    const active = Boolean(fade);
    if (element.dataset.bleed !== String(active)) element.dataset.bleed = String(active);
    const x = active ? fade.x : 0;
    const y = active ? fade.y : 0;
    nodes.matte.style.inset = `-${y}px -${x}px`;
    nodes.fit.style.left = `${x}px`;
    nodes.fit.style.top = `${fitTop + y}px`;
  }

  function paint(time, scene = Math.min(3, Math.floor(time))) {
    lastTime = time;
    lastScene = scene;
    const p = getCohesionPose(time);
    if (element.dataset.scene !== String(scene)) {
      element.dataset.scene = String(scene);
      element.setAttribute('aria-label', scenes[scene].note);
    }
    nodes.camera.style.transform = `translate(${p.cameraX}px,${p.cameraY}px) scale(${p.cameraScale})`;
    nodes.sources.style.opacity = p.sourceOpacity;
    nodes.list.style.transform = `translate3d(468px,${274 - p.listLift}px,2px) rotateX(54.7356deg) rotateZ(-45deg) scale(.73)`;
    nodes.list.style.opacity = p.listOpacity;
    nodes.revitShadow.style.opacity = p.shadow.opacity * p.listOpacity;
    nodes.accountShadow.style.opacity = p.shadow.opacity * p.sourceOpacity;
    nodes.revitShadow.style.filter = nodes.accountShadow.style.filter = `blur(${p.shadow.blur * .3}px)`;
    nodes.settings.style.opacity = p.settingsOpacity;
    nodes.settings.style.transform = `translate(${100 + p.settingsOffset}px,180px) scale(.85)`;
    nodes.shellRig.style.transform = transform({ ...p.shell, z: p.shell.z + 2 });
    nodes.shellRig.style.opacity = p.shellOpacity;
    nodes.shell.style.width = `${p.form.width}px`;
    nodes.shell.style.height = `${p.form.height}px`;
    nodes.shell.style.boxShadow = `0 0 0 1px rgba(0,0,0,.12)`;
    nodes.bodyRig.style.transform = transform({ ...p.form, z: p.form.z + 2 });
    nodes.body.style.width = `${p.fieldWidth}px`;
    nodes.body.style.height = `${p.fieldY[2] + 79.21}px`;
    nodes.body.style.backgroundColor = `rgba(255,255,255,${p.bodyLift})`;
    nodes.body.style.boxShadow = `0 ${p.bodyLift * 26}px ${p.bodyLift * 55}px rgba(0,0,0,${p.bodyLift * .28})`;
    nodes.cad.forEach((node, index) => {
      node.style.opacity = p.cadOpacity;
      node.style.transform = `translate(${index === 0 ? p.cadOffset : -p.cadOffset}px,0)`;
    });
    nodes.createAnother.style.opacity = p.cadOpacity;
    nodes.fields.forEach((node, index) => {
      node.style.transform = `translateY(${p.fieldY[index]}px)`;
      node.style.outlineColor = `rgba(164,142,41,${p.retainedHighlight * .75})`;
    });
    nodes.module.style.opacity = p.moduleHighlight;
    nodes.sharedLabel.style.opacity = p.moduleHighlight;
    updateFade(p);
  }

  const resize = new ResizeObserver(([entry]) => {
    nodes.fit.style.transform = `scale(${entry.contentRect.width / 1440})`;
    fitTop = Math.max(0, (entry.contentRect.height - entry.contentRect.width * 1000 / 1440) / 2);
    nodes.fit.style.top = `${fitTop}px`;
    paint(lastTime, lastScene);
  });
  resize.observe(element);
  paint(0);
  return { element, paint };
}
