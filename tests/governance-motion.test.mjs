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
