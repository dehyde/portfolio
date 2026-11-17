import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMaintenanceSequenceState } from '../files/case-study-iot-sequence.js';

test('model reveals in order and highlights only its newest step', () => {
  const initial = getMaintenanceSequenceState(0);
  assert.equal(initial.visible, 1);
  assert.equal(initial.active, 0);
  const fourth = getMaintenanceSequenceState(3.4);
  assert.equal(fourth.visible, 4);
  assert.equal(fourth.active, 3);
  assert.deepEqual(fourth.lines.slice(0, 3), [1, 1, 1]);
  assert.ok(fourth.lines[3] > .39 && fourth.lines[3] < .41);
  assert.equal(fourth.lines[4], 0);
});

test('screen rises and steps separate before they fold left', () => {
  const before = getMaintenanceSequenceState(5.4);
  assert.equal(before.visible, 6);
  assert.equal(before.rise, 0);
  const middle = getMaintenanceSequenceState(6);
  assert.ok(middle.rise > 0 && middle.rise < 1);
  assert.ok(middle.spread > 0);
  assert.equal(middle.fold, 0);
  assert.equal(middle.lineOpacity, 0);
  const later = getMaintenanceSequenceState(6.7);
  assert.ok(later.spread > later.fold);
  assert.equal(later.active, 0);
  assert.equal(getMaintenanceSequenceState(7).complete, true);
});

test('jumping past the handoff settles completely and reverse scroll reconstructs the model', () => {
  const end = getMaintenanceSequenceState(500);
  assert.equal(end.complete, true);
  assert.deepEqual([end.rise, end.spread, end.fold], [1, 1, 1]);
  const reverse = getMaintenanceSequenceState(2.5);
  assert.equal(reverse.complete, false);
  assert.equal(reverse.visible, 3);
  assert.equal(reverse.active, 2);
  assert.equal(reverse.rise, 0);
});

test('invalid or pre-section geometry leaves the first step readable', () => {
  for (const value of [NaN, Infinity, undefined, -50]) {
    const state = getMaintenanceSequenceState(value);
    assert.equal(state.active, 0);
    assert.equal(state.visible, 1);
    assert.equal(state.rise, 0);
  }
});
