import { getGovernancePose } from './case-study-governance-state.js?v=governance-polish-20261114b';

export const scenes = [
  { title: 'Separate scopes', note: 'A project admin creates a project-only field without adding it to the account library.' },
  { title: 'Retain applied data', note: 'An account admin removes an option from a shared field, while the value previously saved on a project item remains.' },
  { title: 'Show removed values', note: 'The existing item displays the removed value with an explicit indicator, while it is unavailable for new selections.' },
];

export function createVisual() {
  const element = document.createElement('div');
  element.className = 'co-visual gv-visual';
  element.setAttribute('role', 'img');
  element.innerHTML = `<svg class="gv-art" viewBox="0 0 1200 900" aria-hidden="true">
    <g class="gv-world">
      <g class="gv-account">
        <polygon class="gv-slab-side" points="128,200 360,320 360,340 128,220"/>
        <polygon class="gv-slab-front" points="360,320 1072,220 1072,240 360,340"/>
        <polygon class="gv-slab-top" points="128,200 840,100 1072,220 360,320"/>
        <text class="gv-person-label" x="165" y="72">ACCOUNT ADMIN</text>
        <text class="gv-action-label" x="165" y="105">Manages shared field definitions</text>
        <g class="gv-shared-token">
          <rect x="320" y="125" width="500" height="152" rx="3"/>
          <text class="gv-token-kicker" x="346" y="157">ACCOUNT FIELD DEFINITION</text>
          <text class="gv-card-heading" x="346" y="190">MEP approval</text>
          <text class="gv-token-detail" x="346" y="220">Available options</text>
          <text class="gv-token-value" x="346" y="254">Electrical</text>
          <g class="gv-option-token"><text class="gv-token-value" x="510" y="254">Plumbing</text><path class="gv-option-strike" d="M 506 246 L 636 246" pathLength="1"/></g>
          <text class="gv-token-value" x="668" y="254">HVAC</text>
        </g>
        <text class="gv-account-action" x="840" y="175">Removes an available option</text>
      </g>
      <path class="gv-connection" d="M 600 328 L 600 392"/>
      <g class="gv-projects">
        <polygon class="gv-slab-side" points="128,750 360,860 360,880 128,770"/>
        <polygon class="gv-slab-front" points="360,860 1072,760 1072,780 360,880"/>
        <polygon class="gv-slab-top" points="128,750 840,650 1072,760 360,860"/>
        <text class="gv-project-label" x="145" y="410">PROJECT A</text>
        <text class="gv-person-label" x="165" y="458">PROJECT ADMIN</text>
        <text class="gv-action-label" x="165" y="489">Creates a project-only field</text>
        <g class="gv-private-token"><rect x="585" y="410" width="365" height="90" rx="3"/><text class="gv-token-kicker" x="610" y="442">PROJECT-ONLY DEFINITION</text><text class="gv-card-heading" x="610" y="478">Local field</text></g>
        <g class="gv-persona-engineer"><text class="gv-person-label" x="165" y="598">PROJECT ENGINEER</text><text class="gv-action-label" x="165" y="629">Uses the field on a project item</text></g>
        <g class="gv-retained-token"><rect x="585" y="540" width="365" height="150" rx="3"/><text class="gv-token-kicker" x="610" y="572">EXISTING PROJECT ITEM</text><text class="gv-token-detail" x="610" y="602">MEP approval</text><text class="gv-card-heading" x="610" y="638">Plumbing</text><text class="gv-cues gv-removed-label" x="760" y="638">(removed)</text><text class="gv-token-detail" x="610" y="670">Previously saved on an item</text></g>
        <g class="gv-cues"><text class="gv-clarity-label" x="585" y="735">Not available for new selections</text></g>
      </g>
    </g>
  </svg>`;
  const find = (selector) => element.querySelector(selector);
  const nodes = {
    world: find('.gv-world'), account: find('.gv-account'), private: find('.gv-private-token'),
    strike: find('.gv-option-strike'), option: find('.gv-option-token'), retained: find('.gv-retained-token'),
    engineer: find('.gv-persona-engineer'), cues: element.querySelectorAll('.gv-cues'), accountAction: find('.gv-account-action'),
  };
  function paint(time, scene = Math.min(2, Math.floor(time))) {
    const pose = getGovernancePose(time, window.matchMedia('(max-width: 900px)').matches);
    const safeScene = Number.isFinite(scene) ? Math.max(0, Math.min(2, Math.floor(scene))) : 0;
    element.dataset.scene = String(safeScene);
    element.setAttribute('aria-label', scenes[safeScene].note);
    nodes.world.setAttribute('transform', '');
    nodes.account.style.opacity = '1';
    nodes.private.style.opacity = pose.privateOpacity;
    nodes.private.setAttribute('transform', `translate(0 ${pose.privateShift})`);
    nodes.strike.style.opacity = pose.removalProgress;
    nodes.strike.style.strokeDashoffset = String(1 - pose.removalProgress);
    nodes.option.style.opacity = 1 - .5 * pose.removalProgress;
    nodes.retained.style.opacity = pose.retainedOpacity;
    nodes.engineer.style.opacity = pose.engineerOpacity;
    nodes.cues.forEach((node) => { node.style.opacity = pose.cuesOpacity; });
    element.querySelectorAll('.gv-account-action').forEach((node) => { node.style.opacity = pose.removalProgress; });
  }
  paint(0);
  return { element, paint };
}
