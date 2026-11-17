const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const script = join(__dirname, '../files/parakit-video.js');

function loadPlayer({ reducedMotion = false, blockPlayback = false } = {}) {
  const video = {
    paused: true,
    ended: false,
    muted: false,
    currentTime: 0,
    plays: 0,
    dispatchEvent() {},
    play() {
      this.plays++;
      if (blockPlayback) return Promise.reject(new Error('Autoplay disabled'));
      this.paused = false;
      return Promise.resolve();
    },
    pause() { this.paused = true; },
  };
  let onIntersection;
  runInNewContext(readFileSync(script, 'utf8'), {
    document: { querySelectorAll: () => [video] },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    matchMedia: () => ({ matches: reducedMotion }),
    IntersectionObserver: class {
      constructor(callback) { onIntersection = callback; }
      observe() {}
    },
  });
  return {
    video,
    scrollTo(ratio) {
      onIntersection?.([{ target: video, intersectionRatio: ratio }]);
    },
  };
}

test('scrolling into view plays silently and leaving pauses at the current position', () => {
  const { video, scrollTo } = loadPlayer();
  scrollTo(0.2);
  assert.equal(video.plays, 0);
  scrollTo(0.6);
  assert.equal(video.paused, false);
  assert.equal(video.muted, true);
  video.currentTime = 4;
  scrollTo(0.2);
  assert.equal(video.paused, true);
  scrollTo(0.6);
  assert.equal(video.paused, false);
  assert.equal(video.currentTime, 4);
});

test('scrolling honors a manual pause', () => {
  const { video, scrollTo } = loadPlayer();
  scrollTo(0.6);
  video.pause();
  scrollTo(0);
  scrollTo(0.6);
  assert.equal(video.plays, 1);
});

test('a completed recording stays stopped', () => {
  const { video, scrollTo } = loadPlayer();
  scrollTo(0.6);
  video.ended = true;
  scrollTo(0);
  scrollTo(0.6);
  assert.equal(video.plays, 1);
});

test('reduced motion leaves playback to the reader', () => {
  const { video, scrollTo } = loadPlayer({ reducedMotion: true });
  scrollTo(0.8);
  assert.equal(video.plays, 0);
});

test('a browser rejection leaves manual playback available', async () => {
  const { video, scrollTo } = loadPlayer({ blockPlayback: true });
  scrollTo(0.8);
  await Promise.resolve();
  assert.equal(video.plays, 1);
  assert.equal(video.paused, true);
});
