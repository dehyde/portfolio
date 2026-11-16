import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMotionPlayer } from '../files/case-study-cohesion.js';

function clock() {
  let next = 0;
  const frames = new Map();
  globalThis.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  return timestamp => { const pending = [...frames.values()]; frames.clear(); pending.forEach(f => f(timestamp)); };
}

test('a point transition takes its allotted time even if scroll updates repeat', () => {
  const tick = clock();
  let time = 0;
  const player = createMotionPlayer({ paint: value => { time = value; } }, 800);
  player.seek(.9, 0);
  tick(0);
  player.seek(.9, 0);
  tick(400);
  assert.ok(time > .3 && time < .6);
  tick(800);
  assert.equal(time, .9);
});
test('fast jumps receive time for the intermediate states and reverse from the current frame', () => {
  const tick = clock();
  let time = 0;
  const player = createMotionPlayer({ paint: value => { time = value; } }, 800);
  player.seek(.9, 0, true);
  player.seek(2.9, 2);
  tick(0); tick(800);
  assert.ok(time > 1.5 && time < 2.2);
  const midway = time;
  player.seek(.9, 0);
  tick(900);
  assert.equal(time, midway);
  tick(2500);
  assert.equal(time, .9);
});
test('reduced motion snaps and cancels any pending transition', () => {
  const tick = clock();
  let time = 0;
  const player = createMotionPlayer({ paint: value => { time = value; } }, 800);
  player.seek(1.9, 1);
  tick(0); tick(200);
  player.seek(2.9, 2, true);
  tick(1000);
  assert.equal(time, 2.9);
});
