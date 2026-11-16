import { createCaseStudyProcessController } from './case-study-cohesion.js?v=preview-refine-20261024';
import { createVisual, scenes } from './case-study-governance-visuals.js?v=governance-mobile-20261116';
import { getGovernanceMotionTime } from './case-study-governance-state.js?v=governance-polish-20261114b';

export function createGovernanceController(frame, onNavigationChange) {
  return createCaseStudyProcessController(frame, onNavigationChange, {
    id: 'governance',
    title: 'Governance',
    scenes,
    createVisual,
    motionTime: getGovernanceMotionTime,
    nextLinks: [['project-flexibility', 'Cohesion'], ['reuse-before-creation', 'Data standardization']],
  });
}
