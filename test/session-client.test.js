import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/session.js', import.meta.url), 'utf8');

class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    // Real elements carry both of these; session.js tags injected nodes with the English
    // and Chinese copy so the language toggle can swap them after they are inserted.
    this.dataset = {};
    this.attributes = new Map();
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  append(...children) { this.children.push(...children); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  querySelector() { return new FakeElement('button'); }
  click() { return this.listeners.get('click')?.({ currentTarget: this }); }
}

function findByText(node, text) {
  if (node.textContent === text) return node;
  for (const child of node.children) {
    const found = findByText(child, text);
    if (found) return found;
  }
  return null;
}

async function signOutHarness(deleteFetch) {
  const form = new FakeElement('form');
  const currentSession = new FakeElement('section');
  let calls = 0;
  const context = {
    document: {
      querySelector(selector) {
        if (selector === '#session-form') return form;
        if (selector === '#current-session') return currentSession;
        return null;
      },
      createElement: (tag) => new FakeElement(tag)
    },
    fetch(...args) {
      calls += 1;
      if (calls === 1) return Promise.resolve({
        ok: true,
        json: async () => ({ user: { displayName: 'Pat', role: 'participant' } })
      });
      return deleteFetch(...args);
    },
    location: { search: '', pathname: '/session', reload() {} },
    URLSearchParams,
    FormData,
    AbortController: undefined,
    setTimeout(callback) { queueMicrotask(callback); return 1; },
    clearTimeout() {},
    queueMicrotask
  };

  vm.runInNewContext(source, context);
  for (let attempt = 0; attempt < 10 && !findByText(currentSession, 'Sign out and use another role'); attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  const button = findByText(currentSession, 'Sign out and use another role');
  assert.ok(button, 'sign-out button is rendered');
  const outcome = await Promise.race([
    Promise.resolve(button.click()).then(() => 'settled', () => 'rejected'),
    new Promise((resolve) => setTimeout(() => resolve('hung'), 50))
  ]);
  return { button, currentSession, outcome };
}

test('sign-out request has a finite source contract', () => {
  assert.match(source, /Promise\.race/);
  assert.match(source, /AbortController/);
  assert.match(source, /finally\s*\{[\s\S]*signOut\.disabled\s*=\s*false/);
});

test('sign-out recovers with a visible message when deletion rejects or hangs without AbortController', async () => {
  for (const deleteFetch of [
    () => Promise.reject(new Error('offline')),
    () => new Promise(() => {})
  ]) {
    const { button, currentSession, outcome } = await signOutHarness(deleteFetch);
    assert.equal(outcome, 'settled');
    assert.equal(button.disabled, false);
    assert.match(currentSession.children.map((child) => JSON.stringify(child, ['textContent', 'children'])).join(' '), /retry|try again|could not|longer than expected/i);
  }
});
