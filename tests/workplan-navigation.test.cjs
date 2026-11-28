const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const page = readFileSync(join(__dirname, '../cases/workplan.html'), 'utf8');
const scrollScript = page.slice(page.indexOf('function scrollState()'), page.indexOf("addEventListener('scroll'"));

test('lazy images reserve space before a jump to a later chapter', () => {
  const images = page.match(/<img\b[^>]+>/g).filter(tag => tag.includes('loading="lazy"'));
  assert.ok(images.length > 0);
  for (const tag of images) {
    assert.match(tag, / width="[1-9]\d*"/);
    assert.match(tag, / height="[1-9]\d*"/);
  }
});

test('the chapter index follows a short closing section and switches back when scrolling up', () => {
  let offset = 0;
  const chapters = [
    { id: 'dates', getBoundingClientRect: () => ({ top: -offset, bottom: 850 - offset }) },
    { id: 'customer-feedback', getBoundingClientRect: () => ({ top: 850 - offset, bottom: 1150 - offset }) },
  ];
  const links = chapters.map(({ id }) => ({
    hash: '#' + id,
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
  }));
  const context = {
    chapters, links, innerHeight: 800, scrollY: 0, ticking: false,
    document: { documentElement: { scrollHeight: 1250, style: { setProperty() {} } } },
  };
  runInNewContext(scrollScript, context);

  for (const [position, expected] of [[0, '#dates'], [450, '#customer-feedback'], [200, '#dates']]) {
    context.scrollY = offset = position;
    context.scrollState();
    assert.deepEqual(links.filter(link => link['aria-current'] === 'location').map(link => link.hash), [expected]);
  }
});
