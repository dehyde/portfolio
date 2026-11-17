const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(reduced = false) {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const script = html.match(/<script id="contact-navigation">([\s\S]*?)<\/script>/)[1];
  const callbacks = {};
  const classes = new Set();
  const contact = { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
  const link = { addEventListener: (name, callback) => { callbacks[name] = callback; } };
  const context = {
    document: {
      documentElement: { scrollHeight: 2000 },
      getElementById: id => id === 'contact-nav' ? link : contact,
    },
    innerHeight: 600,
    scrollY: 0,
    matchMedia: () => ({ matches: reduced }),
    setTimeout: (callback, delay) => { callbacks.fade = callback; callbacks.delay = delay; return 1; },
    clearTimeout: () => {},
    requestAnimationFrame: callback => { callbacks.frame = callback; },
  };
  context.window = {
    scrollTo: options => { callbacks.scrollOptions = options; },
    addEventListener: (name, callback) => { callbacks[name] = callback; },
  };
  vm.runInNewContext(script, context);
  return { callbacks, classes, context };
}

test('highlights only after reaching the bottom and fades after 15 seconds', () => {
  const { callbacks, classes, context } = setup();
  callbacks.click({ preventDefault() {} });
  assert.equal(callbacks.scrollOptions.top, 2000);
  assert.equal(callbacks.scrollOptions.behavior, 'smooth');
  callbacks.frame();
  assert.equal(classes.has('contact-highlighted'), false);
  context.scrollY = 1398;
  callbacks.scroll();
  assert.equal(classes.has('contact-highlighted'), true);
  assert.equal(callbacks.delay, 15000);
  callbacks.fade();
  assert.equal(classes.has('contact-highlighted'), false);
});

test('reduced motion scrolls directly to the bottom', () => {
  const { callbacks } = setup(true);
  callbacks.click({ preventDefault() {} });
  assert.equal(callbacks.scrollOptions.behavior, 'instant');
});
