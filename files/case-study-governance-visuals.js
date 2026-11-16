import { getGovernancePose } from './case-study-governance-state.js?v=governance-polish-20261114b';

export const scenes = [
  { title: 'Separate scopes', note: 'A project admin creates a project-only field without adding it to the account library.' },
  { title: 'Retain applied data', note: 'An account admin removes an option from a shared field, while the value previously saved on a project item remains.' },
  { title: 'Show removed values', note: 'The existing item displays the removed value with an explicit indicator, while it is unavailable for new selections.' },
];

let visualId = 0;

export function createVisual() {
  const prefix = `gv-${++visualId}`;
  const element = document.createElement('div');
  element.className = 'co-visual gv-visual';
  element.setAttribute('role', 'img');
  element.innerHTML = `<svg class="gv-art" viewBox="0 0 800 850" aria-hidden="true">
    <defs>
      <g id="${prefix}-plane">
        <path class="gv-plane-edge" d="M53.589838 260 400 460 746.410162 260 746.410162 264 400 464 53.589838 264Z"/>
        <polygon class="gv-plane-face" points="400,60 746.410162,260 400,460 53.589838,260"/>
        <path class="gv-plane-rim" d="M53.589838 260 400 460 746.410162 260"/>
      </g>
      <clipPath id="${prefix}-project-clip"><polygon points="400,400 746.410162,600 400,800 53.589838,600"/></clipPath>
      <filter id="${prefix}-shadow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="16"/></filter>
      <!-- Lucide user-round (ISC), with a filled silhouette. -->
      <g id="${prefix}-person" class="gv-person-icon"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></g>
    </defs>
    <g class="gv-world">
      <use class="gv-plane" href="#${prefix}-plane" transform="translate(0 340)"/>
      <g class="gv-shadow-layer" clip-path="url(#${prefix}-project-clip)">
        <polygon class="gv-cast-shadow" points="430,300 776.410162,500 430,700 83.589838,500" filter="url(#${prefix}-shadow)"/>
      </g>
      <path class="gv-connection" d="M684 295V548"/>
      <g class="gv-account">
        <use class="gv-plane" href="#${prefix}-plane"/>
        <text class="gv-scope-label" x="48" y="65">Account</text>
        <text class="gv-action-label gv-scope-detail" x="48" y="92">Shared across projects</text>
        <use href="#${prefix}-person" transform="translate(48 129)"/>
        <text class="gv-person-label" x="82" y="149">Account admin</text>
        <text class="gv-action-label" x="82" y="178">Manages shared definitions</text>
        <g class="gv-shared-token">
          <g class="gv-definition gv-shared-definition"><rect x="330" y="191" width="194" height="40" rx="5"/><text class="gv-definition-label" x="342" y="219">MEP approval</text></g>
          <text class="gv-token-value" x="330" y="268">Electrical</text>
          <g class="gv-option-token"><text class="gv-token-value" x="432" y="268">Plumbing</text><path class="gv-option-strike" d="M430 261H510" pathLength="1"/></g>
          <text class="gv-token-value" x="540" y="268">HVAC</text>
          <text class="gv-account-action" x="330" y="304">Plumbing removed from the choices</text>
        </g>
      </g>
      <g class="gv-projects">
        <text class="gv-scope-label" x="48" y="419">Project</text>
        <text class="gv-action-label gv-scope-detail" x="48" y="446">Local definitions and saved data</text>
        <use href="#${prefix}-person" transform="translate(48 488)"/>
        <text class="gv-person-label" x="82" y="508">Project admin</text>
        <text class="gv-action-label" x="82" y="537">Creates a project-only field</text>
        <g class="gv-private-token">
          <g class="gv-definition gv-private-definition"><rect x="330" y="514" width="236" height="40" rx="5"/><text class="gv-definition-label" x="342" y="542">Inspection zone</text></g>
          <text class="gv-token-detail" x="330" y="584">Only in this project</text>
        </g>
        <g class="gv-persona-engineer">
          <use href="#${prefix}-person" transform="translate(48 560)"/>
          <text class="gv-person-label" x="82" y="580">Project engineer</text>
          <text class="gv-action-label" x="82" y="609">Uses fields on project items</text>
        </g>
        <g class="gv-retained-token">
          <g class="gv-retained-definition"><rect class="gv-definition" x="330" y="632" width="310" height="46" rx="5"/><text class="gv-definition-label" x="342" y="663">MEP approval</text><rect class="gv-value-surface" x="522" y="636" width="114" height="38" rx="3"/><text class="gv-value-label" x="534" y="661">Plumbing</text></g>
          <text class="gv-retained-note" x="330" y="712">Previously saved value stays.</text>
          <text class="gv-cues gv-removed-label" x="330" y="742">Removed from new selections</text>
        </g>
      </g>
    </g>
  </svg>`;
  const find = (selector) => element.querySelector(selector);
  const nodes = {
    private: find('.gv-private-token'), strike: find('.gv-option-strike'), option: find('.gv-option-token'),
    retained: find('.gv-retained-token'), engineer: find('.gv-persona-engineer'),
    cues: element.querySelectorAll('.gv-cues'), accountAction: find('.gv-account-action'),
  };
  function paint(time, scene = Math.min(2, Math.floor(time))) {
    const pose = getGovernancePose(time);
    const safeScene = Number.isFinite(scene) ? Math.max(0, Math.min(2, Math.floor(scene))) : 0;
    element.dataset.scene = String(safeScene);
    element.setAttribute('aria-label', scenes[safeScene].note);
    nodes.private.style.opacity = pose.privateOpacity;
    nodes.private.setAttribute('transform', `translate(0 ${pose.privateShift})`);
    nodes.strike.style.opacity = pose.removalProgress;
    nodes.strike.style.strokeDashoffset = String(1 - pose.removalProgress);
    nodes.option.style.opacity = 1 - .5 * pose.removalProgress;
    nodes.retained.style.opacity = pose.retainedOpacity;
    nodes.engineer.style.opacity = pose.engineerOpacity;
    nodes.cues.forEach((node) => { node.style.opacity = pose.cuesOpacity; });
    nodes.accountAction.style.opacity = pose.removalProgress;
  }
  paint(0);
  return { element, paint };
}
