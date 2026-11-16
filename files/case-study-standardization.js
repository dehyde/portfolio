import { createCaseStudyProcessController } from './case-study-cohesion.js?v=point-transitions-20261116';
import { getStandardizationMotionTime } from './case-study-standardization-state.js?v=standardization-perf2-20261116';
import { createVisual, scenes } from './case-study-standardization-visuals.js?v=standardization-perf2-20261116';

export function createStandardizationController(frame, onNavigationChange) {
  return createCaseStudyProcessController(frame, onNavigationChange, {
    id: 'standardization',
    title: 'Data standardization',
    scenes,
    createVisual,
    motionTime: getStandardizationMotionTime,
    sourceLinksByStep: [
      [['assets/standardization/module-fields.png', 'Module fields wireframe'], ['assets/standardization/select-existing.png', 'Selection modal wireframe']],
      [['assets/standardization/create-field-full-4x.png', 'Proposed duplicate-check design']],
    ],
    nextLinks: [['standards-governance', 'Governance'], ['project-flexibility', 'Cohesion']],
  });
}
