import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCollageProgress } from '../files/case-study-collage.js';

test('collage moves continuously through entry, center, and exit', () => {
  assert.equal(getCollageProgress(800, 600, 800), -1);
  assert.equal(getCollageProgress(100, 600, 800), 0);
  assert.equal(getCollageProgress(-600, 600, 800), 1);
  assert.ok(getCollageProgress(-100, 600, 800) > getCollageProgress(300, 600, 800));
});
test('offscreen travel stays bounded and reduced motion stays still', () => {
  assert.equal(getCollageProgress(5000, 600, 800), -1);
  assert.equal(getCollageProgress(-5000, 600, 800), 1);
  assert.equal(getCollageProgress(-100, 600, 800, true), 0);
});
test('missing or invalid layout measurements do not move the collage', () => {
  for (const args of [[NaN, 600, 800], [0, 0, 800], [0, 600, 0], [Infinity, 600, 800]]) {
    assert.equal(getCollageProgress(...args), 0);
  }
});
