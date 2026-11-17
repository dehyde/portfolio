const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const script = readFileSync(join(__dirname, '../files/parakit-workflows.js'), 'utf8');

function setup({ reducedMotion = false, height = 800, hash = '' } = {}) {
  const elements = [];
  const events = new Map();
  const frames = [];
  let scrollY = 918;
  const document = { activeElement: null };
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.attributes = {};
      this.events = new Map();
      this.hidden = false;
      this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
      const classes = new Set();
      this.classList = { add: name => classes.add(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name), contains: name => classes.has(name) };
      elements.push(this);
    }
    append(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
    before(sibling) { sibling.parent = this.parent; }
    remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, handler) { this.events.set(name, handler); }
    focus() { document.activeElement = this; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    getBoundingClientRect() {
      return { top: this.className === 'workflow-story is-carousel' ? 1000 - scrollY : 0, height: this.isPanel ? 300 : 140 };
    }
    scrollIntoView() {}
  }
  const section = new Element();
  const intro = new Element();
  const title = new Element('h2');
  section.append(intro);
  intro.append(title);
  const panels = ['open', 'start', 'edit', 'share'].map(id => {
    const panel = new Element('figure');
    panel.id = `flow-${id}`;
    panel.isPanel = true;
    panel.querySelector = () => ({ textContent: id });
    section.append(panel);
    return panel;
  });
  section.querySelectorAll = () => panels;
  section.querySelector = selector => selector === '#workflows-title' ? title : intro;
  document.querySelector = () => section;
  document.createElement = tag => new Element(tag);
  const media = { matches: reducedMotion, addEventListener() {} };
  const location = { hash };
  const context = {
    document, location, innerHeight: height,
    get scrollY() { return scrollY; },
    matchMedia: () => media,
    getComputedStyle: () => ({ top: '82px' }),
    requestAnimationFrame: callback => frames.push(callback),
    addEventListener: (name, callback) => {
      if (!events.has(name)) events.set(name, []);
      events.get(name).push(callback);
    },
    scrollTo: ({ top }) => { scrollY = top; },
    history: { replaceState: (_, __, next) => { location.hash = next; } },
  };
  runInNewContext(script, context);
  const find = className => elements.find(element => element.className === className);
  return {
    panels,
    track: find('workflow-track'),
    index: find('workflow-index'),
    connector: find('workflow-connector'),
    intro,
    story: find('workflow-story is-carousel'),
    buttons: elements.filter(element => element.tag === 'button'),
    scrollTo(y) {
      scrollY = y;
      for (const callback of events.get('scroll') || []) callback();
      while (frames.length) frames.shift()();
    },
  };
}

test('the job list moves continuously while diagrams transition one at a time', () => {
  const page = setup();
  page.scrollTo(1048);
  assert.equal(page.index.style.transform, 'translate3d(0, -35px, 0)');
  assert.deepEqual(page.buttons.map(button => Number(button.style.opacity).toFixed(2)), ['1.00', '0.45', '0.45', '0.45']);
  assert.ok(page.connector.style['--connector-top']);
  assert.equal(page.panels[0].style.opacity, '1');
  assert.equal(page.panels[1].style.opacity, '0');
  assert.equal(page.panels.every(panel => !panel.hidden), true);
  assert.equal(page.panels.filter(panel => panel.attributes['aria-hidden'] === 'false').length, 1);
  page.scrollTo(1178);
  assert.equal(page.index.style.transform, 'translate3d(0, -70px, 0)');
  assert.deepEqual(page.buttons.map(button => Number(button.style.opacity).toFixed(2)), ['1.00', '0.45', '0.45', '0.45']);
  assert.equal(page.buttons[0].attributes['aria-selected'], 'true');
  assert.equal(page.panels[0].style.opacity, '1');
  page.scrollTo(1438);
  assert.equal(page.buttons[1].attributes['aria-selected'], 'true');
  assert.deepEqual(page.buttons.map(button => button.style.opacity), ['0.45', '1', '0.45', '0.45']);
  assert.equal(page.panels[1].style.opacity, '1');
  assert.equal(page.panels[0].style.opacity, '0');
  page.scrollTo(918);
  assert.equal(page.buttons[0].attributes['aria-selected'], 'true');
});

test('the section heading stays above the list and diagrams', () => {
  const page = setup();
  assert.equal(page.intro.parent.children[0], page.intro);
  assert.equal(page.intro.parent.className, 'workflow-stage');
});

test('a workflow deep link selects its diagram and centers its job', () => {
  const page = setup({ hash: '#flow-edit' });
  assert.equal(page.index.style.transform, 'translate3d(0, -280px, 0)');
  assert.ok(page.connector.style['--connector-height']);
  assert.equal(page.buttons[2].attributes['aria-selected'], 'true');
  assert.equal(page.panels[2].inert, false);
  assert.equal(page.panels[2].style.opacity, '1');
  assert.equal(page.panels[1].inert, true);
});

test('reduced motion shows the chosen workflow without animating', () => {
  const page = setup({ reducedMotion: true, hash: '#flow-edit' });
  assert.deepEqual(page.panels.map(panel => panel.hidden), [true, true, false, true]);
  assert.equal(page.panels[2].style.transform, 'none');
});

test('short screens keep every job selectable without scroll pinning', () => {
  const page = setup({ height: 400 });
  assert.equal(page.story.classList.contains('is-static'), true);
  page.buttons[3].events.get('click')();
  assert.equal(page.buttons[3].attributes['aria-selected'], 'true');
  assert.equal(page.panels[3].style.opacity, '1');
  assert.ok(page.connector.style['--connector-top']);
});
