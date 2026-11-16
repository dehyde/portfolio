import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGovernancePose, getGovernanceMotionTime } from '../files/case-study-governance-state.js';

test('scroll progress reveals the local definition before removing an option', () => {
  const start = getGovernancePose(0);
  const local = getGovernancePose(.9);
  assert.equal(start.privateOpacity, 0);
  assert.equal(local.privateOpacity, 1);
  assert.equal(local.removalProgress, 0);
  assert.equal(local.cuesOpacity, 0);
});

test('removal preserves the saved value and later exposes the removal cue', () => {
  const removed = getGovernancePose(1.9);
  assert.equal(removed.removalProgress, 1);
  assert.equal(removed.retainedOpacity, 1);
  assert.equal(removed.cuesOpacity, 0);
  const explained = getGovernancePose(2.9);
  assert.equal(explained.retainedOpacity, 1);
  assert.equal(explained.cuesOpacity, 1);
});

test('reverse scroll restores earlier states without carrying the removal forward', () => {
  getGovernancePose(2.9);
  const reversed = getGovernancePose(.9);
  assert.equal(reversed.removalProgress, 0);
  assert.equal(reversed.retainedOpacity, 0);
  assert.equal(reversed.privateOpacity, 1);
});

test('reduced motion presents completed states for each step', () => {
  for (const [step, property] of [[0,'privateOpacity'],[1,'retainedOpacity'],[2,'cuesOpacity']]) {
    assert.equal(getGovernancePose(getGovernanceMotionTime(step, 0, true))[property], 1);
  }
});

test('invalid scroll inputs produce finite, bounded visibility values', () => {
  for (const value of [NaN, Infinity, -Infinity, undefined, -1, 9]) {
    const p = getGovernancePose(value);
    for (const key of ['privateOpacity','removalProgress','retainedOpacity','engineerOpacity','cuesOpacity']) {
      assert.ok(Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 1, key);
    }
  }
});

import { getDecisionPlayback } from '../files/case-study-cohesion-state.js';

test('mobile playback completes each change while its title is below the pinned diagram', () => {
  for (let step = 0; step < 3; step++) {
    const rects = Array.from({ length: 3 }, (_, i) => ({ top: 560 + (i - step) * 260 }));
    const playback = getDecisionPlayback(rects, 812, 480);
    assert.equal(playback.index, step);
    const pose = getGovernancePose(getGovernanceMotionTime(step, playback.progress));
    assert.equal(pose[['privateOpacity', 'retainedOpacity', 'cuesOpacity'][step]], 1);
  }
});

test('mobile playback reverses and waits until the next title enters the reading area', () => {
  const rects = [{ top: 780 }, { top: 1040 }, { top: 1300 }];
  assert.deepEqual(getDecisionPlayback(rects, 812, 480), { focused: null, index: 0, progress: 0 });
});

test('invalid reading insets retain the existing desktop playback behavior', () => {
  const rects = [{ top: 300 }, { top: 700 }];
  const baseline = getDecisionPlayback(rects, 812);
  for (const inset of [NaN, Infinity, -1, 812, 1000]) {
    assert.deepEqual(getDecisionPlayback(rects, 812, inset), baseline);
  }
});
