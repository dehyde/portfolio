const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const page = readFileSync(join(__dirname, '../cases/parakit.html'), 'utf8');
const script = page.match(/<script id="case-loading-script">([\s\S]*?)<\/script>/)[1];

function image({ complete = false, visible = true } = {}) {
  const events = new Map();
  return {
    complete,
    getBoundingClientRect: () => ({ width: 100, height: 100, top: visible ? 100 : 3000, bottom: visible ? 200 : 3100 }),
    addEventListener: (name, handler) => events.set(name, handler),
    emit: name => events.get(name)?.(),
    observed: () => events.size > 0,
  };
}

function load(images = []) {
  let time = 0;
  const timers = [];
  const events = new Map();
  const overlay = {
    ready: false,
    removed: false,
    classList: { add: name => { if (name === 'is-ready') overlay.ready = true; } },
    remove: () => { overlay.removed = true; },
  };
  runInNewContext(script, {
    performance: { now: () => time },
    innerHeight: 800,
    setTimeout: (callback, delay) => timers.push({ callback, at: time + delay }),
    document: {
      images,
      querySelector: () => overlay,
      addEventListener: (name, handler) => events.set(name, handler),
    },
  });
  return {
    overlay,
    ready: () => events.get('DOMContentLoaded')(),
    advance(duration) {
      const until = time + duration;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        if (!timers.length || timers[0].at > until) break;
        const timer = timers.shift();
        time = timer.at;
        timer.callback();
      }
      time = until;
    },
  };
}

test('waits for visible media, then removes the overlay', async () => {
  const hero = image();
  const state = load([hero]);
  state.ready();
  state.advance(900);
  assert.equal(state.overlay.ready, false);
  hero.emit('load');
  await Promise.resolve();
  await Promise.resolve();
  state.advance(0);
  assert.equal(state.overlay.ready, true);
  state.advance(350);
  assert.equal(state.overlay.removed, true);
});

test('a broken visible image does not trap the reader', async () => {
  const hero = image();
  const state = load([hero]);
  state.ready();
  hero.emit('error');
  await Promise.resolve();
  await Promise.resolve();
  state.advance(400);
  assert.equal(state.overlay.ready, true);
  state.advance(350);
  assert.equal(state.overlay.removed, true);
});

test('cached images settle quickly and offscreen images do not block reading', async () => {
  const offscreen = image({ visible: false });
  const state = load([image({ complete: true }), offscreen]);
  state.ready();
  await Promise.resolve();
  await Promise.resolve();
  state.advance(399);
  assert.equal(state.overlay.ready, false);
  state.advance(1);
  assert.equal(state.overlay.ready, true);
  assert.equal(offscreen.observed(), false);
});

test('a stalled page is revealed by the five-second fallback', () => {
  const state = load();
  state.advance(4999);
  assert.equal(state.overlay.ready, false);
  state.advance(1);
  assert.equal(state.overlay.ready, true);
  state.advance(350);
  assert.equal(state.overlay.removed, true);
});
