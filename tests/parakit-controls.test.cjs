const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const script = readFileSync(join(__dirname, '../files/parakit-controls.js'), 'utf8');

function setup() {
  const elements = [];
  let clock = 0;
  let sequence = 0;
  const timers = new Map();
  class Element {
    constructor(tag = 'div') {
      this.tag = tag; this.children = []; this.events = new Map(); this.attributes = {}; this.dataset = {};
      this.style = { setProperty() {} }; this.hidden = false;
      const classes = new Set();
      this.classList = { toggle: (name, value) => value ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
      elements.push(this);
    }
    append(...items) { this.children.push(...items); }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, callback) {
      if (!this.events.has(name)) this.events.set(name, []);
      this.events.get(name).push(callback);
    }
    emit(name, event) { for (const callback of this.events.get(name) || []) callback(event); }
    getBoundingClientRect() { return { top: 100, bottom: 600, width: 800, height: 500 }; }
    set innerHTML(value) {
      for (const name of ['video-toggle', 'video-time', 'video-expand', 'video-status-label', 'video-status-message', 'video-retry']) {
        if (value.includes(name)) { const child = new Element(); child.className = name; this.children.push(child); }
      }
    }
    querySelector(selector) { return this.children.find(child => child.className === selector.slice(1)); }
  }
  const video = new Element('video');
  const source = new Element('source');
  video.querySelectorAll = () => [source];
  Object.assign(video, { paused: true, readyState: 0, networkState: 1, seeking: false, currentTime: 0, duration: 20, videoWidth: 0, error: null, loads: 0 });
  video.frames = new Map();
  video.requestVideoFrameCallback = callback => { const id = ++sequence; video.frames.set(id, callback); return id; };
  video.cancelVideoFrameCallback = id => video.frames.delete(id);
  video.play = () => { video.paused = false; video.emit('play'); return Promise.resolve(); };
  video.pause = () => { video.paused = true; video.emit('pause'); };
  video.load = () => { video.loads++; video.readyState = 0; video.error = null; video.emit('loadstart'); };
  const player = new Element();
  player.querySelector = selector => selector === 'video' ? video : elements.find(element => element.className === selector.slice(1));
  player.closest = () => ({ querySelector: () => ({ textContent: 'Example recording' }) });
  runInNewContext(script, {
    document: { querySelectorAll: () => [player], createElement: tag => new Element(tag), addEventListener() {}, fullscreenEnabled: false },
    innerHeight: 800,
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: clock + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  });
  return {
    player, video, source,
    find: className => elements.find(element => element.className === className),
    frame() {
      video.readyState = 4; video.videoWidth = 1440;
      const pending = [...video.frames.values()]; video.frames.clear();
      pending.forEach(callback => callback(0, {}));
    },
    advance(milliseconds) {
      const until = clock + milliseconds;
      for (;;) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        timers.delete(next[0]); clock = next[1].at; next[1].callback();
      }
      clock = until;
    },
  };
}

test('playback without a presented frame shows loading instead of a blank player', () => {
  const page = setup();
  page.video.play();
  assert.equal(page.player.dataset.videoState, 'loading');
  assert.equal(page.player.attributes['aria-busy'], 'true');
  page.video.readyState = 4; page.video.videoWidth = 1440; page.video.emit('playing');
  assert.equal(page.player.dataset.videoState, 'loading');
  page.frame();
  assert.equal(page.player.dataset.videoState, 'ready');
  assert.equal(page.find('video-status').hidden, true);
});

test('buffering is visible and clears when a new frame arrives', () => {
  const page = setup(); page.video.play(); page.frame();
  page.video.readyState = 1; page.video.emit('waiting');
  assert.equal(page.player.dataset.videoState, 'loading');
  assert.match(page.find('video-status-label').textContent, /Buffering/);
  page.frame();
  assert.equal(page.player.dataset.videoState, 'ready');
});

test('one automatic retry is followed by an actionable error, never a retry loop', () => {
  const page = setup(); page.video.play();
  page.video.error = { code: 2 }; page.video.emit('error');
  assert.equal(page.player.dataset.videoState, 'loading');
  page.video.error = { code: 2 }; page.video.emit('error');
  assert.equal(page.player.dataset.videoState, 'error');
  assert.equal(page.find('video-retry').hidden, false);
  assert.match(page.find('video-status-message').textContent, /refresh/i);
  const attempts = page.video.loads;
  page.advance(60000);
  assert.equal(page.video.loads, attempts);
});

test('manual retry can recover after the error state', () => {
  const page = setup(); page.video.play();
  page.video.error = { code: 2 }; page.video.emit('error');
  page.video.error = { code: 2 }; page.video.emit('error');
  const retry = page.find('video-retry');
  assert.ok(retry, 'An error should offer a retry control');
  retry.emit('click');
  assert.equal(page.player.dataset.videoState, 'loading');
  page.video.emit('loadedmetadata'); page.frame();
  assert.equal(page.player.dataset.videoState, 'ready');
  assert.equal(page.find('video-toggle').disabled, false);
});

test('a stalled first frame times out and eventually offers retry and refresh', () => {
  const page = setup(); page.video.play();
  page.advance(35000);
  assert.equal(page.player.dataset.videoState, 'error');
  assert.equal(page.find('video-retry').hidden, false);
});

test('pausing clears the playback watchdog', () => {
  const page = setup(); page.video.play(); page.video.pause();
  page.advance(35000);
  assert.notEqual(page.player.dataset.videoState, 'error');
  assert.equal(page.video.loads, 0);
});

test('a failed source request retries immediately and then exposes the error', () => {
  const page = setup(); page.video.play();
  page.source.emit('error');
  assert.equal(page.video.loads, 1);
  page.source.emit('error');
  assert.equal(page.player.dataset.videoState, 'error');
});

test('aborting the old play request during a retry does not cancel recovery', () => {
  const page = setup(); page.video.play();
  page.video.error = { code: 2 }; page.video.emit('error');
  page.video.emit('parakit-playback-error', { detail: { name: 'AbortError' } });
  assert.equal(page.player.dataset.videoState, 'loading');
  page.advance(13000);
  assert.equal(page.player.dataset.videoState, 'error');
});

test('an aborted old request cannot replace a terminal error with a paused state', () => {
  const page = setup(); page.video.play();
  page.source.emit('error'); page.source.emit('error');
  page.video.emit('parakit-playback-error', { detail: { name: 'AbortError' } });
  assert.equal(page.player.dataset.videoState, 'error');
});
